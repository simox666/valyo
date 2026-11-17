import { transaction } from "@/lib/db";
import { fail, json, requireContributor } from "@/lib/http";
import { limitMessage, runLimited } from "@/lib/limits";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { createInvitation, type Outcome } from "@/lib/rooms/service.ts";

/**
 * Invitation révocable, expirante (7 jours), à usage unique (F11). Limite D6 : 20 par jour
 * et par salon. Le jeton n'est renvoyé qu'UNE fois, à sa création ; seul son haché est stocké.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const limited = await runLimited(transaction, "roomInvite", id, (q) => createInvitation(q, viewerOf(guard.user), id));
  if (!limited.ok) return fail(limitMessage("roomInvite", limited.rule), 429);
  const outcome = limited.value as Outcome<{ token: string; invitationId: string; expiresAt: string }>;
  if (!outcome.ok) return outcomeJson(outcome);
  return json({ ok: true, invitationId: outcome.invitationId, expiresAt: outcome.expiresAt, url: `/invitations/${outcome.token}` }, 201);
}
