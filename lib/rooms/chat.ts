import type { Db, Query, Row } from "../editorial/types.ts";
import { lockRoom } from "../community-locks.ts";
import { notifyMentions } from "../social/mentions.ts";
import { notifyRoomMessage } from "../social/notifications.ts";
import { canModerateRoom, canPreviewRoom, canReadRoom, canWriteRoom, loadAccess, type RoomViewer } from "./permissions.ts";
import type { Outcome } from "./service.ts";

// Chat réel (lot d'accélération C21 à C26 ; architecture C009).
// PostgreSQL est la source de vérité : envoi/modification/suppression par API,
// réception par flux SSE reprenable. Chaque écriture produit son événement dans
// la MÊME transaction (table room_events) ; un flux lit les événements après son
// curseur, donc une coupure ou un redémarrage ne perd rien.
// Aucune présence ni activité inventée : seuls des faits persistés sont émis.

const refuse = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });

export interface MessageView {
  id: string;
  seq: number;
  authorId: string;
  authorHandle: string | null;
  authorName: string;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  /** Vrai si retiré par la modération (le motif reste côté modération). */
  removedByModeration: boolean;
}

function toView(m: Row): MessageView {
  const deleted = Boolean(m.deleted_at);
  return {
    id: m.id as string,
    seq: Number(m.seq),
    authorId: m.author_id as string,
    authorHandle: (m.handle as string) ?? null,
    authorName: (m.display_name as string) ?? "Membre supprimé",
    body: deleted ? null : (m.body as string),
    createdAt: new Date(m.created_at as string).toISOString(),
    editedAt: m.edited_at ? new Date(m.edited_at as string).toISOString() : null,
    deleted,
    removedByModeration: deleted && Boolean(m.deleted_by) && m.deleted_by !== m.author_id,
  };
}

const MESSAGE_SELECT = `SELECT m.*, u.handle, u.display_name FROM room_messages m JOIN users u ON u.id = m.author_id`;

/**
 * SEULE voie d'écriture dans room_events (ACC08). Le verrou consultatif par salon,
 * tenu jusqu'au COMMIT, sérialise l'allocation des numéros avec la validation : deux
 * transactions ne peuvent pas allouer N puis N+1 et valider dans l'ordre inverse, donc
 * un curseur acquitté ne dépasse jamais un événement encore invisible.
 * loadAccess prend déjà ce verrou AVANT les permissions et l'allocation du message.
 * Ordre : limite éventuelle → barrière communauté → salon → lignes métier.
 */
export async function appendRoomEvent(
  q: Query,
  roomId: string,
  kind: RoomEvent["kind"],
  extra: { messageId?: string | null; targetUserId?: string | null; payload?: Record<string, unknown> } = {},
) {
  await lockRoom(q, roomId);
  await q(`INSERT INTO room_events (room_id, kind, message_id, target_user_id, payload) VALUES ($1, $2, $3, $4, $5)`, [
    roomId,
    kind,
    extra.messageId ?? null,
    extra.targetUserId ?? null,
    JSON.stringify(extra.payload ?? {}),
  ]);
}

/**
 * Envoi persistant (C21) : l'identifiant client rend la relance sûre — le même
 * (salon, auteur, clientId) renvoie le message déjà enregistré, jamais un doublon.
 * À appeler via runLimited("roomMessage") pour la limite D6 (20/min/salon), atomique.
 */
export async function sendMessage(q: Query, viewer: RoomViewer, roomId: string, input: { clientId: string; body: string }): Promise<Outcome<{ message: MessageView; duplicate: boolean }>> {
  const access = await loadAccess(q, roomId, viewer, { forWrite: true });
  if (!access.room || (access.room.visibility === "private" && !access.membership)) return refuse("introuvable", "Salon introuvable.");
  if (!canWriteRoom(access)) {
    if (access.room.archived_at) return refuse("archive", "Salon archivé : il n'accepte plus de messages.");
    return refuse("droit", "Rejoignez le salon pour écrire.");
  }
  const inserted = await q(
    `INSERT INTO room_messages (room_id, author_id, client_id, body) VALUES ($1, $2, $3, $4)
     ON CONFLICT (room_id, author_id, client_id) DO NOTHING RETURNING *`,
    [roomId, viewer.id, input.clientId, input.body],
  );
  if (!inserted[0]) {
    const [existing] = await q(`${MESSAGE_SELECT} WHERE m.room_id = $1 AND m.author_id = $2 AND m.client_id = $3`, [roomId, viewer.id, input.clientId]);
    return { ok: true, message: toView(existing), duplicate: true };
  }
  await appendRoomEvent(q, roomId, "message", { messageId: inserted[0].id as string, payload: { seq: Number(inserted[0].seq) } });
  // Notification des suiveurs du salon (D29), regroupée, dans la même transaction.
  await notifyRoomMessage(q, roomId, viewer.id);
  // Mentions @pseudo : membres du salon uniquement (rien ne fuit d'un salon privé).
  await notifyMentions(q, { actorId: viewer.id, text: input.body, roomId });
  const [row] = await q(`${MESSAGE_SELECT} WHERE m.id = $1`, [inserted[0].id]);
  return { ok: true, message: toView(row), duplicate: false };
}

