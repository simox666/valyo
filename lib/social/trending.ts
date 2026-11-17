import type { Query } from "../editorial/types.ts";

// « Tendances » : ce qui fait réagir la communauté sur 3 jours (commentaires ×3 + réactions).
// Activité réelle uniquement ; rien n'est affiché tant que personne n'a réagi.
export async function trendingPosts(q: Query, limit = 5): Promise<{ id: string; title: string; theme: string | null; score: number; comments: number }[]> {
  const rows = await q(
    `SELECT p.id, p.title,
            (SELECT t.name FROM post_themes pt JOIN themes t ON t.id = pt.theme_id WHERE pt.post_id = p.id ORDER BY t.position LIMIT 1) AS theme,
            (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.status = 'published') AS comments,
            (SELECT count(*)::int FROM post_reactions r WHERE r.post_id = p.id) AS reactions
     FROM posts p
     WHERE p.status = 'published' AND p.created_at > now() - interval '3 days'`,
  );
  return rows
    .map((r) => ({ id: r.id as string, title: r.title as string, theme: (r.theme as string) ?? null, comments: Number(r.comments), score: Number(r.comments) * 3 + Number(r.reactions) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
