"""Bande-son : les phrases lues, mises bout à bout avec une courte respiration entre elles.

Tout est en WAV non compressé (PCM 16 bits), ce qui donne la durée exacte de chaque phrase :
c'est elle qui cale les écrans et les sous-titres.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass

PAUSE = 0.28      # silence entre deux phrases, en secondes
LEAD_IN = 0.25    # silence avant la première
TAIL = 1.4        # l'écran final reste affiché après la dernière syllabe


@dataclass
class Pcm:
    rate: int
    channels: int
    width: int   # octets par échantillon
    data: bytes

    @property
    def seconds(self) -> float:
        return len(self.data) / (self.rate * self.channels * self.width)


def read_wav(raw: bytes) -> Pcm:
    """Lit un WAV PCM. Tolère un en-tête sans longueur (flux), comme en renvoient les services de voix."""
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        raise ValueError("Ce n'est pas un fichier WAV.")
    pos, fmt, data = 12, None, None
    while pos + 8 <= len(raw):
        tag, size = raw[pos:pos + 4], struct.unpack("<I", raw[pos + 4:pos + 8])[0]
        start = pos + 8
        if tag == b"fmt ":
            fmt = struct.unpack("<HHIIHH", raw[start:start + 16])
        elif tag == b"data":
            end = len(raw) if size in (0, 0xFFFFFFFF) or start + size > len(raw) else start + size
            data = raw[start:end]
            break
        pos = start + size + (size & 1)
    if not fmt or data is None:
        raise ValueError("WAV incomplet : format ou données absents.")
    code, channels, rate, _, _, bits = fmt
    if code != 1 or bits != 16:
        raise ValueError(f"WAV non pris en charge (code {code}, {bits} bits) : PCM 16 bits attendu.")
    width = bits // 8
    return Pcm(rate, channels, width, data[: len(data) - len(data) % (channels * width)])


def silence(like: Pcm, seconds: float) -> bytes:
    frames = int(round(seconds * like.rate))
    return b"\x00" * (frames * like.channels * like.width)


def synthetic(seconds: float, rate: int = 24000) -> Pcm:
    """Un silence de la durée voulue : sert aux essais sans voix (aucun appel, aucun coût)."""
    return Pcm(rate, 1, 2, b"\x00" * (int(seconds * rate) * 2))


def write_wav(pcm: Pcm) -> bytes:
    header = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36 + len(pcm.data), b"WAVE", b"fmt ", 16, 1, pcm.channels, pcm.rate,
                         pcm.rate * pcm.channels * pcm.width, pcm.channels * pcm.width, pcm.width * 8, b"data", len(pcm.data))
    return header + pcm.data


def assemble(clips: list[Pcm]) -> tuple[Pcm, list[tuple[float, float]]]:
    """Met les phrases bout à bout. Rend la bande-son et, pour chaque phrase, son début et sa fin en secondes."""
    first = clips[0]
    if any((c.rate, c.channels, c.width) != (first.rate, first.channels, first.width) for c in clips):
        raise ValueError("Les phrases n'ont pas toutes le même format audio.")
    parts, spans, t = [silence(first, LEAD_IN)], [], LEAD_IN
    for i, clip in enumerate(clips):
        parts.append(clip.data)
        spans.append((t, t + clip.seconds))
        t += clip.seconds
        gap = TAIL if i == len(clips) - 1 else PAUSE
        parts.append(silence(first, gap))
        t += gap
    return Pcm(first.rate, first.channels, first.width, b"".join(parts)), spans
