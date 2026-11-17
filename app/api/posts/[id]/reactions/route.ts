import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { REACTION_KINDS } from "@/lib/social/reaction-kinds.ts";
import { toggleReaction } from "@/lib/social/reactions.ts";

const bodySchema = z.object({ kind: z.enum(REACTION_KINDS), on: z.boolean() });

/** Ajouter ou retirer une réaction rapide sous une publication. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Publication introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Réaction invalide.", 400);
  const outcome = await transaction((q) => toggleReaction(q, { userId: guard.user.id, postId: id, ...parsed.data }));
  return outcome.ok ? json({ ok: true, ...outcome.summary }) : fail(outcome.message, outcome.status);
}
