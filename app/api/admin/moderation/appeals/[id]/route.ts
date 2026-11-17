import { z } from "zod";
import { db } from "@/lib/db";
import { fail, json, readJson, requireAdmin } from "@/lib/http";
import { decideAppeal } from "@/lib/social/moderation.ts";

const bodySchema = z.object({ decision: z.enum(["maintenue", "levee"]), reason: z.string().trim().min(5).max(1000) });

/** Décision motivée sur une contestation (D35), par une autre personne que l'auteur de la sanction quand c'est possible. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Contestation introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Décision invalide.", 400);
  const outcome = await decideAppeal(db, { appealId: id, moderatorId: guard.user.id, ...parsed.data });
  if (!outcome.ok) return fail(outcome.message, outcome.code === "introuvable" ? 404 : 409);
  return json({ ok: true });
}
