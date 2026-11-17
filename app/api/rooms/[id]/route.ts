import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readJson, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { updateRoom } from "@/lib/rooms/service.ts";

const bodySchema = z.object({
  name: z.string().trim().min(3).max(60).optional(),
  description: z.string().trim().max(280).optional(),
  format: z.enum(["chat", "chat_vocal"]).optional(),
  archive: z.boolean().optional(),
});

/** Modification et archivage par la personne propriétaire (F10). Le niveau public/privé est fixé à la création (V1). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  return outcomeJson(await updateRoom(db, viewerOf(guard.user), id, parsed.data));
}
