import { z } from "zod";
import { db, transaction } from "@/lib/db";
import { fail, json, readJson, requireAdmin } from "@/lib/http";
import { dismissReport, reportContext } from "@/lib/social/moderation.ts";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("context") }),
  z.object({ action: z.literal("dismiss"), reason: z.string().trim().min(3).max(500) }),
]);

/**
 * Traitement d'un signalement : consultation du contexte privé BORNÉ (±10 messages,
 * ±30 minutes — chaque consultation est journalisée, D34) ou classement sans suite.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Signalement introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  if (parsed.data.action === "context") {
    const outcome = await reportContext(db, { reportId: id, moderatorId: guard.user.id });
    if (!outcome.ok) return fail(outcome.message, 404);
    return json({ ok: true, messages: outcome.messages });
  }
  const done = await transaction((q) => dismissReport(q, id, guard.user.id, parsed.data.action === "dismiss" ? parsed.data.reason : ""));
  return done ? json({ ok: true }) : fail("Signalement déjà traité.", 409);
}
