import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { toggleRelay } from "@/lib/social/relays.ts";

const bodySchema = z.object({
  on: z.boolean(),
  note: z.string().trim().max(500, "500 caractères au plus.").default(""),
});

/** Relayer une publication à ses abonnés (avec un avis facultatif), ou retirer son relais. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Publication introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Demande invalide.", 400);
  const outcome = await transaction((q) => toggleRelay(q, { userId: guard.user.id, postId: id, ...parsed.data }));
  return outcome.ok ? json({ ok: true, ...outcome.summary }) : fail(outcome.message, outcome.status);
}
