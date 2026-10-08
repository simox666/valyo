import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createSessionToken, verifyMagicLinkToken, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_SECONDS } from "@/lib/auth";

export const runtime = "nodejs";

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const redirectPath = safeRedirectPath(req.nextUrl.searchParams.get("redirect"));

  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const verified = verifyMagicLinkToken(token);
  if (!verified) {
    // Expired or tampered link — back to the start rather than a dead end;
    // the user can request a fresh one from wherever they were.
    return NextResponse.redirect(new URL(redirectPath, req.url));
  }

  // Idempotent upsert: a returning user just gets their existing row back
  // (the no-op SET lets RETURNING work on conflict without a second query).
  const { rows } = await sql<{ id: string }>`
    INSERT INTO users (email) VALUES (${verified.email})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id
  `;
  const userId = rows[0].id;

  const sessionToken = createSessionToken(userId, verified.email);
  const response = NextResponse.redirect(new URL(redirectPath, req.url));
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
