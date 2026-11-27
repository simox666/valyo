"""Mise en page des écrans, aux couleurs et polices du site (papier quadrillé, encre bleu nuit, orange).

Chaque écran est une image fixe dessinée une fois ; la vidéo les anime ensuite (video.py).
Aucune image d'article n'est utilisée : seulement du texte, des cases façon tableau périodique et le logo.
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
PAPER, GRID, INK = (247, 247, 243), (232, 232, 224), (27, 36, 48)
ACCENT, ACCENT_SOFT, MUTED, LINE, WHITE = (194, 65, 12), (251, 238, 230), (95, 104, 115), (222, 222, 214), (255, 255, 255)
FONTS = Path(__file__).resolve().parents[3] / "app" / "fonts"
MARGIN = 72
CARD_TOP, CARD_W = 400, W - 2 * MARGIN
SUBTITLE_Y = 1440   # centre des sous-titres : au-dessus de la zone que YouTube recouvre en bas

# Numéro et symbole de chaque thème, comme sur les cases du site.
ELEMENTS = {"ia": (1, "Ia"), "robotique": (2, "Ro"), "espace": (3, "Es"), "sciences": (4, "Sc"), "tech": (5, "Te"), "sante": (6, "Sa"),
            "climat": (7, "Cl"), "energie": (8, "En"), "physique": (9, "Ph"), "biologie": (10, "Bi"), "cyber": (11, "Cy")}
SHORT_NAMES = {"ia": "IA", "tech": "Tech", "sante": "Santé", "climat": "Climat", "physique": "Physique", "biologie": "Biologie", "cyber": "Cyber"}
MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


@lru_cache(maxsize=None)
def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    """kind : « titre » (IBM Plex Mono gras), « texte », « texte-gras » (Inter), « mono » (Martian Mono)."""
    if kind == "titre":
        return ImageFont.truetype(str(FONTS / "IBMPlexMono-700.woff2"), size)
    f = ImageFont.truetype(str(FONTS / ("MartianMono-Variable.woff2" if kind == "mono" else "Inter-Variable.woff2")), size)
    target = {"texte": 450, "texte-gras": 800, "mono": 500}[kind]
    try:
        axes = f.get_variation_axes()
        f.set_variation_by_axes([max(a["minimum"], min(a["maximum"], target)) if "eight" in str(a.get("name", "")) or a.get("minimum", 0) >= 100 and a.get("maximum", 0) >= 700 else a["default"] for a in axes])
    except (OSError, AttributeError):
        pass  # police non variable : on garde sa graisse
    return f


def glue(text: str) -> str:
    """Espaces insécables là où le français n'admet pas de coupure : « 1 000 », et avant « ? ! : ; »."""
    text = re.sub(r"(?<=\d) (?=\d{3}(?!\d))", "\u00a0", text)
    return re.sub(r" (?=[?!:;»])", "\u00a0", text)


def wrap(text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, current = [], ""
    for word in glue(text).split(" "):
        if not word:
            continue
        trial = f"{current} {word}".strip()
        if current and f.getlength(trial) > width:
            lines.append(current)
            current = word
        else:
            current = trial
    return lines + [current] if current else lines


def fit(text: str, kind: str, width: int, max_lines: int, sizes: tuple[int, ...]) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """La plus grande taille qui fait tenir le texte dans la largeur et le nombre de lignes voulus."""
    for size in sizes:
        f = font(kind, size)
        lines = wrap(text, f, width)
        if len(lines) <= max_lines and all(f.getlength(line) <= width for line in lines):
            return f, lines
    f = font(kind, sizes[-1])
    return f, wrap(text, f, width)[:max_lines]


def spaced(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, f: ImageFont.FreeTypeFont, fill, tracking: float = 0.06) -> int:
    """Petites capitales espacées, comme les étiquettes du site. Rend l'abscisse de fin."""
    x, y = xy
    for ch in text.upper():
        draw.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch) + f.size * tracking
    return int(x)


def paragraph(draw: ImageDraw.ImageDraw, xy: tuple[int, int], lines: list[str], f: ImageFont.FreeTypeFont, fill, leading: float = 1.22) -> int:
    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=f, fill=fill)
        y += int(f.size * leading)
    return y


def grid_background() -> Image.Image:
    """Papier quadrillé, un peu plus grand que l'écran pour pouvoir le faire glisser lentement."""
    img = Image.new("RGB", (W + 72, H + 72), PAPER)
    d = ImageDraw.Draw(img)
    for x in range(0, W + 73, 72):
        d.line([(x, 0), (x, H + 72)], fill=GRID, width=2)
    for y in range(0, H + 73, 72):
        d.line([(0, y), (W + 72, y)], fill=GRID, width=2)
    return img


