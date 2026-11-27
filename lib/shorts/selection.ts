// Shorts quotidiens : choix des trois articles du jour. Uniquement des articles de presse publiés,
// jamais un texte de membre ; les plus récents et ceux qui ont le plus fait réagir d'abord ; jamais
// un article déjà utilisé dans une vidéo ; un thème différent par article quand c'est possible.

import type { Query } from "../editorial/types.ts";
import { isPromotional } from "../actus/sources.ts";

export const SHORT_NEWS = 3;

export interface ShortCandidate {
  postId: string;
  title: string;
  source: string;
  theme: string;
  themeSlug: string;
  /** Matière pour le script : la synthèse quand elle existe, sinon l'extrait de l'article. */
  text: string;
  score: number;
}

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Les articles candidats sur `hours` heures, les meilleurs d'abord. */
export async function shortCandidates(q: Query, now: Date, hours: number): Promise<ShortCandidate[]> {
  const rows = await q<{ id: string; title: string; source_name: string; body: string; theme: string | null; slug: string | null; content: { essentiel?: string; points?: string[] } | null; score: number }>(
    `SELECT p.id, p.title, p.source_name, p.body, s.content,
            (SELECT t.name FROM post_themes pt JOIN themes t ON t.id = pt.theme_id WHERE pt.post_id = p.id ORDER BY t.position LIMIT 1) AS theme,
            (SELECT t.slug FROM post_themes pt JOIN themes t ON t.id = pt.theme_id WHERE pt.post_id = p.id ORDER BY t.position LIMIT 1) AS slug,
            ((SELECT count(*) FROM comments c JOIN users u ON u.id = c.author_id WHERE c.post_id = p.id AND c.status = 'published' AND u.role <> 'agent') * 3
             + (SELECT count(*) FROM post_reactions r WHERE r.post_id = p.id))::int AS score
     FROM posts p LEFT JOIN post_syntheses s ON s.post_id = p.id AND s.status = 'ready'
     WHERE p.status = 'published' AND p.source_name IS NOT NULL
       AND p.created_at > $1::timestamptz - ($2::int * interval '1 hour') AND p.created_at <= $1::timestamptz
       AND NOT EXISTS (SELECT 1 FROM short_runs r WHERE p.id = ANY(r.post_ids))
     ORDER BY score DESC, (s.content IS NOT NULL) DESC, p.created_at DESC
     LIMIT 40`,
    [now.toISOString(), hours],
  );
  return rows
    .filter((r) => r.theme && r.slug && !isPromotional(r.title, "", ""))
    .map((r) => {
      const synthesis = r.content ? clean([r.content.essentiel, ...(r.content.points ?? [])].filter(Boolean).join(" "), 1400) : "";
      return { postId: r.id, title: clean(r.title, 300), source: r.source_name, theme: r.theme!, themeSlug: r.slug!, text: synthesis || clean(r.body.split("\n\n———\n\n")[0], 1400), score: r.score };
    })
    .filter((c) => c.text.length >= 150);
}

/** Trois articles, de thèmes différents tant que c'est possible, dans l'ordre de mérite. */
export function pickThree(candidates: readonly ShortCandidate[]): ShortCandidate[] {
  const picked: ShortCandidate[] = [];
  for (const c of candidates) if (picked.length < SHORT_NEWS && !picked.some((p) => p.themeSlug === c.themeSlug)) picked.push(c);
  for (const c of candidates) if (picked.length < SHORT_NEWS && !picked.includes(c)) picked.push(c);
  return picked;
}

/** Les trois articles du jour : dernières 24 heures d'abord, élargi à 48 puis 72 heures s'il en manque. */
export async function selectShort(q: Query, now: Date): Promise<ShortCandidate[]> {
  for (const hours of [24, 48, 72]) {
    const picked = pickThree(await shortCandidates(q, now, hours));
    if (picked.length === SHORT_NEWS) return picked;
  }
  return [];
}
