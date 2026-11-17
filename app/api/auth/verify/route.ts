import { NextResponse } from "next/server";
import { consumeLoginToken, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { db, queryOne } from "@/lib/db";
import { admitByEmail } from "@/lib/social/invitations.ts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.APP_URL || url.origin;
  const token = url.searchParams.get("token") || "";
  const consumed = token ? await consumeLoginToken(token) : null;
  if (!consumed) return NextResponse.redirect(`${origin}/connexion?erreur=lien`, 303);

  // Bêta sur invitation : un NOUVEAU compte n'est créé qu'avec une invitation encore valide.
  const user = await admitByEmail(db, consumed.email, consumed.invitationId);
  if (!user) return NextResponse.redirect(`${origin}/connexion?erreur=invitation`, 303);
  // Bannissement de plateforme (D5 §4.3) : aucune nouvelle connexion.
  if (user.status === "banned") return NextResponse.redirect(`${origin}/connexion?erreur=banni`, 303);
  const session = await createSession(user.id);
  if (!session) return NextResponse.redirect(`${origin}/connexion?erreur=banni`, 303);
  const { token: sessionToken, maxAge } = session;

  const profile = await queryOne<{ handle: string | null; rules_accepted_at: string | null }>(
    `SELECT handle, rules_accepted_at FROM users WHERE id = $1`,
    [user.id],
  );
  const onboarded = Boolean(profile?.handle && profile.rules_accepted_at);
  const destination = onboarded
    ? consumed.nextPath
    : `/bienvenue?next=${encodeURIComponent(consumed.nextPath)}`;

  const response = NextResponse.redirect(`${origin}${destination}`, 303);
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(maxAge));
  return response;
}
