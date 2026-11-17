import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, requireAdmin } from "@/lib/http";
import { setFeedbackStatus } from "@/lib/social/feedback.ts";

const bodySchema = z.object({ status: z.enum(["nouveau", "traite"]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Avis introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  const done = await transaction((q) => setFeedbackStatus(q, id, parsed.data.status));
  return done ? json({ ok: true }) : fail("Avis introuvable.", 404);
}
