import type { Query } from "../editorial/types.ts";

// Page d'un thème : chiffres réels et ce qui vit dans ce thème. Salons PUBLICS
// uniquement ; membres actifs = auteurs humains de publications ou commentaires du
// thème sur 30 jours (jamais l'agent, jamais un compte non actif ; un membre bloqué
// par le lecteur, ou qui le bloque, n'est pas mis en avant).

export interface ThemeOverview {
  followers: number;
  postsLast30: number;
  rooms: { id: string; name: string; description: string; members: number; recentMessages: number }[];
  members: { handle: string; displayName: string; contributions: number }[];
}

export async function themeOverview(q: Query, themeId: string, viewerId: string | null): Promise<ThemeOverview> {
  const [[counts], rooms, members] = await Promise.all([
    q<{ followers: number; posts: number }>(
      `SELECT (SELECT count(*)::int FROM theme_follows tf JOIN users u ON u.id = tf.user_id WHERE tf.theme_id = $1 AND u.status = 'active') AS followers,
              (SELECT count(*)::int FROM posts p JOIN post_themes pt ON pt.post_id = p.id
                 WHERE pt.theme_id = $1 AND p.status = 'published' AND p.created_at > now() - interval '30 days') AS posts`,
      [themeId],
    ),
    q(
      `SELECT r.id, r.name, r.description,
              (SELECT count(*)::int FROM room_members m WHERE m.room_id = r.id) AS members,
              (SELECT count(*)::int FROM room_messages msg WHERE msg.room_id = r.id AND msg.deleted_at IS NULL
                 AND msg.created_at > now() - interval '7 days') AS recent_messages
       FROM rooms r WHERE r.theme_id = $1 AND r.visibility = 'public' AND r.archived_at IS NULL
       ORDER BY recent_messages DESC, members DESC, r.created_at DESC LIMIT 5`,
      [themeId],
    ),
    q(
      `WITH contrib AS (
         SELECT p.author_id AS id FROM posts p JOIN post_themes pt ON pt.post_id = p.id
           WHERE pt.theme_id = $1 AND p.status = 'published' AND p.created_at > now() - interval '30 days'
         UNION ALL
         SELECT c.author_id FROM comments c JOIN post_themes pt ON pt.post_id = c.post_id
           WHERE pt.theme_id = $1 AND c.status = 'published' AND c.created_at > now() - interval '30 days'
       )
       SELECT u.handle, COALESCE(u.display_name, u.handle) AS display_name, count(*)::int AS n
       FROM contrib JOIN users u ON u.id = contrib.id
       WHERE u.role <> 'agent' AND u.status = 'active' AND u.handle IS NOT NULL
         AND ($2::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM user_blocks b
               WHERE (b.blocker_id = $2 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $2)))
       GROUP BY u.id, u.handle, u.display_name ORDER BY n DESC, u.handle LIMIT 6`,
      [themeId, viewerId],
    ),
  ]);
  return {
    followers: Number(counts?.followers ?? 0),
    postsLast30: Number(counts?.posts ?? 0),
    rooms: rooms.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string) ?? "",
      members: Number(r.members),
      recentMessages: Number(r.recent_messages),
    })),
    members: members.map((m) => ({ handle: m.handle as string, displayName: m.display_name as string, contributions: Number(m.n) })),
  };
}
