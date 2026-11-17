import { XMLParser } from "fast-xml-parser";

// Analyse des flux RSS/Atom et extraction de texte des pages (contrat §3, §6).
// Les documents collectés sont des données non fiables : on n'en garde que du
// texte brut, limité, sans balisage.

export interface FeedItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: Date | null;
  /** Image d'illustration annoncée par le flux (enclosure, media:content/thumbnail, ou première image du résumé). */
  image?: string | null;
}

function feedImage(item: Record<string, any>): string | null {
  const candidates: unknown[] = [];
  for (const e of asArray(item.enclosure)) if (/^image\//.test(String(e?.["@_type"] ?? "")) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(String(e?.["@_url"] ?? ""))) candidates.push(e?.["@_url"]);
  for (const key of ["media:content", "media:thumbnail", "media:group"]) {
    for (const m of asArray(item[key])) {
      if (m?.["@_url"]) candidates.push(m["@_url"]);
      for (const inner of asArray(m?.["media:content"])) if (inner?.["@_url"]) candidates.push(inner["@_url"]);
    }
  }
  const html = textOf(item.description ?? item["content:encoded"] ?? item.content ?? item.summary);
  const img = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (img) candidates.push(img[1]);
  for (const c of candidates) {
    const url = String(c ?? "").trim();
    if (/^https:\/\//i.test(url)) return url;
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  hellip: "…", mdash: "—", ndash: "–", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", ccedil: "ç", ocirc: "ô", ucirc: "û", icirc: "î",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function normalizeSpace(text: string): string {
  return text.replace(/[ \t\f\v ]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Texte brut d'un fragment HTML : scripts, styles et balises retirés, entités décodées. */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return normalizeSpace(decodeEntities(withoutBlocks));
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const t = Date.parse(value.trim());
  return Number.isFinite(t) ? new Date(t) : null;
}

function textOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in (value as Record<string, unknown>)) return String((value as Record<string, unknown>)["#text"]);
  return "";
}

const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function parseFeed(xml: string): FeedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: true,
    htmlEntities: false,
    trimValues: true,
    // Aucune entité externe n'est résolue par cet analyseur ; la taille est déjà bornée par le transport.
  });
  const doc = parser.parse(xml) as Record<string, any>;
  const items: FeedItem[] = [];
  if (doc.rss?.channel) {
    for (const item of asArray(doc.rss.channel.item)) {
      items.push({
        title: htmlToText(textOf(item.title)),
        link: textOf(item.link).trim(),
        summary: htmlToText(textOf(item.description)),
        publishedAt: parseDate(textOf(item.pubDate)) ?? parseDate(textOf(item["dc:date"])),
        image: feedImage(item),
      });
    }
  } else if (doc.feed) {
    for (const entry of asArray(doc.feed.entry)) {
      const links = asArray(entry.link) as Record<string, string>[];
      const link = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
      items.push({
        title: htmlToText(textOf(entry.title)),
        link: (link?.["@_href"] ?? "").trim(),
        summary: htmlToText(textOf(entry.summary ?? entry.content)),
        publishedAt: parseDate(textOf(entry.published)) ?? parseDate(textOf(entry.updated)),
        image: feedImage(entry),
      });
    }
  } else {
    throw new Error("Format de flux non reconnu (RSS 2.0 ou Atom attendu)");
  }
  return items.filter((i) => i.title || i.link);
}

export interface ExtractedPage {
  text: string;
  canonicalUrl: string | null;
  publishedAt: Date | null;
  truncated: boolean;
}

export const MAX_EXTRACTED_CHARS = 20_000;

/** Contenu principal d'une page (balise article ou main si présente), tronqué. */
export function extractPage(html: string, maxChars = MAX_EXTRACTED_CHARS): ExtractedPage {
  const canonical = /<link\b[^>]*rel=["']canonical["'][^>]*>/i.exec(html)?.[0];
  const canonicalUrl = canonical ? (/href=["']([^"']+)["']/i.exec(canonical)?.[1] ?? null) : null;
  const meta = /<meta\b[^>]*property=["']article:published_time["'][^>]*>/i.exec(html)?.[0];
  const publishedAt = meta ? parseDate(/content=["']([^"']+)["']/i.exec(meta)?.[1]) : null;
  const main = /<article\b[\s\S]*?<\/article>/i.exec(html)?.[0] ?? /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ?? html;
  const full = htmlToText(main);
  return {
    text: full.slice(0, maxChars),
    canonicalUrl: canonicalUrl ? decodeEntities(canonicalUrl) : null,
    publishedAt,
    truncated: full.length > maxChars,
  };
}

// Instructions adressées à un agent dans un document collecté (decisions.md §3.4,
// recette R23). Détection volontairement large : en cas de doute, examen humain.
const SUSPICIOUS = [
  /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all)\b[^.\n]{0,20}\binstructions?\b/i,
  /\bignorez?\b[^.\n]{0,40}\b(instructions|consignes)\b/i,
  /\b(system prompt|prompt système|invite système)\b/i,
  /\byou are (now )?(an? )?(ai|assistant|agent|language model|llm)\b/i,
  /\b(as an? (ai|llm|language model)|en tant qu['’]ia)\b/i,
  /\b(instructions?|note|message) (to|for|à|pour) (the |l['’])?(ai|assistant|agent|llm|ia|modèle)\b/i,
  /<\/?(system|assistant|instructions?)>/i,
];

export function hasSuspiciousInstructions(text: string): boolean {
  return SUSPICIOUS.some((re) => re.test(text));
}
