import { z } from "zod";
import { transaction } from "@/lib/db";
import { markRecapReady } from "@/lib/editorial/revision.ts";
import { fail, json, readJson, requireAdmin } from "@/lib/http";

const bodySchema = z.object({ action: z.literal("ready"), expectedVersion: z.number().int().positive(), motif: z.string().trim().min(5).max(500) });

/**
 * Revalidation d'un brouillon après révision (ACC05) : possible seulement quand chaque
 * élément porte une vérification valide ou une relecture humaine.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Récapitulatif introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  const outcome = await transaction((q) =>
    markRecapReady(q, { recapId: id, expectedVersion: parsed.data.expectedVersion, motif: parsed.data.motif, actorId: guard.user.id, actorLabel: guard.user.handle ?? "administrateur" }),
  );
  if (!outcome.ok) return fail(outcome.message, outcome.code === "introuvable" ? 404 : 409);
  return json({ ok: true });
}
