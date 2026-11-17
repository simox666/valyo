import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { unreadConversationCount } from "@/lib/social/messages.ts";

/** Nombre de conversations non lues (pastille du menu). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.onboarded) return fail("Connectez-vous pour continuer.", 401);
  return json({ unread: await unreadConversationCount(db.query, user.id) });
}