/** Historique paginé (C22) : ordre stable par `seq`, chargement vers l'arrière avec `before`. */
export async function listMessages(q: Query, viewer: RoomViewer, roomId: string, { before, limit = 50 }: { before?: number; limit?: number } = {}): Promise<Outcome<{ messages: MessageView[]; hasMore: boolean }>> {
  const access = await loadAccess(q, roomId, viewer);
  if (!access.room || (access.room.visibility === "private" && !access.membership)) return refuse("introuvable", "Salon introuvable.");
  if (!canReadRoom(access)) return refuse("droit", "Rejoignez le salon pour lire son historique.");
  const capped = Math.min(Math.max(limit, 1), 100);
  const rows = await q(
    `${MESSAGE_SELECT} WHERE m.room_id = $1 AND ($2::bigint IS NULL OR m.seq < $2) ORDER BY m.seq DESC LIMIT $3`,
    [roomId, before ?? null, capped + 1],
  );
  const hasMore = rows.length > capped;
  return { ok: true, messages: rows.slice(0, capped).reverse().map(toView), hasMore };
}

/** Derniers messages d'un salon public, en lecture seule, pour un non-membre ou un visiteur. */
export async function previewMessages(q: Query, viewer: RoomViewer | null, roomId: string, limit = 40): Promise<MessageView[] | null> {
  const access = await loadAccess(q, roomId, viewer);
  if (!canPreviewRoom(access)) return null;
  const rows = await q(`${MESSAGE_SELECT} WHERE m.room_id = $1 ORDER BY m.seq DESC LIMIT $2`, [roomId, limit]);
  return rows.reverse().map(toView);
}

/** Modification par l'auteur (C22) ; événement émis dans la même transaction. */
export async function editMessage(q: Query, viewer: RoomViewer, roomId: string, messageId: string, body: string): Promise<Outcome> {
  const access = await loadAccess(q, roomId, viewer, { forWrite: true });
  if (!access.room || !canWriteRoom(access)) return refuse("droit", "Modification impossible dans ce salon.");
  const rows = await q(
    `UPDATE room_messages SET body = $4, edited_at = now() WHERE id = $2 AND room_id = $1 AND author_id = $3 AND deleted_at IS NULL RETURNING id`,
    [roomId, messageId, viewer.id, body],
  );
  if (!rows.length) return refuse("introuvable", "Message introuvable, supprimé, ou écrit par quelqu'un d'autre.");
  await appendRoomEvent(q, roomId, "edit", { messageId });
  return { ok: true };
}

/** Suppression par l'auteur, ou RETRAIT par la modération avec motif enregistré (C22, F12). */
export async function deleteMessage(q: Query, viewer: RoomViewer, roomId: string, messageId: string, reason?: string): Promise<Outcome> {
  const access = await loadAccess(q, roomId, viewer, { forWrite: true });
  if (!access.room || !access.membership) return refuse("introuvable", "Salon introuvable.");
  if (!canWriteRoom(access)) return refuse("droit", "Ce compte ne peut plus modifier les messages de ce salon.");
  const [message] = await q(`SELECT author_id, deleted_at FROM room_messages WHERE id = $1 AND room_id = $2`, [messageId, roomId]);
  if (!message || message.deleted_at) return refuse("introuvable", "Message introuvable ou déjà supprimé.");
  const isAuthor = message.author_id === viewer.id;
  if (!isAuthor) {
    if (!canModerateRoom(access)) return refuse("droit", "Seule la modération retire le message d'autrui.");
    if (!reason || reason.trim().length < 3) return refuse("motif", "Un retrait de modération exige un motif.");
  }
  await q(`UPDATE room_messages SET deleted_at = now(), deleted_by = $3, delete_reason = $4 WHERE id = $1 AND room_id = $2`, [
    messageId,
    roomId,
    viewer.id,
    isAuthor ? null : reason!.trim(),
  ]);
  await appendRoomEvent(q, roomId, "delete", { messageId, payload: { moderation: !isAuthor } });
  return { ok: true };
}

