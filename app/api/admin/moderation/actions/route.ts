import { z } from "zod";
import { db } from "@/lib/db";
import { fail, json, readJson, requireAdmin } from "@/lib/http";
import { moderate } from "@/lib/social/moderation.ts";

const bodySchema = z.object({
  targetUserId: z.uuid(),
  actionId: z.uuid().optional(),
  reportId: z.uuid().nullable().optional(),
  kind: z.enum(["remove_content", "warn", "suspend", "ban", "lift"]),
  contentKind: z.enum(["post", "comment", "message"]).optional(),
  contentId: z.uuid().optional(),
  reason: z.string().trim().min(5).max(500),
  durationDays: z.union([z.literal(7), z.literal(30), z.null()]).optional(),
}).refine((body) => body.kind !== "lift" || Boolean(body.actionId), { message: "Indiquer la sanction à lever.", path: ["actionId"] });

/** Actions humaines de modération (D33) : retrait, avertissement, suspension, bannissement, levée. Journalisées et notifiées. */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Action invalide.", 400);
  const outcome = await moderate(db, { moderatorId: guard.user.id, ...parsed.data, reportId: parsed.data.reportId ?? null });
  if (!outcome.ok) return fail(outcome.message, outcome.code === "introuvable" ? 404 : 409);
  return json({ ok: true, actionId: outcome.actionId }, 201);
}
