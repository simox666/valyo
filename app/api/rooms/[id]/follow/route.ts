import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readJson, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { setFollowing } from "@/lib/rooms/service.ts";

const bodySchema = z.object({ following: z.boolean() });

/** Suivre un salon (notifications) : action distincte de l'adhésion (F11). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  return outcomeJson(await setFollowing(db, viewerOf(guard.user), id, parsed.data.following));
}
