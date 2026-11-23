import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { query, queryOne, transaction, type QueryFn } from "./db";
import { recordActivity } from "./data/metrics";
import { applyEffectiveStatus } from "./social/moderation.ts";
import { lockCommunity } from "./community-locks.ts";
import { configuredAdminEmails } from "./admins.ts";

// Connexion par lien magique envoyé par e-mail (vérifie la possession de
// l'adresse, F01). Sessions stockées en base pour pouvoir les fermer :
// déconnexion, suppression de compte, suspension.

export const SESSION_COOKIE = "valyo_session";
const SESSION_DAYS = 60;
const LOGIN_TOKEN_MINUTES = 15;

export interface CurrentUser {
  id: string;
  email: string;
  handle: string | null;
  displayName: string | null;
  avatarId: string | null;
  role: "member" | "admin" | "agent";
  status: "active" | "suspended" | "banned" | "deleted";
  onboarded: boolean;
  isAdmin: boolean;
}

/** Administrateurs désignés par configuration (ADMIN_EMAILS, adresses séparées par des virgules) ou par rôle en base. */
function isAdminEmail(email: string | null): boolean {
  if (!email) return false;
  const list = configuredAdminEmails();
  return list.includes(email.toLowerCase());
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** N'accepte qu'un chemin interne, pour que le retour au contexte ne puisse pas rediriger hors du site. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next.slice(0, 500);
}

/** `q` permet d'écrire dans la transaction de la limite de fréquence (lib/limits.ts). */
export async function createLoginToken(email: string, nextPath: string, q: QueryFn = query, invitationId: string | null = null): Promise<string> {
  const token = newToken();
  // Rétention (RGPD) : les jetons expirés gardent une adresse e-mail en clair sans utilité.
  // 7 jours de marge pour la limite de fréquence (lib/limits.ts compte sur une fenêtre bien plus courte).
  await q(`DELETE FROM login_tokens WHERE expires_at < now() - interval '7 days'`);
  await q(
    `INSERT INTO login_tokens (token_hash, email, next_path, expires_at, invitation_id)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4), $5)`,
    [hashToken(token), email, safeNextPath(nextPath), LOGIN_TOKEN_MINUTES, invitationId],
  );
  return token;
}

/** Usage unique : la mise à jour conditionnelle empêche deux utilisations concurrentes du même lien. */
export async function consumeLoginToken(token: string): Promise<{ email: string; nextPath: string; invitationId: string | null } | null> {
  const row = await queryOne<{ email: string; next_path: string; invitation_id: string | null }>(
    `UPDATE login_tokens SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING email, next_path, invitation_id`,
    [hashToken(token)],
  );
  return row ? { email: row.email, nextPath: row.next_path, invitationId: row.invitation_id ?? null } : null;
}

export async function createSession(userId: string): Promise<{ token: string; maxAge: number } | null> {
  const token = newToken();
  return transaction(async (q) => {
    await lockCommunity(q);
    const [user] = await q(`SELECT status FROM users WHERE id = $1 FOR NO KEY UPDATE`, [userId]);
    if (!user || user.status === "banned" || user.status === "deleted") return null;
    await q(`DELETE FROM sessions WHERE expires_at < now()`); // rétention : les sessions expirées ne servent plus à rien
    await q(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`, [hashToken(token), userId, SESSION_DAYS]);
    return { token, maxAge: SESSION_DAYS * 24 * 60 * 60 };
  });
}

export async function destroySession(token: string | undefined) {
  if (token) await transaction(async (q) => {
    await lockCommunity(q, true);
    await q(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  });
}

export async function destroyAllSessions(userId: string) {
  await transaction(async (q) => {
    await lockCommunity(q, true);
    await q(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await queryOne<{
    id: string;
    email: string;
    handle: string | null;
    display_name: string | null;
    avatar_image_id: string | null;
    role: CurrentUser["role"];
    status: CurrentUser["status"];
    rules_accepted_at: string | null;
  }>(
    `SELECT u.id, u.email, u.handle, u.display_name, u.avatar_image_id, u.role, u.status, u.rules_accepted_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status <> 'deleted'`,
    [hashToken(token)],
  );
  if (!row || row.status === "banned") return null;
  // Une suspension datée expire d'elle-même (D33) ; un bannissement, jamais. Le statut
  // est RECALCULÉ depuis les sanctions encore applicables (ACC02) : l'expiration d'une
  // suspension ne masque jamais une sanction plus récente.
  if (row.status === "suspended") {
    const [u] = await query<{ suspended_until: string | null }>(`SELECT suspended_until FROM users WHERE id = $1`, [row.id]);
    if (u?.suspended_until && new Date(u.suspended_until) <= new Date()) {
      row.status = (await transaction((q) => applyEffectiveStatus(q, row.id))) as CurrentUser["status"];
    }
  }
  const onboarded = Boolean(row.handle && row.rules_accepted_at);
  if (onboarded) await recordActivity(row.id);
  return {
    id: row.id,
    email: row.email,
    handle: row.handle,
    displayName: row.display_name,
    avatarId: row.avatar_image_id ?? null,
    role: row.role,
    status: row.status,
    onboarded,
    isAdmin: onboarded && row.status === "active" && (row.role === "admin" || isAdminEmail(row.email)),
  };
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
