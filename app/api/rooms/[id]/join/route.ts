import { db } from "@/lib/db";
import { fail, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { joinRoom } from "@/lib/rooms/service.ts";

/** Rejoindre un salon public (F11). Un salon privé passe par une invitation. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  return outcomeJson(await joinRoom(db, viewerOf(guard.user), id));
}
