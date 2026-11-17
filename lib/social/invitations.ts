import { createHash, randomBytes } from "node:crypto";
import { activeContributor } from "../community-locks.ts";
import type { Db, Query, Row } from "../editorial/types.ts";
import { configuredAdminEmails } from "../admins.ts";

/** Les adresses de ADMIN_EMAILS entrent toujours : sinon personne ne pourrait ouvrir la bêta. */
const isConfiguredAdmin = (email: string) => configuredAdminEmails().includes(email.trim().toLowerCase());

// Bêta sur invitation (D1 : 30 à 50 personnes invitées).
// - Mode d'inscription : `INSCRIPTIONS=ouvertes|invitation`. Par défaut : sur invitation
//   en production, ouvertes en développement et en test.
// - Une personne DÉJÀ inscrite se connecte toujours, invitation ou pas.
// - Invitation : lien à usage unique, haché en base, valable 14 jours, révocable. Elle voyage
//   avec le lien de connexion et n'est consommée qu'à la CRÉATION du compte, dans la même
//   transaction : une faute de frappe dans l'adresse ne la gaspille pas.
// - Les administrateurs invitent sans limite ; chaque membre actif dispose d'un quota
//   (`LIMIT_MEMBER_INVITES`, 5 par défaut), pour faire grandir la communauté de proche en proche.

export const PLATFORM_INVITE_DAYS = 14;

export function registrationMode(): "ouvertes" | "invitation" {
  const v = (process.env.INSCRIPTIONS ?? "").trim().toLowerCase();
  if (v === "ouvertes" || v === "invitation") return v;
  return process.env.NODE_ENV === "production" ? "invitation" : "ouvertes";
}

