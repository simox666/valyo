import { db } from "@/lib/db";
import { fail, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { revokeInvitation } from "@/lib/rooms/service.ts";

/** Révocation d'une invitation non utilisée (F11). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string; invitationId: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id, invitationId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(invitationId)) return fail("Invitation introuvable.", 404);
  return outcomeJson(await revokeInvitation(db, viewerOf(guard.user), id, invitationId));
}
