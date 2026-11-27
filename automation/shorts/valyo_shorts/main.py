"""Fabrique le Short du jour. Lancement : voir le README.

  python -m valyo_shorts.main --dry-run          vidéo d'essai sur ta machine, rien d'envoyé, rien d'enregistré
  python -m valyo_shorts.main                    le Short du jour, envoyé par e-mail
  python -m valyo_shorts.main --plan fichier.json --voix muette    essai hors ligne, sans aucun appel
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import audio, client, design, subtitles, video

ROOT = Path(__file__).resolve().parents[1]
WORDS_PER_SECOND = 2.9   # débit estimé, pour les essais sans voix


def build(plan: dict, *, mute: bool, out: Path, log=print) -> tuple[Path, float]:
    script, items = plan["script"], plan["items"]
    lines = [script["hook"], *[n["spoken"] for n in script["news"]], script["question"], script["cta"]]

    log(f"Voix : {len(lines)} phrases{' (muettes, essai)' if mute else ''}…")
    clips = [audio.synthetic(max(1.2, len(line.split()) / WORDS_PER_SECOND)) if mute else audio.read_wav(client.voice(line)) for line in lines]
    soundtrack, spans = audio.assemble(clips)

    total = len(script["news"])
    images = [design.hook_scene(script["hook"], items)]
    images += [design.news_scene(i + 1, total, items[i], script["news"][i]["card"]) for i in range(total)]
    images += [design.question_scene(script["question"]), design.cta_scene(items)]
    # Un écran apparaît un rien avant sa phrase, et reste jusqu'au suivant.
    scenes = [(0.0 if i == 0 else spans[i][0] - 0.15, image) for i, image in enumerate(images)]
    subs = [chunk for line, (start, end) in zip(lines, spans) for chunk in subtitles.timed(line, start, end)]

    out.parent.mkdir(parents=True, exist_ok=True)
    log(f"Vidéo : {soundtrack.seconds:.1f} s, {int(soundtrack.seconds * video.FPS)} images…")
    seconds = video.render(out, day=plan["day"], scenes=scenes, subtitles=subs, soundtrack=soundtrack)
    return out, seconds


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fabrique le Short quotidien de Valyo.")
    parser.add_argument("--dry-run", action="store_true", help="essai : la vidéo est créée ici, rien n'est envoyé ni enregistré")
    parser.add_argument("--plan", type=Path, help="utiliser ce fichier JSON au lieu de demander le script au site")
    parser.add_argument("--voix", choices=["site", "muette"], default="site", help="« muette » : pas de voix, durées estimées (aucun coût)")
    parser.add_argument("--sortie", type=Path, default=ROOT / "out", help="dossier où écrire la vidéo")
    args = parser.parse_args(argv)
    client.load_env(ROOT / ".env")
    dry = args.dry_run or args.plan is not None or args.voix == "muette"

    try:
        plan = json.loads(args.plan.read_text(encoding="utf-8")) if args.plan else client.prepare(dry_run=dry)
        print(f"Short du {plan['day']} : {plan['script']['youtubeTitle']}")
        for item, news in zip(plan["items"], plan["script"]["news"]):
            print(f"  • [{item['theme']}] {news['card']} — {item['source']}")
        path, seconds = build(plan, mute=args.voix == "muette", out=args.sortie / f"valyo-short-{plan['day']}.mp4")
        (path.with_suffix(".json")).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Vidéo écrite : {path} ({seconds:.1f} s, {path.stat().st_size / 1e6:.1f} Mo)")
        if dry:
            print("Essai : rien n'a été envoyé ni enregistré.")
            return 0
        result = client.deliver(plan["day"], path.read_bytes())
        print(f"Envoyée par e-mail à {result.get('recipients', '?')} destinataire(s).")
        return 0
    except (client.ValyoError, ValueError, RuntimeError, OSError) as error:
        print(f"ÉCHEC : {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
