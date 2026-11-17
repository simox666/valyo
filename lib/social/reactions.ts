import { activeContributor } from "../community-locks.ts";
import type { Query } from "../editorial/types.ts";

// Réactions rapides sous les publications. Trois sortes, pensées pour une communauté
// tech/science plutôt qu'un simple « j'aime ». Une de chaque sorte par membre et par
// publication ; un second clic retire la réaction. Comptes réels, aucune simulation.

export { REACTIONS, REACTION_KINDS } from "./reaction-kinds.ts";
export type { ReactionKind, ReactionSummary } from "./reaction-kinds.ts";
import type { ReactionKind, ReactionSummary } from "./reaction-kinds.ts";

const empty = (): Record<ReactionKind, number> => ({ interessant: 0, appris: 0, a_creuser: 0 });

/** Résumés pour plusieurs publications en une requête (fil, profil). */
export async function reactionSummaries(q: Query, postIds: string[], viewerId: string | null): Promise<Map<string, ReactionSummary>> {
  const result = new Map<string, ReactionSummary>();
  for (const id of postIds) result.set(id, { counts: empty(), mine: [] });
  if (!postIds.length) return result;
  const rows = await q<{ post_id: string; kind: ReactionKind; n: number; mine: boolean }>(
    `SELECT post_id, kind, count(*)::int AS n, bool_or(user_id = $2::uuid) AS mine
     FROM post_reactions WHERE post_id = ANY($1::uuid[]) GROUP BY post_id, kind`,
    [postIds, viewerId],
  );
  for (const r of rows) {
    const s = result.get(r.post_id);
    if (!s) continue;
    s.counts[r.kind] = Number(r.n);
    if (r.mine) s.mine.push(r.kind);
  }
  return result;
}

export interface FollowedReactions {
  /** Jusqu'à deux prénoms de membres suivis qui ont réagi, le plus récent d'abord. */
  names: string[];
  total: number;
}

/**
 * « Vos abonnements ont réagi » : pour chaque publication, les membres SUIVIS par le lecteur
 * qui y ont réagi (preuve sociale du fil ; données déjà publiques via les compteurs).
 */
export async function followedReactions(q: Query, postIds: string[], viewerId: string): Promise<Map<string, FollowedReactions>> {
  const result = new Map<string, FollowedReactions>();
  if (!postIds.length) return result;
  const rows = await q<{ post_id: string; display_name: string | null; handle: string }>(
    `SELECT r.post_id, u.display_name, u.handle, max(r.created_at) AS latest
     FROM post_reactions r
     JOIN member_follows f ON f.followee_id = r.user_id AND f.follower_id = $2
     JOIN users u ON u.id = r.user_id AND u.status = 'active'
     WHERE r.post_id = ANY($1::uuid[])
     GROUP BY r.post_id, u.id, u.display_name, u.handle
     ORDER BY r.post_id, latest DESC`,
    [postIds, viewerId],
  );
  for (const r of rows) {
    const entry = result.get(r.post_id) ?? { names: [], total: 0 };
    entry.total++;
    if (entry.names.length < 2) entry.names.push(r.display_name || r.handle);
    result.set(r.post_id, entry);
  }
  return result;
}

export type ToggleOutcome = { ok: true; summary: ReactionSummary } | { ok: false; status: number; message: string };

/** Ajoute ou retire une réaction ; droits relus dans la transaction (compte actif, publication visible). */
export async function toggleReaction(q: Query, args: { userId: string; postId: string; kind: ReactionKind; on: boolean }): Promise<ToggleOutcome> {
  if (!(await activeContributor(q, args.userId))) return { ok: false, status: 403, message: "Ce compte ne peut pas réagir pour le moment." };
  const [post] = await q(`SELECT id FROM posts WHERE id = $1 AND status = 'published'`, [args.postId]);
  if (!post) return { ok: false, status: 404, message: "Publication indisponible." };
  if (args.on) {
    await q(`INSERT INTO post_reactions (post_id, user_id, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [args.postId, args.userId, args.kind]);
  } else {
    await q(`DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND kind = $3`, [args.postId, args.userId, args.kind]);
  }
  const summary = (await reactionSummaries(q, [args.postId], args.userId)).get(args.postId)!;
  return { ok: true, summary };
}
