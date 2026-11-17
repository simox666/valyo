import { z } from "zod";
import { transaction } from "@/lib/db";
import { logRevision } from "@/lib/editorial/config.ts";
import { adminAction } from "@/lib/editorial/tasks.ts";
import { fail, json, readJson, requireAdmin } from "@/lib/http";

const bodySchema = z.object({ action: z.enum(["retry", "cancel"]) });

/** Relancer une tâche en examen ou annulée, ou annuler une tâche en attente. Tâches incertaines : aucune action automatique. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Tâche introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Action invalide.", 400);
  const done = await transaction(async (q) => {
    const ok = await adminAction(q, id, parsed.data.action);
    if (ok) await logRevision(q, { entity: "task", entityId: id, reason: parsed.data.action === "retry" ? "Relance manuelle" : "Annulation manuelle", actorId: guard.user.id, actorLabel: guard.user.handle ?? "administrateur" });
    return ok;
  });
  return done ? json({ ok: true }) : fail("Action impossible dans l'état actuel de la tâche.", 409);
}