/** Repère de lecture MONOTONE (C25) : ne recule jamais, et ne dépasse jamais le dernier message réel. */
export async function markRead(q: Query, viewer: RoomViewer, roomId: string, seq: number): Promise<Outcome<{ lastReadSeq: number }>> {
  const access = await loadAccess(q, roomId, viewer, { forWrite: true });
  if (!canReadRoom(access)) return refuse("droit", "Vous n'avez plus accès à cette discussion.");
  const rows = await q<{ last_read_seq: unknown }>(
    `UPDATE room_members SET last_read_seq = GREATEST(last_read_seq, LEAST($3::bigint,
       COALESCE((SELECT max(seq) FROM room_messages WHERE room_id = $1), 0)))
     WHERE room_id = $1 AND user_id = $2 RETURNING last_read_seq`,
    [roomId, viewer.id, Math.max(0, Math.floor(seq))],
  );
  if (!rows.length) return refuse("membre", "Rejoignez le salon d'abord.");
  // N'acquitter la notification que si aucun message plus récent ne reste à lire.
  await q(`UPDATE notifications SET read_at = now() WHERE user_id = $2 AND room_id = $1 AND kind = 'room_message' AND read_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM room_messages WHERE room_id = $1 AND author_id <> $2 AND deleted_at IS NULL AND seq > $3)`,
    [roomId, viewer.id, Number(rows[0].last_read_seq)]);
  return { ok: true, lastReadSeq: Number(rows[0].last_read_seq) };
}

export interface RoomEvent {
  seq: number;
  kind: "message" | "edit" | "delete" | "revoke";
  message: MessageView | null;
  targetUserId: string | null;
}

/** Événements après un curseur (C23). Utilisé par le flux SSE et par sa reprise. */
export async function eventsSince(q: Query, roomId: string, cursor: number, limit = 200): Promise<RoomEvent[]> {
  const rows = await q(
    `SELECT e.seq AS event_seq, e.kind, e.target_user_id, m.*, u.handle, u.display_name
     FROM room_events e
     LEFT JOIN room_messages m ON m.id = e.message_id
     LEFT JOIN users u ON u.id = m.author_id
     WHERE e.room_id = $1 AND e.seq > $2 ORDER BY e.seq LIMIT $3`,
    [roomId, cursor, limit],
  );
  return rows.map((r) => ({
    seq: Number(r.event_seq),
    kind: r.kind as RoomEvent["kind"],
    message: r.id ? toView(r) : null,
    targetUserId: (r.target_user_id as string) ?? null,
  }));
}

/** Dernier curseur émis pour un salon (point de départ d'un flux sans historique à rejouer). */
export async function latestEventSeq(q: Query, roomId: string): Promise<number> {
  const [row] = await q<{ s: unknown }>(`SELECT GREATEST(events_purged_seq,
    COALESCE((SELECT max(seq) FROM room_events WHERE room_id = $1), 0)) AS s FROM rooms WHERE id = $1`, [roomId]);
  return Number(row?.s ?? 0);
}

/**
 * Watermark de purge PAR SALON (ACC06). Les numéros de séquence viennent d'une suite
 * globale : un trou entre deux événements d'un salon est NORMAL et n'implique aucune
 * purge. Seul un curseur strictement sous ce watermark exige une resynchronisation.
 */
export async function purgedSeq(q: Query, roomId: string): Promise<number> {
  const [row] = await q<{ s: unknown }>(`SELECT events_purged_seq AS s FROM rooms WHERE id = $1`, [roomId]);
  return Number(row?.s ?? 0);
}

/** Purge d'exploitation : avance le watermark PUIS supprime, sous le même verrou que les écritures d'événements. */
export async function purgeRoomEvents(q: Query, roomId: string, upToSeq: number) {
  await lockRoom(q, roomId);
  const safeSeq = Math.max(0, Math.min(Math.floor(upToSeq), await latestEventSeq(q, roomId)));
  await q(`UPDATE rooms SET events_purged_seq = GREATEST(events_purged_seq, $2) WHERE id = $1`, [roomId, safeSeq]);
  await q(`DELETE FROM room_events WHERE room_id = $1 AND seq <= $2`, [roomId, safeSeq]);
}

