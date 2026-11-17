import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { linkedRooms } from "@/lib/rooms/discovery.ts";

/** Salons liés à une publication : les publics pour tous, les privés seulement pour leurs membres. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Publication introuvable.", 404);
  const user = await getCurrentUser();
  const rooms = (await linkedRooms(db.query, [id], user?.onboarded ? user.id : null)).get(id) ?? [];
  return json({ rooms });
}
