import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { mentionSuggestions } from "@/lib/social/people.ts";

/**
 * Contacts du compte connecté pour l'autocomplétion des mentions « @pseudo » :
 * abonnements et abonnés, ou membres d'un salon (`?room=`) puisque seuls eux
 * peuvent y être notifiés. Lecture seule, 6 résultats au plus.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Connectez-vous pour continuer.", 401);
  if (user.status !== "active" || !user.onboarded) return json({ ok: true, contacts: [] });
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 24);
  const room = z.uuid().safeParse(url.searchParams.get("room"));
  const contacts = await mentionSuggestions(db.query, user.id, q, room.success ? room.data : null);
  return json({ ok: true, contacts });
}
