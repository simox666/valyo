import { createHmac, timingSafeEqual } from "crypto";

// No JWT library — a signed token is just base64url(payload) +
// "." + base64url(HMAC-SHA256(payload)), verified by recomputing the
// signature. Stateless on purpose: nothing to revoke, nothing to store
// server-side for sessions, consistent with how the game's own challenge
// links avoided a database entirely (project.md, défi entre amis / scan de
// pièce) — the only reason a real database exists at all here is to persist
// points across sessions, not for auth itself.
const SECRET = process.env.AUTH_SECRET;

function requireSecret(): string {
  if (!SECRET) throw new Error("AUTH_SECRET is not set");
  return SECRET;
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(payload: string): string {
  return base64url(createHmac("sha256", requireSecret()).update(payload).digest());
}

function packToken(payload: object): string {
  const json = Buffer.from(JSON.stringify(payload));
  const encodedPayload = base64url(json);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function unpackToken(token: string): object | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  const expectedSignature = sign(encodedPayload);
  // Constant-time comparison — a plain === lets an attacker learn the
  // correct signature one byte at a time via response-time differences.
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes — just long enough to open an email
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface MagicLinkPayload {
  email: string;
  exp: number;
}

export function createMagicLinkToken(email: string): string {
  return packToken({ email, exp: Date.now() + MAGIC_LINK_TTL_MS });
}

export function verifyMagicLinkToken(token: string): { email: string } | null {
  const payload = unpackToken(token) as MagicLinkPayload | null;
  if (!payload || typeof payload.email !== "string" || typeof payload.exp !== "number") return null;
  if (Date.now() > payload.exp) return null;
  return { email: payload.email };
}

export interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
}

export function createSessionToken(userId: string, email: string): string {
  return packToken({ userId, email, exp: Date.now() + SESSION_TTL_MS });
}

export function verifySessionToken(token: string): { userId: string; email: string } | null {
  const payload = unpackToken(token) as SessionPayload | null;
  if (!payload || typeof payload.userId !== "string" || typeof payload.email !== "string" || typeof payload.exp !== "number") {
    return null;
  }
  if (Date.now() > payload.exp) return null;
  return { userId: payload.userId, email: payload.email };
}

export const SESSION_COOKIE_NAME = "valyo_session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
