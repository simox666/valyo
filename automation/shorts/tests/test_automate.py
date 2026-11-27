"""Tests de l'automate, sans réseau : lancer « python -m unittest discover -s tests » depuis automation/shorts."""
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from valyo_shorts import audio, design, main, subtitles  # noqa: E402


class Sound(unittest.TestCase):
    def test_wav_sans_longueur(self):
        """Un WAV en flux (longueur inconnue dans l'en-tête) est lu jusqu'au bout."""
        pcm = audio.synthetic(1.5)
        raw = bytearray(audio.write_wav(pcm))
        raw[4:8] = struct.pack("<I", 0xFFFFFFFF)
        raw[40:44] = struct.pack("<I", 0xFFFFFFFF)
        self.assertAlmostEqual(audio.read_wav(bytes(raw)).seconds, 1.5, places=3)
        with self.assertRaises(ValueError):
            audio.read_wav(b"pas un wav du tout")

    def test_assemblage(self):
        track, spans = audio.assemble([audio.synthetic(2), audio.synthetic(3)])
        self.assertEqual(len(spans), 2)
        self.assertAlmostEqual(spans[0][0], audio.LEAD_IN, places=3)
        self.assertAlmostEqual(spans[1][0] - spans[0][1], audio.PAUSE, places=3)
        self.assertAlmostEqual(track.seconds, audio.LEAD_IN + 2 + audio.PAUSE + 3 + audio.TAIL, places=2)


class Subtitles(unittest.TestCase):
    def test_groupes(self):
        parts = subtitles.chunks("Une IA vient de résoudre des centaines de problèmes. Incroyable, non ?")
        self.assertEqual(" ".join(parts), "Une IA vient de résoudre des centaines de problèmes. Incroyable, non ?")
        self.assertTrue(all(len(p.split()) <= subtitles.MAX_WORDS + 1 for p in parts))
        self.assertTrue(parts[-1].endswith("?") and len(parts[-1]) > 1, "le point d'interrogation ne reste pas seul")
        self.assertIn("problèmes.", parts, "une ponctuation forte ferme le groupe")

    def test_minutage(self):
        timed = subtitles.timed("Un mot puis un autre, et la fin.", 10.0, 14.0)
        self.assertAlmostEqual(timed[0][0], 10.0)
        self.assertAlmostEqual(timed[-1][1], 14.0)
        for (_, end, _), (start, _, _) in zip(timed, timed[1:]):
            self.assertAlmostEqual(end, start)
        self.assertEqual(subtitles.timed("", 0, 1), [])


class Layout(unittest.TestCase):
    def test_coupures(self):
        self.assertEqual(design.glue("codé par 1 000 agents : vraiment ?"), "codé par 1 000 agents : vraiment ?")
        lines = design.wrap("Une IA sans IA : PyBot, codé par 1 000 agents", design.font("titre", 72), 800)
        self.assertFalse(any(line.startswith("000") or line.startswith(":") for line in lines))

    def test_texte_long_tient_dans_la_carte(self):
        f, lines = design.fit("Un titre volontairement très long pour vérifier que la taille diminue " * 2, "titre", 800, 5, (78, 60, 48))
        self.assertLessEqual(len(lines), 5)
        self.assertEqual(f.size, 48)

    def test_ecrans(self):
        items = [{"theme": "Espace", "themeSlug": "espace", "source": "NASA"}] * 3
        for image in (design.hook_scene("Accroche", items), design.news_scene(1, 3, items[0], "Un titre"), design.question_scene("Une question ?"), design.cta_scene(items)):
            self.assertEqual(image.width, design.CARD_W)
            self.assertLess(design.CARD_TOP + image.height, design.SUBTITLE_Y - 100, "l'écran ne recouvre pas les sous-titres")


class EndToEnd(unittest.TestCase):
    def test_video_hors_ligne(self):
        """Du plan d'exemple à la vidéo, sans aucun appel réseau : bonne taille, moins de 60 secondes."""
        plan = json.loads((ROOT / "exemple-plan.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp:
            path, seconds = main.build(plan, mute=True, out=Path(tmp) / "essai.mp4", log=lambda *_: None)
            self.assertTrue(20 < seconds < 60)
            self.assertGreater(path.stat().st_size, 200_000)
            self.assertEqual(path.read_bytes()[4:8], b"ftyp")


if __name__ == "__main__":
    unittest.main()
