import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { listNotifications, markNotificationsRead, unreadNotificationCount } from "@/lib/social/notifications.ts";

/** Notifications du compte connecté (D29). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Connectez-vous pour continuer.", 401);
  const [notifications, unread] = await Promise.all([listNotifications(db.query, user.id), unreadNotificationCount(db.query, user.id)]);
  return json({ ok: true, notifications, unread });
}

const bodySchema = z.union([z.object({ ids: z.array(z.uuid()).min(1).max(100) }), z.object({ all: z.literal(true) })]);

/** Marquage lu (précis ou global). */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  await transaction((q) => markNotificationsRead(q, guard.user.id, "all" in parsed.data ? "all" : parsed.data.ids));
  return json({ ok: true });
}
