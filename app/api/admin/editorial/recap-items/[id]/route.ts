import { z } from "zod";
import { transaction } from "@/lib/db";
import { approveRecapItem, reviseRecapItem } from "@/lib/editorial/revision.ts";
import { fail, json, readJson, requireAdmin } from "@/lib/http";

const bodySchema = z.object({
  title: z.string().trim().min(5).max(200),
  summary: z.string().trim().min(20).max(1200),
  motif: z.string().trim().min(5).max(500),
});

/** Révision éditoriale d'un élément de récapitulatif non publié (A7) : texte corrigé, motif obligatoire, vérification invalidée. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Élément introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Révision invalide : titre (5 à 200), résumé (20 à 1200) et motif (5 à 500) sont obligatoires.", 400);
  const outcome = await transaction((q) =>
    reviseRecapItem(q, {
      itemId: id,
      ...parsed.data,
      actorId: guard.user.id,
      actorLabel: guard.user.handle ?? "administrateur",
    }),
  );
  if (!outcome.ok) return fail(outcome.message, outcome.code === "introuvable" ? 404 : 409);
  return json({ ok: true, verificationInvalidee: outcome.verificationInvalidated });
}

const approveSchema = z.object({ action: z.literal("relecture"), expectedVersion: z.number().int().positive(), motif: z.string().trim().min(5).max(500) });

/** Relecture humaine d'un élément révisé (ACC05) : atteste la fidélité du texte exact contre les sources. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Élément introuvable.", 404);
  const parsed = approveSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Relecture invalide : motif de 5 à 500 caractères.", 400);
  const outcome = await transaction((q) =>
    approveRecapItem(q, { itemId: id, expectedVersion: parsed.data.expectedVersion, motif: parsed.data.motif, actorId: guard.user.id, actorLabel: guard.user.handle ?? "administrateur" }),
  );
  if (!outcome.ok) return fail(outcome.message, outcome.code === "introuvable" ? 404 : 409);
  return json({ ok: true });
}
