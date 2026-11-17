import { createHash, randomBytes } from "node:crypto";
import { activeContributor, lockCommunity, lockRoom } from "../community-locks.ts";
import type { Db, Query } from "../editorial/types.ts";
import { purgeRoomNotifications } from "../social/notifications.ts";
import { emitRevocation } from "./chat.ts";
import {
  activeSanction,
  canAcceptInvitation,
  canInviteToRoom,
  canJoinRoom,
  canManageRoom,
  canReadRoom,
  canModerateRoom,
  loadAccess,
  type RoomViewer,
} from "./permissions.ts";

// Opérations des salons (lot d'accélération B13 à B20). Module sans dépendance
// serveur : testé directement sur PGlite (tests/rooms-*.test.ts). Chaque écriture
// revérifie les droits DANS sa transaction ; les routes HTTP ne font que
// l'authentification et la validation de forme.

export type Outcome<T = unknown> = ({ ok: true } & T) | { ok: false; code: string; message: string };

const refuse = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });

export const INVITATION_VALIDITY_DAYS = 7;
export const TRANSFER_VALIDITY_DAYS = 7;
export const BAN_DURATIONS_DAYS = [7, 30, null] as const; // null = sans limite

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// ───────────────────────────── Création et cycle de vie ─────────────────────────────

export interface CreateRoomInput {
  name: string;
  description: string;
  themeId: string | null;
  visibility: "public" | "private";
  format: "chat" | "chat_vocal";
  /** Publication d'origine (création depuis une publication, F10). */
  postId: string | null;
}

/** À appeler via runLimited("roomCreate") : la limite D6 (5 par jour) est comptée sur rooms.owner_id. */
export async function createRoom(q: Query, viewer: RoomViewer, input: CreateRoomInput): Promise<Outcome<{ roomId: string }>> {
  if (!(await activeContributor(q, viewer.id))) return refuse("droit", "Ce compte ne peut pas créer de salon.");
  if (input.postId) {
    const [post] = await q(`SELECT id FROM posts WHERE id = $1 AND status = 'published'`, [input.postId]);
    if (!post) return refuse("publication", "Publication d'origine introuvable ou indisponible.");
  }
  if (input.themeId) {
    const [theme] = await q(`SELECT id FROM themes WHERE id = $1 AND active`, [input.themeId]);
    if (!theme) return refuse("theme", "Thème inconnu.");
  }
  const [room] = await q<{ id: string }>(
    `INSERT INTO rooms (name, description, theme_id, owner_id, visibility, format) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.name, input.description, input.themeId, viewer.id, input.visibility, input.format],
  );
  // Le créateur devient propriétaire, membre, et suit son salon par défaut (F11).
  await q(`INSERT INTO room_members (room_id, user_id, role, following) VALUES ($1, $2, 'owner', true)`, [room.id, viewer.id]);
  if (input.postId) await q(`INSERT INTO room_posts (room_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [room.id, input.postId]);
  return { ok: true, roomId: room.id };
}

export async function updateRoom(
  db: Db,
  viewer: RoomViewer,
  roomId: string,
  change: { name?: string; description?: string; format?: "chat" | "chat_vocal"; archive?: boolean },
): Promise<Outcome> {
  return db.transaction(async (q) => {
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (!access.room) return refuse("introuvable", "Salon introuvable.");
    if (!canManageRoom(access)) return refuse("droit", "Seule la personne propriétaire modifie le salon.");
    const sets: string[] = [`updated_at = now()`];
    const params: unknown[] = [roomId];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      sets.push(`${sql} = $${params.length}`);
    };
    if (change.name !== undefined) add("name", change.name);
    if (change.description !== undefined) add("description", change.description);
    if (change.format !== undefined) add("format", change.format);
    if (change.archive) sets.push("archived_at = COALESCE(archived_at, now())");
    await q(`UPDATE rooms SET ${sets.join(", ")} WHERE id = $1`, params);
    return { ok: true };
  });
}

// ───────────────────────────── Adhésion et départ ─────────────────────────────