export interface ChatSnapshot {
  cursor: number;
  purgedSeq: number;
  lastReadSeq: number;
  messages: MessageView[];
  hasMore: boolean;
}

/**
 * Instantané COHÉRENT pour ouvrir le chat (ACC06) : le curseur est lu AVANT l'historique,
 * dans la même transaction. Un événement arrivé ensuite est donc rejoué par le flux ;
 * l'application côté client est idempotente (remplacement par identifiant de message).
 */
export async function chatSnapshot(db: Db, viewer: RoomViewer, roomId: string): Promise<ChatSnapshot | null> {
  return db.transaction(async (q) => {
    await lockRoom(q, roomId, true);
    const cursor = await latestEventSeq(q, roomId);
    const history = await listMessages(q, viewer, roomId);
    if (!history.ok) return null;
    const [membership] = await q<{ last_read_seq: unknown }>(`SELECT last_read_seq FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, viewer.id]);
    return {
      cursor,
      purgedSeq: await purgedSeq(q, roomId),
      lastReadSeq: Number(membership?.last_read_seq ?? 0),
      messages: history.messages,
      hasMore: history.hasMore,
    };
  });
}

/**
 * Événement de révocation (C24, ACC01) : écrit dans la transaction qui retire l'accès
 * (sanction de salon, départ volontaire, suppression de compte, sanction de plateforme),
 * il ferme les flux déjà ouverts du membre AVANT tout nouvel envoi de données.
 */
export async function emitRevocation(q: Query, roomId: string, targetUserId: string) {
  await appendRoomEvent(q, roomId, "revoke", { targetUserId });
}

/** Non-lus d'un membre (C25) : messages réels après son repère, jamais une invention. */
export async function unreadCount(q: Query, viewer: RoomViewer, roomId: string): Promise<number> {
  const [row] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM room_messages m JOIN room_members me ON me.room_id = m.room_id AND me.user_id = $2
     WHERE m.room_id = $1 AND m.deleted_at IS NULL AND m.seq > me.last_read_seq AND m.author_id <> $2`,
    [roomId, viewer.id],
  );
  return Number(row?.n ?? 0);
}

/**
 * Droits du flux (ACC01) : SESSION d'origine encore ouverte (déconnexion ou fermeture
 * de sessions = fin du flux), compte actif et adhésion — relus en base à chaque contrôle.
 */
export async function streamAccessAllowed(
  db: Db,
  viewer: RoomViewer,
  roomId: string,
  opts: { sessionTokenHash?: string } = {},
): Promise<boolean> {
  if (opts.sessionTokenHash) {
    const [session] = await db.query(`SELECT 1 FROM sessions WHERE token_hash = $1 AND user_id = $2 AND expires_at > now()`, [opts.sessionTokenHash, viewer.id]);
    if (!session) return false;
  }
  const access = await loadAccess(db.query, roomId, viewer);
  return canReadRoom(access);
}

/** Une émission synchrone sous les mêmes verrous que les révocations : aucun await
 * entre la dernière lecture autorisée et enqueue. Le verrou est libéré à chaque lot. */
export async function emitRoomBatch(
  db: Db, viewer: RoomViewer, roomId: string, cursor: number, sessionTokenHash: string,
  emit: (event: string, data: unknown) => void,
): Promise<{ cursor: number; closed: boolean }> {
  return db.transaction(async (q) => {
    await lockRoom(q, roomId, true);
    if (!(await streamAccessAllowed({ ...db, query: q }, viewer, roomId, { sessionTokenHash }))) {
      emit("revoked", { reason: "accès retiré" });
      return { cursor, closed: true };
    }
    if (cursor < await purgedSeq(q, roomId)) {
      emit("resync", { cursor: await latestEventSeq(q, roomId) });
      return { cursor, closed: true };
    }
    const events = await eventsSince(q, roomId, cursor);
    for (const event of events) {
      cursor = event.seq;
      if (event.kind === "revoke") {
        if (event.targetUserId === viewer.id) {
          emit("revoked", { reason: "accès retiré" });
          return { cursor, closed: true };
        }
      } else emit(event.kind, { seq: event.seq, message: event.message });
    }
    const [room] = await q(`SELECT archived_at FROM rooms WHERE id = $1`, [roomId]);
    emit("battement", { cursor, archived: Boolean(room?.archived_at) });
    return { cursor, closed: false };
  });
}
