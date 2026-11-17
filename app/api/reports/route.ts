import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { limitMessage, runLimited } from "@/lib/limits";
import { createReport, REPORT_REASONS } from "@/lib/social/moderation.ts";

const bodySchema = z.object({
  targetKind: z.enum(["post", "comment", "message", "member"]),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).default(""),
});

/**
 * Signalement (D32). Limite D6 : 20 par jour. La réponse ne confirme que la prise en
 * compte : l'identité du signalant n'est jamais exposée hors modération.
 */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Signalement invalide.", 400);
  const limited = await runLimited(transaction, "report", guard.user.id, (q) => createReport(q, { reporterId: guard.user.id, ...parsed.data }));
  if (!limited.ok) return fail(limitMessage("report", limited.rule), 429);
  const outcome = limited.value;
  if (!outcome.ok) return fail(outcome.message, outcome.code === "introuvable" ? 404 : 409);
  return json({ ok: true }, 201);
}