export async function joinRoom(db: Db, viewer: RoomViewer, roomId: string): Promise<Outcome> {
  return db.transaction(async (q) => {
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (!access.room || (access.room.visibility === "private" && !access.membership)) {
      return refuse("introuvable", "Salon introuvable.");
    }
    if (access.membership) return { ok: true }; // déjà membre : idempotent
    if (!canJoinRoom(access)) {
      if (access.sanction?.kind === "ban") return refuse("banni", "Vous êtes banni·e de ce salon.");
      if (access.sanction?.kind === "kick") return refuse("exclu", "Exclusion récente : retour possible après 24 heures.");
      if (access.room.archived_at) return refuse("archive", "Salon archivé : il n'accepte plus de nouveaux membres.");
      return refuse("droit", "Ce salon ne peut pas être rejoint ainsi.");
    }
    await q(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [roomId, viewer.id]);
    return { ok: true };
  });
}

/** Quitter : la personne propriétaire doit d'abord transférer ou archiver (D5 §4.1). Quitter un salon privé retire l'historique. */
export async function leaveRoom(db: Db, viewer: RoomViewer, roomId: string): Promise<Outcome> {
  return db.transaction(async (q) => {
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (!access.room || !access.membership) return refuse("introuvable", "Vous n'êtes pas membre de ce salon.");
    if (access.membership.role === "owner" && !access.room.archived_at) {
      return refuse("propriete", "Transférez la propriété à un membre qui accepte, ou archivez le salon, avant de le quitter.");
    }
    await q(`DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, viewer.id]);
    // Perte d'accès (D30) : plus aucune référence au salon dans les notifications.
    await purgeRoomNotifications(q, roomId, viewer.id);
    // ACC01 : les flux déjà ouverts sont révoqués dans la MÊME transaction que le départ :
    // aucune donnée du salon n'est servie après la perte d'accès.
    await emitRevocation(q, roomId, viewer.id);
    return { ok: true };
  });
}

/** Suivre ou ne plus suivre (notifications) : distinct de l'adhésion (F11). */
export async function setFollowing(db: Db, viewer: RoomViewer, roomId: string, following: boolean): Promise<Outcome> {
  return db.transaction(async (q) => {
  const access = await loadAccess(q, roomId, viewer, { forWrite: true });
  if (!canReadRoom(access)) return refuse("droit", "Ce compte ne peut pas suivre ce salon.");
  const rows = await q(
    `UPDATE room_members SET following = $3 WHERE room_id = $1 AND user_id = $2
       AND EXISTS (SELECT 1 FROM users u WHERE u.id = $2 AND u.status = 'active') RETURNING room_id`,
    [roomId, viewer.id, following],
  );
  return rows.length ? { ok: true } : refuse("membre", "Rejoignez le salon pour le suivre.");
  });
}

// ───────────────────────────── Invitations ─────────────────────────────

/** À appeler via runLimited("roomInvite") : limite D6 de 20 par jour et par salon. Le jeton clair n'est jamais stocké. */
export async function createInvitation(
  q: Query,
  viewer: RoomViewer,
  roomId: string,
  now = new Date(),
): Promise<Outcome<{ token: string; invitationId: string; expiresAt: string }>> {
  const access = await loadAccess(q, roomId, viewer, { forWrite: true });
  if (!access.room) return refuse("introuvable", "Salon introuvable.");
  if (!canInviteToRoom(access)) return refuse("droit", "Seuls la personne propriétaire et les modérateurs invitent, dans un salon non archivé.");
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITATION_VALIDITY_DAYS * 86_400_000).toISOString();
  const [row] = await q<{ id: string }>(
    `INSERT INTO room_invitations (room_id, created_by, token_hash, expires_at) VALUES ($1, $2, $3, $4) RETURNING id`,
    [roomId, viewer.id, hashToken(token), expiresAt],
  );
  return { ok: true, token, invitationId: row.id, expiresAt };
}

export async function revokeInvitation(db: Db, viewer: RoomViewer, roomId: string, invitationId: string): Promise<Outcome> {
  return db.transaction(async (q) => {
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (!access.room || !canInviteToRoom(access)) return refuse("droit", "Révocation réservée à la personne propriétaire et aux modérateurs.");
    const rows = await q(`UPDATE room_invitations SET revoked_at = now() WHERE id = $1 AND room_id = $2 AND used_at IS NULL AND revoked_at IS NULL RETURNING id`, [
      invitationId,
      roomId,
    ]);
    return rows.length ? { ok: true } : refuse("etat", "Invitation déjà utilisée, révoquée ou inconnue.");
  });
}

/**
 * Acceptation EXPLICITE et ATOMIQUE d'une invitation : le jeton est verrouillé (FOR UPDATE),
 * consommé une seule fois ; deux acceptations simultanées ne produisent qu'un usage.
 * Un bannissement actif rend toute invitation inopérante (F11, D5 §4.2).
 */
export async function acceptInvitation(db: Db, viewer: RoomViewer, token: string): Promise<Outcome<{ roomId: string }>> {
  return db.transaction(async (q) => {
    // Lire la destination sans verrou avant de verrouiller salon puis invitation.
    const [destination] = await q<{ room_id: string }>(`SELECT room_id FROM room_invitations WHERE token_hash = $1`, [hashToken(token)]);
    if (!destination) return refuse("invalide", "Invitation inconnue.");
    await lockRoom(q, destination.room_id);
    const [invitation] = await q(`SELECT * FROM room_invitations WHERE token_hash = $1 FOR UPDATE`, [hashToken(token)]);
    if (!invitation) return refuse("invalide", "Invitation inconnue.");
    if (invitation.revoked_at) return refuse("revoquee", "Invitation révoquée.");
    if (invitation.used_at) return refuse("utilisee", "Invitation déjà utilisée.");
    if (new Date(invitation.expires_at as string) <= new Date()) return refuse("expiree", "Invitation expirée.");
    const roomId = invitation.room_id as string;
    // Blocage (D31) : une personne bloquée ne peut pas inviter la personne qui la bloque.
    const blocked = await q(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [viewer.id, invitation.created_by]);
    if (blocked.length > 0) return refuse("bloque", "Cette invitation vient d'un membre que vous avez bloqué : elle ne peut pas être acceptée.");
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (access.membership) return { ok: true, roomId }; // déjà membre : l'invitation reste disponible
    if (!canAcceptInvitation(access)) {
      if (access.sanction?.kind === "ban") return refuse("banni", "Bannissement actif : aucune invitation ne permet de revenir.");
      if (access.sanction?.kind === "kick") return refuse("exclu", "Exclusion récente : retour possible après 24 heures.");
      if (access.room?.archived_at) return refuse("archive", "Salon archivé : il n'accepte plus d'arrivées.");
      return refuse("droit", "Cette invitation ne peut pas être acceptée avec ce compte.");
    }
    const used = await q(`UPDATE room_invitations SET used_at = now(), used_by = $2 WHERE id = $1 AND used_at IS NULL RETURNING id`, [
      invitation.id,
      viewer.id,
    ]);
    if (!used.length) return refuse("utilisee", "Invitation déjà utilisée.");
    await q(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [roomId, viewer.id]);
    return { ok: true, roomId };
  });
}

// ───────────────────────────── Rôles, sanctions ─────────────────────────────

export async function setMemberRole(db: Db, viewer: RoomViewer, roomId: string, userId: string, role: "moderator" | "member"): Promise<Outcome> {
  return db.transaction(async (q) => {
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (!access.room || !canManageRoom(access)) return refuse("droit", "Seule la personne propriétaire gère les rôles.");
    if (userId === viewer.id) return refuse("soi", "La personne propriétaire ne change pas son propre rôle : transférez la propriété.");
    const rows = await q(`UPDATE room_members SET role = $3 WHERE room_id = $1 AND user_id = $2 AND role <> 'owner' RETURNING user_id`, [
      roomId,
      userId,
      role,
    ]);
    return rows.length ? { ok: true } : refuse("membre", "Ce membre n'est pas dans le salon.");
  });
}

/** Exclusion (retour public après 24 h) ou bannissement (7 j, 30 j ou sans limite). Effet immédiat : retrait du salon. */
export async function sanctionMember(
  db: Db,
  viewer: RoomViewer,
  roomId: string,
  userId: string,
  sanction: { kind: "kick" } | { kind: "ban"; days: 7 | 30 | null },
  reason: string,
): Promise<Outcome> {
  return db.transaction(async (q) => {
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (!access.room || !canModerateRoom(access)) return refuse("droit", "Exclusion et bannissement réservés à la personne propriétaire et aux modérateurs.");
    const [target] = await q<{ role: string }>(`SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
    if (userId === viewer.id) return refuse("soi", "On ne se sanctionne pas soi-même.");
    if (!target) return refuse("membre", "Ce membre n'est pas dans le salon.");
    if (target.role === "owner") return refuse("proprietaire", "La personne propriétaire ne peut pas être sanctionnée dans son salon.");
    if (target.role === "moderator" && access.membership?.role !== "owner") {
      return refuse("droit", "Seule la personne propriétaire sanctionne un modérateur.");
    }
    const expiresAt =
      sanction.kind === "kick"
        ? new Date(Date.now() + 24 * 3_600_000).toISOString()
        : sanction.days === null
          ? null
          : new Date(Date.now() + sanction.days * 86_400_000).toISOString();
    await q(`DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
    await q(`INSERT INTO room_sanctions (room_id, user_id, kind, reason, expires_at, created_by) VALUES ($1, $2, $3, $4, $5, $6)`, [
      roomId,
      userId,
      sanction.kind,
      reason,
      expiresAt,
      viewer.id,
    ]);
    // Révocation des flux ouverts (C24) : l'événement part dans la MÊME transaction que la sanction.
    await emitRevocation(q, roomId, userId);
    // Perte d'accès (D30) : plus aucune référence au salon dans les notifications du membre sanctionné.
    await purgeRoomNotifications(q, roomId, userId);
    return { ok: true };
  });
}

/** Levée d'un bannissement par la personne propriétaire ou un modérateur (D5 §4.2). */
export async function liftBan(db: Db, viewer: RoomViewer, roomId: string, userId: string): Promise<Outcome> {
  return db.transaction(async (q) => {
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (!access.room || !canModerateRoom(access)) return refuse("droit", "Levée réservée à la personne propriétaire et aux modérateurs.");
    const rows = await q(
      `UPDATE room_sanctions SET lifted_at = now(), lifted_by = $3 WHERE room_id = $1 AND user_id = $2 AND kind = 'ban' AND lifted_at IS NULL RETURNING id`,
      [roomId, userId, viewer.id],
    );
    return rows.length ? { ok: true } : refuse("etat", "Aucun bannissement actif pour ce membre.");
  });
}

// ───────────────────────────── Transfert de propriété ─────────────────────────────

export async function proposeTransfer(db: Db, viewer: RoomViewer, roomId: string, toUserId: string): Promise<Outcome<{ transferId: string }>> {
  return db.transaction(async (q) => {
    const access = await loadAccess(q, roomId, viewer, { forWrite: true });
    if (!access.room || !canManageRoom(access)) return refuse("droit", "Seule la personne propriétaire propose un transfert.");
    const [target] = await q(`SELECT user_id FROM room_members WHERE room_id = $1 AND user_id = $2 AND role <> 'owner'`, [roomId, toUserId]);
    if (!target) return refuse("membre", "Le transfert se fait vers un membre du salon.");
    await q(`UPDATE room_transfers SET cancelled_at = now() WHERE room_id = $1 AND accepted_at IS NULL AND declined_at IS NULL AND cancelled_at IS NULL`, [roomId]);
    const [t] = await q<{ id: string }>(
      `INSERT INTO room_transfers (room_id, from_user_id, to_user_id, expires_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [roomId, viewer.id, toUserId, new Date(Date.now() + TRANSFER_VALIDITY_DAYS * 86_400_000).toISOString()],
    );
    return { ok: true, transferId: t.id };
  });
}

/** Le transfert prend effet à l'ACCEPTATION du destinataire ; il expire au bout de 7 jours (D5 §4.1). */
export async function answerTransfer(db: Db, viewer: RoomViewer, transferId: string, answer: "accept" | "decline"): Promise<Outcome> {
  return db.transaction(async (q) => {
    const [destination] = await q<{ room_id: string }>(`SELECT room_id FROM room_transfers WHERE id = $1`, [transferId]);
    if (!destination) return refuse("introuvable", "Transfert introuvable.");
    const access = await loadAccess(q, destination.room_id, viewer, { forWrite: true });
    if (!canReadRoom(access) || access.room?.archived_at) return refuse("droit", "Transfert impossible avec ce compte ou dans ce salon.");
    const [t] = await q(`SELECT * FROM room_transfers WHERE id = $1 FOR UPDATE`, [transferId]);
    if (!t || t.to_user_id !== viewer.id) return refuse("introuvable", "Transfert introuvable.");
    if (t.accepted_at || t.declined_at || t.cancelled_at) return refuse("etat", "Transfert déjà traité ou annulé.");
    if (new Date(t.expires_at as string) <= new Date()) return refuse("expire", "Transfert expiré : demandez une nouvelle proposition.");
    if (access.room?.owner_id !== t.from_user_id) return refuse("etat", "La propriété a changé : demandez une nouvelle proposition.");
    if (answer === "decline") {
      await q(`UPDATE room_transfers SET declined_at = now() WHERE id = $1`, [transferId]);
      return { ok: true };
    }
    const [member] = await q(`SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`, [t.room_id, viewer.id]);
    if (!member) return refuse("membre", "Vous avez quitté le salon : le transfert ne peut plus être accepté.");
    await q(`UPDATE room_transfers SET accepted_at = now() WHERE id = $1`, [transferId]);
    await q(`UPDATE rooms SET owner_id = $2, updated_at = now() WHERE id = $1`, [t.room_id, viewer.id]);
    await q(`UPDATE room_members SET role = 'member' WHERE room_id = $1 AND user_id = $2`, [t.room_id, t.from_user_id]);
    await q(`UPDATE room_members SET role = 'owner' WHERE room_id = $1 AND user_id = $2`, [t.room_id, viewer.id]);
    return { ok: true };
  });
}

// ───────────────────────────── Suppression de compte (F02, B20) ─────────────────────────────

/** Salons encore possédés et non archivés : ils bloquent la suppression du compte. */
export async function ownedActiveRooms(q: Query, userId: string): Promise<{ id: string; name: string }[]> {
  return q<{ id: string; name: string }>(`SELECT id, name FROM rooms WHERE owner_id = $1 AND archived_at IS NULL ORDER BY name`, [userId]);
}

/** Nettoyage des salons lors d'une suppression de compte (après le contrôle ownedActiveRooms). */
export async function cleanupRoomsForDeletedAccount(q: Query, userId: string) {
  await lockCommunity(q, true);
  // ACC01 : révocation des flux ouverts de chaque salon AVANT la perte des appartenances.
  const memberships = await q<{ room_id: string }>(`SELECT room_id FROM room_members WHERE user_id = $1`, [userId]);
  for (const m of memberships) await emitRevocation(q, m.room_id, userId);
  await q(`DELETE FROM room_members WHERE user_id = $1`, [userId]);
  await q(
    `UPDATE room_transfers SET cancelled_at = now() WHERE (from_user_id = $1 OR to_user_id = $1) AND accepted_at IS NULL AND declined_at IS NULL AND cancelled_at IS NULL`,
    [userId],
  );
  await q(`UPDATE room_invitations SET revoked_at = now() WHERE created_by = $1 AND used_at IS NULL AND revoked_at IS NULL`, [userId]);
}

// ───────────────────────────── Divers ─────────────────────────────

/** Vérifie qu'une adresse d'exclusion existe : sanction récente à purger automatiquement (aucune donnée). */
export async function sanctionsOf(q: Query, roomId: string, userId: string) {
  return { active: await activeSanction(q, roomId, userId) };
}
