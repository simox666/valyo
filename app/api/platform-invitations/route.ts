import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { createPlatformInvitation } from "@/lib/social/invitations.ts";

const bodySchema = z.object({ note: z.string().trim().max(120).default("") });

/** Crée une invitation à la bêta. Le lien n'est renvoyé qu'une fois ; seul son haché est stocké. */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Note trop longue (120 caractères au plus).", 400);
  const outcome = await transaction((q) => createPlatformInvitation(q, { creatorId: guard.user.id, isAdmin: guard.user.isAdmin, note: parsed.data.note }));
  if (!outcome.ok) return fail(outcome.message, outcome.code === "quota" ? 409 : 403);
  return json({ ok: true, id: outcome.id, path: `/rejoindre/${outcome.token}`, expiresAt: outcome.expiresAt }, 201);
}
