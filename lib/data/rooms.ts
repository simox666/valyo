import "server-only";
import { db, query, queryOne } from "../db";
import { canDiscoverRoom, canManageRoom, canModerateRoom, canReadRoom, loadAccess, type RoomAccess, type RoomViewer } from "../rooms/permissions.ts";

// Lectures des salons (lot d'accélération B14, B15). Aucune fuite : un salon privé
// n'apparaît (nom, membres, extraits, appartenance) qu'à ses propres membres.

export type { RoomCard } from "../rooms/discovery.ts";
import { CARD_SELECT, toCard, linkedRooms, type RoomCard, type LinkedRoom } from "../rooms/discovery.ts";

/** Annuaire : salons PUBLICS uniquement, triés par activité des 7 derniers jours puis par création. */
export async function listPublicRooms(limit = 50): Promise<RoomCard[]> {
  const rows = await query(`${CARD_SELECT} WHERE r.visibility = 'public' ORDER BY recent_messages DESC, r.created_at DESC LIMIT $1`, [limit]);
  return rows.map(toCard);
}

/** « Mes salons » : toutes les appartenances du membre, privées comprises (visibles de lui seul). */
export async function listMyRooms(userId: string): Promise<(RoomCard & { role: string; following: boolean; unread: number })[]> {
  const rows = await query(
    `${CARD_SELECT} JOIN room_members me ON me.room_id = r.id AND me.user_id = $1 ORDER BY recent_messages DESC, r.created_at DESC`,
    [userId],
  );
  const memberships = await query<{ room_id: string; role: string; following: boolean; unread: number }>(
    `SELECT me.room_id, me.role, me.following,
      (SELECT count(*)::int FROM room_messages msg WHERE msg.room_id = me.room_id AND msg.author_id <> $1
       AND msg.deleted_at IS NULL AND msg.seq > me.last_read_seq) AS unread
     FROM room_members me WHERE me.user_id = $1`,
    [userId],
  );
  const byRoom = new Map(memberships.map((m) => [m.room_id, m]));
  return rows.map((r) => ({ ...toCard(r), role: byRoom.get(r.id as string)?.role ?? "member", following: Boolean(byRoom.get(r.id as string)?.following), unread: Number(byRoom.get(r.id as string)?.unread ?? 0) }));
}

/** Salons PUBLICS associés à une publication (au plus 3 affichés sous la publication, décision §2), plus les privés du lecteur. */
export async function roomsForPost(postId: string, viewerId: string | null, limit = 3): Promise<{ rooms: LinkedRoom[]; total: number }> {
  const rooms = (await linkedRooms(query, [postId], viewerId)).get(postId) ?? [];
  return { rooms: rooms.slice(0, limit), total: rooms.length };
}

export interface RoomMemberView {
  userId: string;
  handle: string | null;
  displayName: string;
  role: string;
}

export interface RoomView {
  access: RoomAccess;
  card: RoomCard;
  postIds: string[];
  /** Membres : seulement pour les membres du salon. */
  members: RoomMemberView[] | null;
  following: boolean;
  openTransferForViewer: { id: string } | null;
  canRead: boolean;
  canManage: boolean;
  canModerate: boolean;
}

/** Page d'un salon. Null si le salon n'existe pas OU si un salon privé est demandé par un non-membre (aucune fuite). */
export async function getRoomView(roomId: string, viewer: RoomViewer | null): Promise<RoomView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(roomId)) return null;
  const access = await loadAccess(db.query, roomId, viewer);
  if (!access.room || !canDiscoverRoom(access)) return null;
  const [cardRow] = await query(`${CARD_SELECT} WHERE r.id = $1`, [roomId]);
  const postLinks = await query<{ post_id: string }>(
    `SELECT rp.post_id FROM room_posts rp JOIN posts p ON p.id = rp.post_id AND p.status = 'published' WHERE rp.room_id = $1`,
    [roomId],
  );
  const isMember = Boolean(access.membership);
  const members = isMember
    ? (
        await query(
          `SELECT m.user_id, m.role, u.handle, u.display_name FROM room_members m JOIN users u ON u.id = m.user_id
           WHERE m.room_id = $1 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, m.joined_at`,
          [roomId],
        )
      ).map((m) => ({
        userId: m.user_id as string,
        handle: (m.handle as string) ?? null,
        displayName: (m.display_name as string) ?? "Membre supprimé",
        role: m.role as string,
      }))
    : null;
  const following = isMember
    ? Boolean((await queryOne<{ following: boolean }>(`SELECT following FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, viewer!.id]))?.following)
    : false;
  const openTransfer = viewer
    ? await queryOne<{ id: string }>(
        `SELECT id FROM room_transfers WHERE room_id = $1 AND to_user_id = $2 AND accepted_at IS NULL AND declined_at IS NULL AND cancelled_at IS NULL AND expires_at > now()`,
        [roomId, viewer.id],
      )
    : null;
  return {
    access,
    card: toCard(cardRow),
    postIds: postLinks.map((p) => p.post_id),
    members,
    following,
    openTransferForViewer: openTransfer ?? null,
    canRead: canReadRoom(access),
    canManage: canManageRoom(access),
    canModerate: canModerateRoom(access),
  };
}
