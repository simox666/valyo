import type { Query, Row } from "../editorial/types.ts";

// Notifications persistantes (lot d'accélération D29, D30 ; spec F14 partielle).
// - Déclencheurs livrés : réponse à sa publication ou à son commentaire, nouveau
//   message dans un salon SUIVI. Vocal : rien tant que le vrai vocal n'existe pas.
// - Jamais d'auto-notification ; jamais de notification vers quelqu'un qui a bloqué l'auteur.
// - Les messages d'un même salon sont REGROUPÉS : une notification non lue par salon,
//   avec compteur (index unique partiel).
// - Perte d'accès à un salon (départ, exclusion, bannissement) : les notifications du
//   salon sont SUPPRIMÉES pour ce membre ; l'URL directe ne donne de toute façon aucun accès.

async function blocks(q: Query, recipientId: string, actorId: string): Promise<boolean> {
  const rows = await q(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [recipientId, actorId]);
  return rows.length > 0;
}

/** Réponse à une publication ou à un commentaire. À appeler dans la transaction de création du commentaire. */
export async function notifyReply(
  q: Query,
  args: { recipientId: string; actorId: string; postId: string; commentId: string },
): Promise<boolean> {
  if (args.recipientId === args.actorId) return false;
  const [recipient] = await q<{ status: string }>(`SELECT status FROM users WHERE id = $1`, [args.recipientId]);
  if (!recipient || recipient.status !== "active") return false;
  if (await blocks(q, args.recipientId, args.actorId)) return false;
  await q(`INSERT INTO notifications (user_id, kind, post_id, comment_id, actor_id) VALUES ($1, 'reply', $2, $3, $4)`, [
    args.recipientId,
    args.postId,
    args.commentId,
    args.actorId,
  ]);
  return true;
}

/** Réponse retenue comme meilleure réponse d'une question : notifie son auteur. */
export async function notifyBestAnswer(
  q: Query,
  args: { recipientId: string; actorId: string; postId: string; commentId: string },
): Promise<boolean> {
  if (args.recipientId === args.actorId) return false;
  const [recipient] = await q<{ status: string }>(`SELECT status FROM users WHERE id = $1`, [args.recipientId]);
  if (!recipient || recipient.status !== "active") return false;
  if (await blocks(q, args.recipientId, args.actorId)) return false;
  await q(`INSERT INTO notifications (user_id, kind, post_id, comment_id, actor_id) VALUES ($1, 'best_answer', $2, $3, $4)`, [
    args.recipientId,
    args.postId,
    args.commentId,
    args.actorId,
  ]);
  return true;
}

/** Nouveau message : notifie les SUIVEURS du salon (pas tous les membres), regroupé par salon. */
export async function notifyRoomMessage(q: Query, roomId: string, authorId: string): Promise<number> {
  const followers = await q<{ user_id: string }>(
    `SELECT m.user_id FROM room_members m JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $1 AND m.following AND m.user_id <> $2 AND u.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = m.user_id AND b.blocked_id = $2)`,
    [roomId, authorId],
  );
  for (const f of followers) {
    await q(
      `INSERT INTO notifications (user_id, kind, room_id, actor_id) VALUES ($1, 'room_message', $2, $3)
       ON CONFLICT (user_id, room_id) WHERE kind = 'room_message' AND read_at IS NULL
       DO UPDATE SET count = notifications.count + 1, actor_id = EXCLUDED.actor_id, updated_at = now()`,
      [f.user_id, roomId, authorId],
    );
  }
  return followers.length;
}

/** Perte d'accès à un salon (D30) : plus aucune référence privée dans les notifications. */
export async function purgeRoomNotifications(q: Query, roomId: string, userId: string) {
  await q(`DELETE FROM notifications WHERE user_id = $1 AND room_id = $2`, [userId, roomId]);
}

export interface NotificationView {
  id: string;
  kind: "reply" | "room_message" | "moderation" | "mention" | "best_answer" | "relay";
  postId: string | null;
  commentId: string | null;
  roomId: string | null;
  roomName: string | null;
  postTitle: string | null;
  actorName: string | null;
  /** Décision de modération : le motif complet (ACC09), jamais le nom d'un signalant. */
  body: string | null;
  count: number;
  updatedAt: string;
  read: boolean;
}

export async function listNotifications(q: Query, userId: string, limit = 50): Promise<NotificationView[]> {
  const rows = await q(
    `SELECT n.*, r.name AS room_name, p.title AS post_title, u.display_name AS actor_name
     FROM notifications n
     LEFT JOIN rooms r ON r.id = n.room_id
     LEFT JOIN posts p ON p.id = n.post_id
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1 ORDER BY n.read_at IS NOT NULL, n.updated_at DESC LIMIT $2`,
    [userId, Math.min(limit, 100)],
  );
  return rows.map((n: Row) => ({
    id: n.id as string,
    kind: n.kind as NotificationView["kind"],
    body: (n.body as string) ?? null,
    postId: (n.post_id as string) ?? null,
    commentId: (n.comment_id as string) ?? null,
    roomId: (n.room_id as string) ?? null,
    roomName: (n.room_name as string) ?? null,
    postTitle: (n.post_title as string) ?? null,
    actorName: (n.actor_name as string) ?? null,
    count: Number(n.count),
    updatedAt: new Date(n.updated_at as string).toISOString(),
    read: Boolean(n.read_at),
  }));
}

export async function unreadNotificationCount(q: Query, userId: string): Promise<number> {
  const [row] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [userId]);
  return Number(row?.n ?? 0);
}

/** Marque lu : des identifiants précis, ou tout. */
export async function markNotificationsRead(q: Query, userId: string, ids: string[] | "all") {
  if (ids === "all") await q(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
  else await q(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL`, [userId, ids]);
}

/** Marque non lu (contrôle de relecture). */
export async function markNotificationUnread(q: Query, userId: string, id: string) {
  await q(`UPDATE notifications SET read_at = NULL WHERE user_id = $1 AND id = $2`, [userId, id]);
}
