"""Rendu de la vidéo : les images sont composées une à une puis envoyées à FFmpeg, avec la bande-son.

1080 x 1920, 30 images par seconde, H.264 + AAC : le format attendu par YouTube Shorts.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw

from . import design
from .audio import Pcm, write_wav

FPS = 30
ENTER = 0.32       # durée de l'entrée d'un écran, en secondes
MAX_SECONDS = 59   # au-delà, YouTube ne traite plus la vidéo comme un Short


def _faded(layer: Image.Image, alpha: float) -> Image.Image:
    if alpha >= 1:
        return layer
    out = layer.copy()
    out.putalpha(out.getchannel("A").point(lambda v: int(v * alpha)))
    return out


def render(path: Path, *, day: str, scenes: list[tuple[float, Image.Image]], subtitles: list[tuple[float, float, str]], soundtrack: Pcm) -> float:
    """Écrit la vidéo. `scenes` : (instant de début, image de l'écran), dans l'ordre. Rend la durée en secondes."""
    duration = soundtrack.seconds
    if duration > MAX_SECONDS:
        raise ValueError(f"Vidéo trop longue : {duration:.1f} s pour {MAX_SECONDS} s au plus.")
    background, head = design.grid_background(), design.header(day)
    subtitle_images = {text: design.subtitle(text) for _, _, text in subtitles}
    frames = int(round(duration * FPS))

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "son.wav"
        wav.write_bytes(write_wav(soundtrack))
        command = [
            imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{design.W}x{design.H}", "-r", str(FPS), "-i", "-",
            "-i", str(wav),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-shortest", "-movflags", "+faststart", str(path),
        ]
        encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            for n in range(frames):
                t = n / FPS
                drift = int(t * 9) % 72
                frame = background.crop((drift, drift, drift + design.W, drift + design.H))
                frame.paste(head, (0, 0), head)
                draw = ImageDraw.Draw(frame)
                draw.rectangle([design.MARGIN, 296, design.W - design.MARGIN, 306], fill=design.LINE)
                draw.rectangle([design.MARGIN, 296, design.MARGIN + int((design.W - 2 * design.MARGIN) * min(1, t / duration)), 306], fill=design.ACCENT)

                start, scene = [s for s in scenes if s[0] <= t][-1] if scenes[0][0] <= t else scenes[0]
                progress = min(1.0, max(0.0, (t - start) / ENTER))
                eased = 1 - (1 - progress) ** 3
                layer = _faded(scene, eased)
                frame.paste(layer, (design.MARGIN, design.CARD_TOP + int((1 - eased) * 48)), layer)

                for begin, end, text in subtitles:
                    if begin <= t < end:
                        image = subtitle_images[text]
                        frame.paste(image, ((design.W - image.width) // 2, design.SUBTITLE_Y - image.height // 2), image)
                        break
                encoder.stdin.write(frame.tobytes())
            encoder.stdin.close()
            error = encoder.stderr.read().decode("utf-8", "replace")
            if encoder.wait() != 0:
                raise RuntimeError(f"FFmpeg a échoué : {error[-600:]}")
        finally:
            if encoder.poll() is None:
                encoder.kill()
            encoder.stderr.close()
    return duration
