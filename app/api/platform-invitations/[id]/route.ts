import { transaction } from "@/lib/db";
import { fail, json, requireContributor } from "@/lib/http";
import { revokePlatformInvitation } from "@/lib/social/invitations.ts";

/** Révoque une invitation inutilisée (la sienne, ou n'importe laquelle pour l'administration). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invitation introuvable.", 404);
  const done = await transaction((q) => revokePlatformInvitation(q, { id, userId: guard.user.id, isAdmin: guard.user.isAdmin }));
  return done ? json({ ok: true }) : fail("Invitation déjà utilisée, révoquée ou introuvable.", 409);
}
