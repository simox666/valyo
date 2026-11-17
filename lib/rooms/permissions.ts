import type { Query, Row } from "../editorial/types.ts";
import { lockRoom } from "../community-locks.ts";

// Droits des salons, centralisés (lot d'accélération B12 ; spec §3, F10-F11, decisions D5).
// Tous les contrôles sont faits CÔTÉ SERVEUR à chaque requête ; le lot C les réappliquera
// aux flux déjà ouverts (revalidation périodique et révocation).
//
// Vocabulaire :
// - découvrir : savoir que le salon existe (titre, description) ;
// - lire : accéder à l'historique des messages ;
// - rejoindre : devenir membre ;
// - écrire : envoyer, modifier ses messages ;
// - gérer : modifier le salon, rôles, transfert, archivage (propriétaire) ;
// - modérer : retirer des messages, exclure/bannir (propriétaire ou modérateur du salon).

export const KICK_COOLDOWN_HOURS = 24;

export interface RoomViewer {
  id: string;
  status: string; // active | suspended | deleted
  onboarded: boolean;
}

export interface RoomAccess {
  room: Row | null;
  viewer: RoomViewer | null;
  membership: { role: "owner" | "moderator" | "member" } | null;
  /** Sanction active la plus restrictive : bannissement non levé/expiré, ou exclusion de moins de 24 h. */
  sanction: { kind: "kick" | "ban" } | null;
}

/** Sanction encore effective : bannissement non levé et non expiré, ou exclusion de moins de 24 heures. */
export async function activeSanction(q: Query, roomId: string, userId: string): Promise<{ kind: "kick" | "ban" } | null> {
  const [row] = await q<{ kind: "kick" | "ban" }>(
    `SELECT kind FROM room_sanctions
     WHERE room_id = $1 AND user_id = $2 AND lifted_at IS NULL
       AND (
         (kind = 'ban' AND (expires_at IS NULL OR expires_at > now()))
         OR (kind = 'kick' AND created_at > now() - make_interval(hours => $3))
       )
     ORDER BY CASE kind WHEN 'ban' THEN 0 ELSE 1 END LIMIT 1`,
    [roomId, userId, KICK_COOLDOWN_HOURS],
  );
  return row ?? null;
}

/**
 * Charge le contexte de droits. L'identité du lecteur est RELUE EN BASE (ACC03) : le
 * statut fourni par l'authentification peut être périmé au moment de la transaction.
 * Pour une écriture : barrière communauté, verrou de salon, puis compte et appartenance.
 * Le salon est ainsi relu APRÈS attente d'un archivage, départ ou changement de rôle.
 */
export async function loadAccess(q: Query, roomId: string, viewer: RoomViewer | null, { forWrite = false } = {}): Promise<RoomAccess> {
  if (forWrite) await lockRoom(q, roomId);
  const [room] = await q(`SELECT * FROM rooms WHERE id = $1`, [roomId]);
  if (!room || !viewer) return { room: room ?? null, viewer, membership: null, sanction: null };
  const [fresh] = await q<{ status: string; onboarded: boolean }>(
    `SELECT status, (handle IS NOT NULL AND rules_accepted_at IS NOT NULL) AS onboarded FROM users WHERE id = $1 ${forWrite ? "FOR NO KEY UPDATE" : ""}`,
    [viewer.id],
  );
  const resolved: RoomViewer = fresh
    ? { id: viewer.id, status: fresh.status, onboarded: Boolean(fresh.onboarded) }
    : { id: viewer.id, status: "deleted", onboarded: false };
  const [membership] = await q<{ role: "owner" | "moderator" | "member" }>(
    `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2 ${forWrite ? "FOR UPDATE" : ""}`,
    [roomId, viewer.id],
  );
  return { room, viewer: resolved, membership: membership ?? null, sanction: await activeSanction(q, roomId, viewer.id) };
}

const activeViewer = (a: RoomAccess) => Boolean(a.viewer && a.viewer.status === "active" && a.viewer.onboarded);

/** Le salon apparaît (annuaire, recherche, publication liée) : public, ou le lecteur en est membre. */
export function canDiscoverRoom(a: RoomAccess): boolean {
  if (!a.room) return false;
  return a.room.visibility === "public" || Boolean(a.membership);
}

/** Lire l'historique : être membre (même archivé : il reste lisible). Un visiteur ne lit jamais le chat. */
export function canReadRoom(a: RoomAccess): boolean {
  return Boolean(a.room && a.membership && activeViewer(a) && !a.sanction);
}

/**
 * Voir la discussion d'un salon PUBLIC sans en être membre (lecture seule, visiteurs compris) :
 * les salons liés aux articles sont visibles de tous. Jamais un salon privé ; jamais pour un
 * membre exclu ou banni de ce salon. Écrire, suivre, gérer : réservé aux membres (canReadRoom…).
 */
export function canPreviewRoom(a: RoomAccess): boolean {
  return Boolean(a.room && a.room.visibility === "public" && !a.sanction);
}

/** Rejoindre : compte actif, salon public non archivé, ni banni ni exclu depuis moins de 24 h. Privé : invitation uniquement. */
export function canJoinRoom(a: RoomAccess): boolean {
  if (!a.room || !activeViewer(a) || a.membership || a.room.archived_at) return false;
  if (a.sanction) return false;
  return a.room.visibility === "public";
}

/** Accepter une invitation : mêmes conditions, salon privé ou public, mais JAMAIS pendant un bannissement. */
export function canAcceptInvitation(a: RoomAccess): boolean {
  if (!a.room || !activeViewer(a) || a.membership || a.room.archived_at) return false;
  // Une exclusion de moins de 24 h bloque aussi le retour par invitation (retour privé = nouvelle invitation APRÈS l'effet).
  return !a.sanction;
}

/** Écrire dans le chat : membre actif d'un salon non archivé. */
export function canWriteRoom(a: RoomAccess): boolean {
  return Boolean(a.room && !a.room.archived_at && a.membership && activeViewer(a) && !a.sanction);
}

/** Gérer le salon (informations, rôles, transfert, archivage) : propriétaire actif. */
export function canManageRoom(a: RoomAccess): boolean {
  return Boolean(a.room && a.membership?.role === "owner" && activeViewer(a));
}

/** Modérer (retirer un message, exclure, bannir, lever un bannissement) : propriétaire ou modérateur du salon, actif. */
export function canModerateRoom(a: RoomAccess): boolean {
  return Boolean(a.room && (a.membership?.role === "owner" || a.membership?.role === "moderator") && activeViewer(a));
}

/** Inviter : propriétaire ou modérateur, salon non archivé. */
export function canInviteToRoom(a: RoomAccess): boolean {
  return Boolean(a.room && !a.room.archived_at && canModerateRoom(a));
}
