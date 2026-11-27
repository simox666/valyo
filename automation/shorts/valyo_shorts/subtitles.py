"""Sous-titres : la phrase est découpée en petits groupes de mots, affichés l'un après l'autre.

Le service de voix ne donne pas l'instant de chaque mot. Le temps de la phrase est donc réparti
entre les groupes selon leur longueur, avec un petit supplément après la ponctuation : assez
précis pour des groupes de deux ou trois mots.
"""
from __future__ import annotations

MAX_CHARS = 16   # largeur d'un groupe à l'écran
MAX_WORDS = 3


def chunks(sentence: str) -> list[str]:
    """Groupes de un à trois mots ; une ponctuation forte ferme toujours le groupe."""
    out: list[str] = []
    current: list[str] = []
    for word in sentence.split():
        candidate = " ".join(current + [word])
        if current and (len(candidate) > MAX_CHARS or len(current) >= MAX_WORDS):
            out.append(" ".join(current))
            current = []
        current.append(word)
        if word[-1] in ".,;:!?…":
            out.append(" ".join(current))
            current = []
    if current:
        out.append(" ".join(current))
    # « : », « ? », « ! » seuls (ponctuation française détachée) rejoignent le groupe précédent.
    merged: list[str] = []
    for chunk in out:
        if merged and chunk.strip(":;!?»") == "":
            merged[-1] += " " + chunk
        else:
            merged.append(chunk)
    return merged


def weight(chunk: str) -> float:
    letters = sum(1 for c in chunk if c.isalnum())
    pause = 2.5 if chunk[-1] in ".!?…" else 1.2 if chunk[-1] in ",;:" else 0
    return max(2.0, letters) + pause


def timed(sentence: str, start: float, end: float) -> list[tuple[float, float, str]]:
    """(début, fin, texte) pour chaque groupe, dans l'intervalle où la phrase est dite."""
    parts = chunks(sentence)
    if not parts:
        return []
    total = sum(weight(p) for p in parts)
    out, t = [], start
    for part in parts:
        length = (end - start) * weight(part) / total
        out.append((t, t + length, part))
        t += length
    return out
