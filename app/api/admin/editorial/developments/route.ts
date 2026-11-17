import { z } from "zod";
import { db } from "@/lib/db";
import { requestDevelopment } from "@/lib/editorial/development.ts";
import { fail, json, readJson, requireAdmin } from "@/lib/http";

const bodySchema = z.object({ recapItemId: z.uuid() });

/**
 * Demande de développement (lot d'accélération A10). Déclenchement ADMINISTRATEUR
 * uniquement : les demandes publiques restent désactivées tant que D8 est proposé.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  const outcome = await requestDevelopment(db, {
    recapItemId: parsed.data.recapItemId,
    trigger: "admin",
    actorId: guard.user.id,
    actorLabel: guard.user.handle ?? "administrateur",
  });
  if (!outcome.ok) return fail(outcome.message, outcome.code === "introuvable" ? 404 : 409);
  return json({ ok: true, developmentId: outcome.developmentId }, 201);
}
