import { z } from "zod";
import { transaction } from "@/lib/db";
import { logRevision } from "@/lib/editorial/config.ts";
import { fail, json, readJson, requireAdmin } from "@/lib/http";

const bodySchema = z.object({
  active: z.boolean(),
  authorizationReference: z.string().trim().min(5).max(500).optional(),
  reason: z.string().trim().min(3).max(300),
});

/**
 * Activation : exige la référence du contrôle d'autorisation (conditions d'usage, flux officiel…), datée maintenant.
 * Désactivation : plus de collecte, et les brouillons qui en dépendent repassent en examen (contrat §4).
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Source introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Requête invalide.", 400);
  const b = parsed.data;
  if (b.active && !b.authorizationReference) return fail("Indiquez la référence du contrôle d'autorisation avant d'activer la source.", 400);

  const result = await transaction(async (q) => {
    const [before] = await q(`SELECT * FROM editorial_sources WHERE id = $1 FOR UPDATE`, [id]);
    if (!before) return null;
    if (b.active) {
      await q(`UPDATE editorial_sources SET active = true, authorization_checked_at = now(), authorization_reference = $2 WHERE id = $1`, [id, b.authorizationReference]);
    } else {
      await q(`UPDATE editorial_sources SET active = false WHERE id = $1`, [id]);
      await q(
        `UPDATE editorial_recaps SET state = 'review_required', updated_at = now(), notes = notes || '{"motif": "source_desactivee"}'::jsonb
         WHERE state IN ('planned', 'ready') AND id IN (
           SELECT i.recap_id FROM editorial_recap_items i JOIN editorial_documents d ON d.subject_id = i.subject_id WHERE d.source_id = $1
           UNION SELECT s.recap_id FROM editorial_subjects s JOIN editorial_documents d ON d.subject_id = s.id WHERE d.source_id = $1 AND s.recap_id IS NOT NULL)`,
        [id],
      );
    }
    const [after] = await q(`SELECT * FROM editorial_sources WHERE id = $1`, [id]);
    await logRevision(q, { entity: "source", entityId: id, before, after, reason: b.reason, actorId: guard.user.id, actorLabel: guard.user.handle ?? "administrateur" });
    return after;
  });
  return result ? json({ ok: true }) : fail("Source introuvable.", 404);
}