export function memberInviteQuota(): number {
  const n = Number.parseInt(process.env.LIMIT_MEMBER_INVITES ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

type Outcome<T = unknown> = ({ ok: true } & T) | { ok: false; code: string; message: string };

export async function createPlatformInvitation(
  q: Query,
  args: { creatorId: string; isAdmin: boolean; note: string },
): Promise<Outcome<{ token: string; id: string; expiresAt: string }>> {
  if (!(await activeContributor(q, args.creatorId))) return { ok: false, code: "droit", message: "Ce compte ne peut pas inviter pour le moment." };
  if (!args.isAdmin) {
    // Verrou par membre : deux créations simultanées ne dépassent pas le quota.
    await q(`SELECT pg_advisory_xact_lock(hashtext('platform-invite:' || $1::text))`, [args.creatorId]);
    const [{ n }] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM platform_invitations WHERE created_by = $1 AND revoked_at IS NULL`, [args.creatorId]);
    if (Number(n) >= memberInviteQuota()) {
      return { ok: false, code: "quota", message: `Vous avez utilisé vos ${memberInviteQuota()} invitations. Révoquez-en une inutilisée pour en créer une autre.` };
    }
  }
  const token = randomBytes(24).toString("base64url");
  const [row] = await q<{ id: string; expires_at: string }>(
    `INSERT INTO platform_invitations (created_by, token_hash, note, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(days => $4)) RETURNING id, expires_at`,
    [args.creatorId, hash(token), args.note.trim().slice(0, 120), PLATFORM_INVITE_DAYS],
  );
  return { ok: true, token, id: row.id, expiresAt: new Date(row.expires_at).toISOString() };
}

/** Invitation encore utilisable (ni utilisée, ni révoquée, ni expirée), avec le nom de la personne qui invite. */
export async function validInvitation(q: Query, token: string): Promise<{ id: string; inviterName: string } | null> {
  if (!token || token.length > 128) return null;
  const [row] = await q<{ id: string; inviter: string }>(
    `SELECT i.id, COALESCE(u.display_name, u.handle, 'Un membre') AS inviter
     FROM platform_invitations i JOIN users u ON u.id = i.created_by
     WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()`,
    [hash(token)],
  );
  return row ? { id: row.id, inviterName: row.inviter } : null;
}

/**
 * Décision à la DEMANDE de lien de connexion. Compte existant : toujours autorisé.
 * Nouveau compte : autorisé si les inscriptions sont ouvertes, ou avec une invitation valide.
 */
export async function signupDecision(
  q: Query,
  email: string,
  invitationToken: string | null,
): Promise<{ allowed: true; invitationId: string | null } | { allowed: false }> {
  const [existing] = await q(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [email.trim()]);
  if (existing) return { allowed: true, invitationId: null };
  const invitation = invitationToken ? await validInvitation(q, invitationToken) : null;
  if (invitation) return { allowed: true, invitationId: invitation.id };
  if (registrationMode() === "ouvertes" || isConfiguredAdmin(email)) return { allowed: true, invitationId: null };
  return { allowed: false };
}

/**
 * Création du compte à la VÉRIFICATION du lien. Compte existant : renvoyé tel quel.
 * Nouveau compte en mode invitation : l'invitation portée par le lien est consommée dans
 * la même transaction que la création ; si elle n'est plus valide, aucun compte n'est créé.
 */
export async function admitByEmail(
  db: Db,
  email: string,
  invitationId: string | null,
): Promise<{ id: string; status: string } | null> {
  return db.transaction(async (q) => {
    const [existing] = await q<{ id: string; status: string }>(`SELECT id, status FROM users WHERE lower(email) = lower($1)`, [email.trim()]);
    if (existing) return existing;
    let consumed: Row | undefined;
    if (invitationId) {
      [consumed] = await q(
        `UPDATE platform_invitations SET used_at = now() WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now() RETURNING id`,
        [invitationId],
      );
    }
    if (!consumed && registrationMode() === "invitation" && !isConfiguredAdmin(email)) return null;
    const [created] = await q<{ id: string; status: string }>(
      `INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO UPDATE SET email = users.email RETURNING id, status`,
      [email.trim()],
    );
    if (consumed) await q(`UPDATE platform_invitations SET used_by = $2 WHERE id = $1`, [consumed.id, created.id]);
    return created;
  });
}

export async function revokePlatformInvitation(q: Query, args: { id: string; userId: string; isAdmin: boolean }): Promise<boolean> {
  const rows = await q(
    `UPDATE platform_invitations SET revoked_at = now()
     WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL AND ($3 OR created_by = $2) RETURNING id`,
    [args.id, args.userId, args.isAdmin],
  );
  return rows.length > 0;
}

export interface InvitationView {
  id: string;
  note: string;
  createdAt: string;
  expiresAt: string;
  state: "active" | "utilisee" | "revoquee" | "expiree";
  usedByHandle: string | null;
  usedByName: string | null;
  creatorName: string | null;
}

export async function listInvitations(q: Query, opts: { creatorId?: string; limit?: number } = {}): Promise<InvitationView[]> {
  const rows = await q(
    `SELECT i.*, u.handle AS used_handle, COALESCE(u.display_name, u.handle) AS used_name,
            COALESCE(c.display_name, c.handle) AS creator_name
     FROM platform_invitations i
     LEFT JOIN users u ON u.id = i.used_by
     JOIN users c ON c.id = i.created_by
     WHERE ($1::uuid IS NULL OR i.created_by = $1)
     ORDER BY i.created_at DESC LIMIT $2`,
    [opts.creatorId ?? null, opts.limit ?? 200],
  );
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id as string,
    note: (r.note as string) ?? "",
    createdAt: new Date(r.created_at as string).toISOString(),
    expiresAt: new Date(r.expires_at as string).toISOString(),
    state: r.used_at ? "utilisee" : r.revoked_at ? "revoquee" : new Date(r.expires_at as string).getTime() <= now ? "expiree" : "active",
    usedByHandle: (r.used_handle as string) ?? null,
    usedByName: (r.used_name as string) ?? null,
    creatorName: (r.creator_name as string) ?? null,
  }));
}
