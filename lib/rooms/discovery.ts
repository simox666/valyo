import type { Query } from "../editorial/types.ts";

export interface RoomCard {
  id: string;
  name: string;
  description: string;
  themeName: string | null;
  visibility: string;
  archived: boolean;
  members: number;
  /** Activité des 7 derniers jours (messages), pour le tri de l'annuaire (décision §2). */
  recentMessages: number;
  lastMessageAt: string | null;
}

export const CARD_SELECT = `
  SELECT r.id, r.name, r.description, r.visibility, r.archived_at, t.name AS theme_name,
    (SELECT count(*)::int FROM room_members m WHERE m.room_id = r.id) AS members,
    (SELECT count(*)::int FROM room_messages msg WHERE msg.room_id = r.id AND msg.deleted_at IS NULL AND msg.created_at > now() - interval '7 days') AS recent_messages,
    (SELECT max(msg.created_at) FROM room_messages msg WHERE msg.room_id = r.id AND msg.deleted_at IS NULL) AS last_message_at
  FROM rooms r LEFT JOIN themes t ON t.id = r.theme_id`;

export function toCard(r: Record<string, unknown>): RoomCard {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    themeName: (r.theme_name as string) ?? null,
    visibility: r.visibility as string,
    archived: Boolean(r.archived_at),
    members: Number(r.members),
    recentMessages: Number(r.recent_messages),
    lastMessageAt: r.last_message_at ? new Date(r.last_message_at as string).toISOString() : null,
  };
}


// La découverte privée exige les mêmes droits de lecture que le chat : compte actif,
// inscription terminée, appartenance et absence de sanction de salon effective.
const membership = (v: string) => `EXISTS (SELECT 1 FROM room_members me JOIN users u ON u.id = me.user_id
  WHERE me.room_id = r.id AND me.user_id = ${v} AND u.status = 'active'
    AND u.handle IS NOT NULL AND u.rules_accepted_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM room_sanctions s WHERE s.room_id = r.id AND s.user_id = me.user_id
      AND s.lifted_at IS NULL AND ((s.kind = 'ban' AND (s.expires_at IS NULL OR s.expires_at > now()))
        OR (s.kind = 'kick' AND s.created_at > now() - interval '24 hours'))))`;

export type DiscussionCard = RoomCard & { unread: number };
export type LinkedRoom = RoomCard & { isMember: boolean };

export async function communityRooms(q: Query, viewerId: string | null) {
  const active = await q(`${CARD_SELECT} WHERE r.visibility = 'public' AND r.archived_at IS NULL
    AND EXISTS (SELECT 1 FROM room_messages msg WHERE msg.room_id = r.id AND msg.deleted_at IS NULL
      AND msg.created_at > now() - interval '7 days')
    ORDER BY recent_messages DESC, r.created_at DESC, r.id LIMIT 4`);
  const mine = viewerId ? await q(`${CARD_SELECT}
    JOIN room_members me ON me.room_id = r.id AND me.user_id = $1
    WHERE ${membership('$1')} ORDER BY r.archived_at IS NOT NULL, last_message_at DESC NULLS LAST, r.created_at DESC, r.id LIMIT 5`, [viewerId]) : [];
  // Compteur calculé dans la même requête que les droits et le repère : pas de cache partagé.
  const discussions: DiscussionCard[] = [];
  if (mine.length) {
    const unread = await q<{ room_id: string; n: number }>(`SELECT r.id AS room_id, count(msg.id)::int AS n FROM rooms r
      JOIN room_members me ON me.room_id = r.id AND me.user_id = $1
      LEFT JOIN room_messages msg ON msg.room_id = r.id AND msg.author_id <> $1 AND msg.deleted_at IS NULL AND msg.seq > me.last_read_seq
      WHERE r.id = ANY($2::uuid[]) AND ${membership('$1')} GROUP BY r.id`, [viewerId, mine.map(r => r.id)]);
    const counts = new Map(unread.map(r => [r.room_id, Number(r.n)]));
    // Si les droits disparaissent entre les deux lectures, aucune carte privée n'est rendue.
    for (const r of mine) if (counts.has(String(r.id))) discussions.push({ ...toCard(r), unread: counts.get(String(r.id))! });
  }
  return { active: active.map(toCard), discussions };
}

/** Une lecture pour tous les liens du fil, sans requête par publication. */
export async function linkedRooms(q: Query, postIds: string[], viewerId: string | null): Promise<Map<string, LinkedRoom[]>> {
  if (!postIds.length) return new Map();
  const rows = await q(`SELECT cards.*, rp.post_id FROM (${CARD_SELECT}) cards
    JOIN rooms r ON r.id = cards.id JOIN room_posts rp ON rp.room_id = r.id
    WHERE rp.post_id = ANY($1::uuid[]) AND (r.visibility = 'public' OR ${membership('$2')})
    ORDER BY cards.archived_at IS NOT NULL, cards.recent_messages DESC, cards.id`, [postIds, viewerId]);
  const members = viewerId ? await q<{ room_id: string }>(`SELECT r.id AS room_id FROM rooms r
    WHERE r.id = ANY($1::uuid[]) AND ${membership('$2')}`, [rows.map(r => r.id), viewerId]) : [];
  const ids = new Set(members.map(r => r.room_id));
  const result = new Map<string, LinkedRoom[]>();
  for (const r of rows) {
    if (r.visibility === 'private' && !ids.has(String(r.id))) continue;
    const key = String(r.post_id);
    result.set(key, [...(result.get(key) ?? []), { ...toCard(r), isMember: ids.has(String(r.id)) }]);
  }
  return result;
}
