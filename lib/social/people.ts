import type { Query } from "../editorial/types.ts";

// Listes de personnes : abonnés et abonnements d'un membre. Comptes supprimés exclus ;
// les membres que le lecteur a bloqués n'y figurent pas.

export interface PersonRow {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  isAgent: boolean;
  avatarId: string | null;
  /** Le lecteur suit cette personne. */
  followedByViewer: boolean;
  /** Cette personne suit le lecteur. */
  followsViewer: boolean;
}

/** Suggestion de contact pour l'autocomplétion des mentions « @ ». */
export interface ContactSuggestion {
  handle: string;
  displayName: string;
  avatarId: string | null;
  isAgent: boolean;
}

const like = (prefix: string) => prefix.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`) + "%";

/**
 * Contacts proposés quand on tape « @pseudo » : ses abonnements et abonnés
 * (les abonnements d'abord) — ou, dans un salon, ses membres, puisque seuls
 * eux peuvent y être notifiés. Jamais un compte bloqué dans un sens ou l'autre.
 */
export async function mentionSuggestions(
  q: Query,
  viewerId: string,
  prefix: string,
  roomId: string | null = null,
  limit = 6,
): Promise<ContactSuggestion[]> {
  const guards = `u.status = 'active' AND u.handle IS NOT NULL AND u.id <> $1
       AND NOT EXISTS (SELECT 1 FROM user_blocks b
                       WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))
       AND (u.handle LIKE $2 OR lower(u.display_name) LIKE $2)`;
  const rows = await q<{ handle: string; display_name: string | null; avatar_image_id: string | null; role: string }>(
    roomId
      ? `SELECT u.handle, u.display_name, u.avatar_image_id, u.role
         FROM room_members m JOIN users u ON u.id = m.user_id
         WHERE m.room_id = $4 AND ${guards}
           AND EXISTS (SELECT 1 FROM room_members v WHERE v.room_id = $4 AND v.user_id = $1)
         ORDER BY u.handle LIMIT $3`
      : `SELECT u.handle, u.display_name, u.avatar_image_id, u.role,
                EXISTS (SELECT 1 FROM member_follows f WHERE f.follower_id = $1 AND f.followee_id = u.id) AS suivi
         FROM users u
         WHERE ${guards}
           AND (EXISTS (SELECT 1 FROM member_follows f WHERE f.follower_id = $1 AND f.followee_id = u.id)
             OR EXISTS (SELECT 1 FROM member_follows f WHERE f.follower_id = u.id AND f.followee_id = $1))
         ORDER BY suivi DESC, u.handle LIMIT $3`,
    roomId ? [viewerId, like(prefix), limit, roomId] : [viewerId, like(prefix), limit],
  );
  return rows.map((r) => ({
    handle: r.handle,
    displayName: r.display_name || r.handle,
    avatarId: r.avatar_image_id ?? null,
    isAgent: r.role === "agent",
  }));
}

export async function followList(
  q: Query,
  memberId: string,
  direction: "followers" | "following",
  viewerId: string | null,
  limit = 300,
): Promise<PersonRow[]> {
  const join = direction === "followers" ? "f.follower_id = u.id AND f.followee_id = $1" : "f.followee_id = u.id AND f.follower_id = $1";
  const rows = await q<{ id: string; handle: string; display_name: string | null; bio: string | null; role: string; avatar_image_id: string | null; by_viewer: boolean; follows_viewer: boolean }>(
    `SELECT u.id, u.handle, u.display_name, u.bio, u.role, u.avatar_image_id,
            EXISTS (SELECT 1 FROM member_follows v WHERE v.follower_id = $2::uuid AND v.followee_id = u.id) AS by_viewer,
            EXISTS (SELECT 1 FROM member_follows v WHERE v.follower_id = u.id AND v.followee_id = $2::uuid) AS follows_viewer
     FROM member_follows f JOIN users u ON ${join}
     WHERE u.status <> 'deleted' AND u.handle IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = $2::uuid AND ub.blocked_id = u.id)
     ORDER BY f.created_at DESC
     LIMIT $3`,
    [memberId, viewerId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    displayName: r.display_name || r.handle,
    bio: r.bio ?? "",
    isAgent: r.role === "agent",
    avatarId: r.avatar_image_id ?? null,
    followedByViewer: Boolean(r.by_viewer),
    followsViewer: Boolean(r.follows_viewer),
  }));
}
