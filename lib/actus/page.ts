import { decodeEntities, extractPage, htmlToText } from "../editorial/extract.ts";

// Lecture d'une page d'article : accès libre ou non, image d'illustration de l'éditeur, texte.

/** Article réservé aux abonnés : balisage schema.org standard, ou mention explicite dans l'article. */
export function isPaywalled(html: string): boolean {
  if (/"isAccessibleForFree"\s*:\s*"?false"?/i.test(html)) return true;
  if (/<meta\b[^>]*isAccessibleForFree[^>]*content=["']false/i.test(html)) return true;
  const article = extractPage(html, 50_000).text;
  return /(réservée? aux abonnés|réservée? à nos abonnés|article réservé|abonnez-vous pour (lire|continuer)|pour lire la suite,? abonnez-vous)/i.test(article);
}

/** Image déclarée par l'éditeur pour le partage (og:image), en https uniquement. */
export function ogImage(html: string): string | null {
  const tag = /<meta\b[^>]*property=["']og:image(?::secure_url)?["'][^>]*>/i.exec(html)?.[0] ?? /<meta\b[^>]*name=["']twitter:image["'][^>]*>/i.exec(html)?.[0];
  const url = tag ? decodeEntities(/content=["']([^"']+)["']/i.exec(tag)?.[1] ?? "").trim() : "";
  return /^https:\/\//i.test(url) ? url : null;
}

const NOISE = /<(script|style|noscript|svg|nav|footer|aside|form|figure|button)\b[\s\S]*?<\/\1>/gi;
const paragraphsOf = (html: string) =>
  [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => htmlToText(m[1]))
    .filter((t) => t.length > 40)
    .join("\n\n");

export interface FullArticle {
  /** Texte intégral : intertitres et paragraphes dans l'ordre, puces pour les listes. */
  text: string;
  /** Auteurs et leur fonction, tels que signés par l'éditeur. */
  authors: { name: string; role: string }[];
}

const BODY_END = /class="[^"]*topic-list|<aside\b|<footer\b|class="[^"]*content-authors/i;

/**
 * Article complet d'une source sous licence libre (The Conversation : itemprop="articleBody").
 * Le texte est repris tel quel, sans réécriture (licence CC BY-ND : pas de modification).
 * null si le corps n'est pas trouvé : on garde alors l'extrait habituel.
 */
export function fullArticle(html: string): FullArticle | null {
  const start = html.search(/itemprop=["']articleBody["']/i);
  if (start < 0) return null;
  let body = html.slice(start);
  const end = body.search(BODY_END);
  if (end > 0) body = body.slice(0, end);
  body = body.replace(NOISE, " ").replace(/<div class="slot[\s\S]*?<\/div>\s*<\/div>/gi, " ");
  const parts: string[] = [];
  for (const m of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>|<(h2|h3|p|blockquote)\b[^>]*>([\s\S]*?)<\/\2>/gi)) {
    // Balises en ligne (liens, gras…) retirées sans espace : « services, dont » et non « services , dont ».
    const inner = (m[1] ?? m[3]).replace(/<\/?(a|strong|em|b|i|span|sup|sub|abbr|cite|mark|u)\b[^>]*>/gi, "");
    const text = htmlToText(inner).replace(/\s*\n\s*/g, " ").trim();
    if (!text) continue;
    parts.push(m[1] !== undefined ? `• ${text}` : m[2].toLowerCase() === "blockquote" ? `« ${text} »` : text);
  }
  const text = parts.join("\n\n").replace(/(• [^\n]+)\n\n(?=• )/g, "$1\n");
  if (text.length < 800) return null;
  const authors = [...html.matchAll(/itemprop=["']name["'][^>]*>([^<]+)<\/span>\s*<\/a>\s*<p class=["']role["']>\s*([\s\S]*?)<\/p>/gi)]
    .map((m) => ({ name: htmlToText(m[1]).trim(), role: htmlToText(m[2]).replace(/\s+/g, " ").trim() }))
    .filter((a) => a.name);
  if (!authors.length) {
    const meta = /<meta\b[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
    if (meta) authors.push({ name: decodeEntities(meta).trim(), role: "" });
  }
  return { text, authors };
}

/**
 * Texte du corps de l'article, pour la synthèse. Une page contient souvent plusieurs blocs
 * <article> (vignettes, articles liés) : on retient le plus long, puis ses paragraphes.
 * À défaut, les paragraphes de toute la page.
 */
export function articleText(html: string, maxChars = 14_000): string {
  const cleaned = html.replace(NOISE, " ");
  const blocks = [...cleaned.matchAll(/<article\b[\s\S]*?<\/article>/gi), ...cleaned.matchAll(/<main\b[\s\S]*?<\/main>/gi)].map((m) => m[0]);
  const candidates = [paragraphsOf(cleaned), ...blocks.map(paragraphsOf), ...blocks.map(htmlToText)];
  const inBlocks = blocks.map(paragraphsOf).sort((a, b) => b.length - a.length)[0] ?? "";
  // Les paragraphes du plus long bloc sont les plus propres ; sinon, le texte le plus long trouvé.
  const best = inBlocks.length >= 800 ? inBlocks : candidates.sort((a, b) => b.length - a.length)[0] ?? "";
  return best.slice(0, maxChars);
}
