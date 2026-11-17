import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { fail, json, readJson, sameOrigin } from "@/lib/http";
import { createFeedback, FEEDBACK_KINDS } from "@/lib/social/feedback.ts";

const bodySchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  body: z.string().trim().min(5, "Quelques mots au moins (5 caractères).").max(2000, "2 000 caractères au plus."),
  page: z.string().max(300).default(""),
});

/** Avis d'un testeur de la bêta. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Requête refusée.", 403);
  const user = await getCurrentUser();
  if (!user?.onboarded) return fail("Connectez-vous pour donner votre avis.", 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Avis invalide.", 400);
  const outcome = await transaction((q) => createFeedback(q, { userId: user.id, ...parsed.data }));
  return outcome.ok ? json({ ok: true }, 201) : fail(outcome.message, 429);
}
