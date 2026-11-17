import { db } from "@/lib/db";
import { fail, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { leaveRoom } from "@/lib/rooms/service.ts";

/** Quitter un salon. La personne propriétaire transfère ou archive d'abord (D5 §4.1). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  return outcomeJson(await leaveRoom(db, viewerOf(guard.user), id));
}
