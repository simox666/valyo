import { db } from "@/lib/db";
import { fail, json, requireContributor } from "@/lib/http";
import { subscriptionsOf } from "@/lib/push/core.ts";
import { deliver } from "@/lib/push/send";

/** Notification de test : envoyée tout de suite aux appareils abonnés du membre connecté, et à lui seul. */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const devices = await subscriptionsOf(db.query, [guard.user.id]);
  if (!devices.length) return fail("Aucun appareil abonné : activez d’abord les notifications sur cet appareil.", 409);
  const { sent, failed } = await deliver([{
    userId: guard.user.id,
    title: "Valyo",
    body: "Les notifications fonctionnent sur cet appareil.",
    url: "/notifications",
    tag: "test",
  }]);
  if (sent === 0) return fail("L’envoi a été refusé par le service de notification. Désactivez puis réactivez les notifications.", 502);
  return json({ ok: true, sent, failed });
}
