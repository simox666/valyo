import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { fail, json, readJson, sameOrigin } from "@/lib/http";
import { appealSanction, appealWithToken } from "@/lib/social/moderation.ts";

const bodySchema = z.object({
  actionId: z.uuid(),
  body: z.string().trim().min(10).max(2000),
  /** Compte banni, sans session : jeton de contestation dédié (ACC09). */
  token: z.string().min(10).max(128).optional(),
});

/**
 * Contestation d'une sanction (D35) : une par sanction, dans les 14 jours.
 * - Compte avec session (actif ou suspendu) : voie normale.
 * - Compte BANNI (sessions fermées, connexion refusée) : jeton de contestation obtenu
 *   par /api/appeals/access ; il n'ouvre aucune session et ne sert qu'une fois.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Requête refusée.", 403);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Contestation invalide (10 à 2 000 caractères).", 400);

  const user = parsed.data.token ? null : await getCurrentUser();
  if (!parsed.data.token && !user) return fail("Connectez-vous pour continuer.", 401);
  const outcome = parsed.data.token
    ? await appealWithToken(db, { token: parsed.data.token, actionId: parsed.data.actionId, body: parsed.data.body })
    : await transaction((q) => appealSanction(q, { actionId: parsed.data.actionId, userId: user!.id, body: parsed.data.body }));
  if (!outcome.ok) return fail(outcome.message, outcome.code === "jeton" ? 410 : outcome.code === "introuvable" ? 404 : 409);
  return json({ ok: true }, 201);
}
