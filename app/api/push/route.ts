import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, json, readJson, requireContributor, sameOrigin } from "@/lib/http";
import { isPushEndpoint, removeSubscription, saveSubscription } from "@/lib/push/core.ts";
import { vapid } from "@/lib/push/send";

const subscribeSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint, "Service de notification non reconnu."),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

/** Clé publique du serveur, dont le navigateur a besoin pour s'abonner. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.onboarded) return fail("Connectez-vous pour continuer.", 401);
  return json({ ok: true, publicKey: (await vapid()).publicKey });
}

/** Abonne cet appareil aux notifications du membre connecté. */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = subscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Abonnement invalide.", 400);
  await saveSubscription(db.query, guard.user.id, parsed.data);
  return json({ ok: true }, 201);
}

/** Désabonne cet appareil (bouton « Désactiver », déconnexion). Possible même compte suspendu. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail("Requête refusée.", 403);
  const user = await getCurrentUser();
  if (!user) return fail("Connectez-vous pour continuer.", 401);
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  await removeSubscription(db.query, parsed.data.endpoint, user.id);
  return json({ ok: true });
}
