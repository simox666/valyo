import { activeContributor } from "../community-locks.ts";
import type { Query } from "../editorial/types.ts";

// Relais : republier une publication vers ses abonnés, avec son avis (facultatif, 500 caractères).
// Un seul relais par membre et par publication ; un second passage retire ou met à jour l'avis.
// Dans « Pour vous », les publications relayées par les membres suivis apparaissent avec un
// bandeau « Relayé par X ». L'auteur de la publication est notifié au premier relais.

export interface RelaySummary {
  count: number;
  mine: boolean;
  myNote: string;
}

export async function relaySummaries(q: Query, postIds: string[], viewerId: string | null): Promise<Map<string, RelaySummary>> {
  const result = new Map<string, RelaySummary>();
  for (const id of postIds) result.set(id, { count: 0, mine: false, myNote: "" });
  if (!postIds.length) return result;
  const rows = await q<{ post_id: string; n: number; mine: boolean; my_note: string | null }>(
    `SELECT post_id, count(*)::int AS n, bool_or(user_id = $2::uuid) AS mine,
            max(note) FILTER (WHERE user_id = $2::uuid) AS my_note
     FROM post_relays WHERE post_id = ANY($1::uuid[]) GROUP BY post_id`,
    [postIds, viewerId],
  );
  for (const r of rows) result.set(r.post_id, { count: Number(r.n), mine: Boolean(r.mine), myNote: r.my_note ?? "" });
  return result;
}

export interface FollowedRelay {
  name: string;
  handle: string;
  note: string;
  total: number;
}

/** Pour le fil : le relais le plus récent d'un membre SUIVI, avec son avis. */
export async function followedRelays(q: Query, postIds: string[], viewerId: string): Promise<Map<string, FollowedRelay>> {
  const result = new Map<string, FollowedRelay>();
  if (!postIds.length) return result;
  const rows = await q<{ post_id: string; display_name: string | null; handle: string; note: string }>(
    `SELECT r.post_id, u.display_name, u.handle, r.note
     FROM post_relays r
     JOIN member_follows f ON f.followee_id = r.user_id AND f.follower_id = $2
     JOIN users u ON u.id = r.user_id AND u.status = 'active'
     WHERE r.post_id = ANY($1::uuid[])
     ORDER BY r.post_id, r.created_at DESC`,
    [postIds, viewerId],
  );
  for (const r of rows) {
    const existing = result.get(r.post_id);
    if (existing) existing.total++;
    else result.set(r.post_id, { name: r.display_name || r.handle, handle: r.handle, note: r.note, total: 1 });
  }
  return result;
}

export type RelayOutcome = { ok: true; summary: RelaySummary } | { ok: false; status: number; message: string };

/** Relaie, met à jour l'avis ou retire le relais ; droits relus dans la transaction. */
export async function toggleRelay(q: Query, args: { userId: string; postId: string; on: boolean; note: string }): Promise<RelayOutcome> {
  if (!(await activeContributor(q, args.userId))) return { ok: false, status: 403, message: "Ce compte ne peut pas relayer pour le moment." };
  const [post] = await q<{ author_id: string; title: string }>(`SELECT author_id, title FROM posts WHERE id = $1 AND status = 'published'`, [args.postId]);
  if (!post) return { ok: false, status: 404, message: "Publication indisponible." };
  if (args.on) {
    const inserted = await q(
      `INSERT INTO post_relays (post_id, user_id, note) VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET note = EXCLUDED.note
       RETURNING (xmax = 0) AS new`,
      [args.postId, args.userId, args.note],
    );
    // Notification au premier relais seulement (pas à chaque retouche de l'avis),
    // jamais soi-même, jamais vers un compte inactif ou qui a bloqué le relayeur.
    if (inserted[0]?.new && post.author_id !== args.userId) {
      await q(
        `INSERT INTO notifications (user_id, kind, post_id, actor_id)
         SELECT $1, 'relay', $2, $3 FROM users u WHERE u.id = $1 AND u.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = $3)`,
        [post.author_id, args.postId, args.userId],
      );
    }
  } else {
    await q(`DELETE FROM post_relays WHERE post_id = $1 AND user_id = $2`, [args.postId, args.userId]);
  }
  const summary = (await relaySummaries(q, [args.postId], args.userId)).get(args.postId)!;
  return { ok: true, summary };
}
