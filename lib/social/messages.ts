import type { Query } from "../editorial/types.ts";

// Messages privés entre deux membres. Règles :
// - les deux comptes sont actifs et inscrits ; l'agent éditorial ne reçoit pas de messages ;
// - un blocage, dans un sens ou dans l'autre, interdit l'envoi et masque la conversation
//   pour celui qui a bloqué ;
// - une seule conversation par paire, créée au premier message ;
// - « lu » : date de dernière lecture par membre et par conversation.

export interface Correspondent {
  id: string;
  handle: string;
  displayName: string;
  avatarId?: string | null;
}

export interface ConversationSummary {
  id: string;
  other: Correspondent;
  lastBody: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: boolean;
}

export interface DirectMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export type MessageOutcome<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]);

/** Destinataire joignable par ce membre, ou la raison du refus. */
export async function findRecipient(q: Query, senderId: string, handle: string): Promise<MessageOutcome<Correspondent>> {
  const [row] = await q<{ id: string; handle: string; display_name: string | null; role: string; status: string; onboarded: boolean; avatar_image_id: string | null }>(
    `SELECT id, handle, display_name, role, status, avatar_image_id, rules_accepted_at IS NOT NULL AS onboarded FROM users WHERE lower(handle) = lower($1)`,
    [handle],
  );
  if (!row || row.status === "deleted" || !row.onboarded) return { ok: false, status: 404, message: "Membre introuvable." };
  if (row.id === senderId) return { ok: false, status: 400, message: "Vous ne pouvez pas vous écrire à vous-même." };
  if (row.role === "agent") return { ok: false, status: 400, message: "L’agent éditorial ne reçoit pas de messages." };
  return { ok: true, value: { id: row.id, handle: row.handle, displayName: row.display_name || row.handle, avatarId: row.avatar_image_id } };
}

async function blockedEitherWay(q: Query, a: string, b: string): Promise<{ byMe: boolean; byThem: boolean }> {
  const rows = await q<{ blocker_id: string }>(
    `SELECT blocker_id FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [a, b],
  );
  return { byMe: rows.some((r) => r.blocker_id === a), byThem: rows.some((r) => r.blocker_id === b) };
}

/** Peut-on écrire à ce membre ? (bouton « Message » des profils) */
export async function canMessage(q: Query, senderId: string, recipientId: string): Promise<boolean> {
  const [me] = await q<{ ok: boolean }>(`SELECT status = 'active' AND rules_accepted_at IS NOT NULL AS ok FROM users WHERE id = $1`, [senderId]);
  if (!me?.ok) return false;
  const [them] = await q<{ ok: boolean }>(
    `SELECT status = 'active' AND role <> 'agent' AND rules_accepted_at IS NOT NULL AS ok FROM users WHERE id = $1`,
    [recipientId],
  );
  if (!them?.ok) return false;
  const blocks = await blockedEitherWay(q, senderId, recipientId);
  return !blocks.byMe && !blocks.byThem;
}

/** À appeler dans une transaction (limite de fréquence). */
export async function sendDirectMessage(q: Query, senderId: string, recipient: Correspondent, body: string): Promise<MessageOutcome<DirectMessage>> {
  const text = body.trim();
  if (!text) return { ok: false, status: 400, message: "Le message est vide." };
  if (text.length > 4000) return { ok: false, status: 400, message: "4 000 caractères au plus." };
  if (!(await canMessage(q, senderId, recipient.id))) {
    return { ok: false, status: 403, message: "Vous ne pouvez pas écrire à ce membre." };
  }
  const [a, b] = pair(senderId, recipient.id);
  await q(`INSERT INTO conversations (user_a, user_b) VALUES ($1, $2) ON CONFLICT (user_a, user_b) DO NOTHING`, [a, b]);
  const [conversation] = await q<{ id: string }>(`SELECT id FROM conversations WHERE user_a = $1 AND user_b = $2`, [a, b]);
  const [message] = await q<{ id: string; created_at: Date | string }>(
    `INSERT INTO direct_messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, created_at`,
    [conversation.id, senderId, text],
  );
  await q(`UPDATE conversations SET last_message_at = $2 WHERE id = $1`, [conversation.id, message.created_at]);
  await markRead(q, conversation.id, senderId);
  return { ok: true, value: { id: message.id, body: text, createdAt: new Date(message.created_at).toISOString(), mine: true } };
}

async function markRead(q: Query, conversationId: string, userId: string) {
  await q(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES ($1, $2, clock_timestamp())
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = clock_timestamp()`,
    [conversationId, userId],
  );
}

/** Messages d'une conversation (les plus récents, dans l'ordre), marquée lue. */
export async function readThread(q: Query, userId: string, otherId: string, limit = 200): Promise<DirectMessage[]> {
  const [a, b] = pair(userId, otherId);
  const [conversation] = await q<{ id: string }>(`SELECT id FROM conversations WHERE user_a = $1 AND user_b = $2`, [a, b]);
  if (!conversation) return [];
  const rows = await q<{ id: string; body: string; created_at: Date | string; sender_id: string }>(
    `SELECT * FROM (SELECT id, body, created_at, sender_id FROM direct_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2) recent
     ORDER BY created_at`,
    [conversation.id, limit],
  );
  await markRead(q, conversation.id, userId);
  return rows.map((r) => ({ id: r.id, body: r.body, createdAt: new Date(r.created_at).toISOString(), mine: r.sender_id === userId }));
}

/** Boîte de réception : conversations récentes ; celles avec un membre bloqué par moi sont masquées. */
export async function listConversations(q: Query, userId: string, limit = 50): Promise<ConversationSummary[]> {
  const rows = await q<{
    id: string; other_id: string; handle: string; display_name: string | null; avatar_image_id: string | null; body: string; last_at: Date | string; sender_id: string; unread: boolean;
  }>(
    `SELECT c.id, o.id AS other_id, o.handle, o.display_name, o.avatar_image_id, m.body, m.created_at AS last_at, m.sender_id,
            (m.sender_id <> $1 AND m.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)) AS unread
     FROM conversations c
     JOIN users o ON o.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
     JOIN LATERAL (SELECT body, created_at, sender_id FROM direct_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) m ON true
     LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = $1
     WHERE (c.user_a = $1 OR c.user_b = $1) AND o.status <> 'deleted'
       AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = $1 AND ub.blocked_id = o.id)
     ORDER BY c.last_message_at DESC NULLS LAST
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    other: { id: r.other_id, handle: r.handle, displayName: r.display_name || r.handle, avatarId: r.avatar_image_id },
    lastBody: r.body,
    lastAt: new Date(r.last_at).toISOString(),
    lastFromMe: r.sender_id === userId,
    unread: Boolean(r.unread),
  }));
}

export async function unreadConversationCount(q: Query, userId: string): Promise<number> {
  const [row] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM conversations c
     LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = $1
     WHERE (c.user_a = $1 OR c.user_b = $1)
       AND EXISTS (SELECT 1 FROM direct_messages m WHERE m.conversation_id = c.id AND m.sender_id <> $1
                   AND m.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz))
       AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = $1
                       AND ub.blocked_id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END)`,
    [userId],
  );
  return Number(row?.n ?? 0);
}