def tile(slug: str, name: str, size: int = 200, active: bool = False) -> Image.Image:
    """Une case de thème façon tableau périodique : numéro, symbole, nom."""
    n, symbol = ELEMENTS.get(slug, (0, name[:2].capitalize()))
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    back, ink, soft = (ACCENT, WHITE, WHITE) if active else (WHITE, INK, MUTED)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 12, fill=back, outline=None if active else MUTED, width=3)
    pad = size // 9
    d.text((pad, pad - 4), str(n or "·"), font=font("mono", size // 7), fill=soft)
    d.text((pad, size * 0.26), symbol, font=font("titre", int(size * 0.44)), fill=ink)
    label = font("texte", size // 8)
    short = SHORT_NAMES.get(slug) or (name if label.getlength(name) <= size - 2 * pad else name.split(" ")[0])
    d.text((pad, size - pad - size // 8 - 4), short, font=label, fill=ink)
    return img


def header(day: str) -> Image.Image:
    """Bandeau fixe : logo, date, nom de la rubrique."""
    img = Image.new("RGBA", (W, 330), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((MARGIN, 96), "Valyo", font=font("titre", 84), fill=INK)
    year, month, dd = day.split("-")
    date = f"{int(dd)} {MONTHS[int(month) - 1]} {year}"
    f = font("mono", 30)
    d.text((W - MARGIN - f.getlength(date), 130), date, font=f, fill=MUTED)
    spaced(d, (MARGIN, 224), "Les 3 news science & IA du jour", font("mono", 32), ACCENT)
    return img


def _card(height: int, fill=WHITE, outline=LINE) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (CARD_W, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, CARD_W - 1, height - 1], radius=28, fill=fill, outline=outline, width=3)
    return img, d


def hook_scene(hook: str, items: list[dict]) -> Image.Image:
    img, d = _card(880)
    d.rectangle([0, 60, 9, 820], fill=ACCENT)
    f, lines = fit(hook, "titre", CARD_W - 128, 6, (92, 84, 76, 68, 60))
    y = paragraph(d, (64, 70), lines, f, INK)
    x = 64
    for item in items:
        img.alpha_composite(tile(item["themeSlug"], item["theme"], 190), (x, max(y + 50, 880 - 190 - 64)))
        x += 190 + 28
    return img


def news_scene(index: int, total: int, item: dict, card_title: str) -> Image.Image:
    img, d = _card(900)
    img.alpha_composite(tile(item["themeSlug"], item["theme"], 220, active=True), (64, 64))
    spaced(d, (316, 86), f"News {index} / {total}", font("mono", 34), ACCENT)
    d.text((316, 150), item["theme"], font=font("texte-gras", 44), fill=INK)
    f, lines = fit(card_title, "titre", CARD_W - 128, 5, (78, 72, 66, 60, 54, 48))
    y = paragraph(d, (64, 350), lines, f, INK)
    d.line([(64, 900 - 132), (CARD_W - 64, 900 - 132)], fill=LINE, width=3)
    source, sf = f"Source : {item['source']}", font("texte", 40)
    while sf.getlength(source) > CARD_W - 128 and len(source) > 12:
        source = source[:-2].rstrip() + "…"
    d.text((64, 900 - 100), source, font=sf, fill=MUTED)
    return img


def question_scene(question: str) -> Image.Image:
    img, d = _card(820, fill=ACCENT_SOFT, outline=ACCENT)
    spaced(d, (64, 76), "La question du jour", font("mono", 36), ACCENT)
    f, lines = fit(question, "titre", CARD_W - 128, 7, (84, 76, 68, 60, 54))
    paragraph(d, (64, 170), lines, f, INK)
    return img


def cta_scene(items: list[dict]) -> Image.Image:
    img, d = _card(900, fill=INK, outline=INK)
    paragraph(d, (64, 90), ["Rejoins", "le débat sur"], font("titre", 96), WHITE)
    d.text((64, 350), "valyo.si", font=font("titre", 150), fill=(255, 122, 61))
    paragraph(d, (64, 580), wrap("Le réseau social des passionnés de tech et de sciences.", font("texte", 44), CARD_W - 128), font("texte", 44), (201, 206, 214), 1.3)
    x = 64
    for item in items:
        img.alpha_composite(tile(item["themeSlug"], item["theme"], 130), (x, 900 - 130 - 56))
        x += 130 + 20
    return img


def subtitle(text: str) -> Image.Image:
    """Un groupe de mots, blanc sur pastille bleu nuit : lisible sur n'importe quel écran derrière."""
    f = font("texte-gras", 78)
    while f.getlength(text) > W - 2 * MARGIN - 96 and f.size > 44:
        f = font("texte-gras", f.size - 6)
    width, height = int(f.getlength(text)) + 96, int(f.size * 1.2) + 56
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, width - 1, height - 1], radius=26, fill=INK)
    d.text((48, 24), text, font=f, fill=WHITE)
    return img
