import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readJson, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { acceptInvitation } from "@/lib/rooms/service.ts";

const bodySchema = z.object({ token: z.string().min(10).max(128) });

/** Acceptation EXPLICITE d'une invitation, après connexion (F11). Consommation atomique, usage unique. */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Invitation invalide.", 400);
  return outcomeJson(await acceptInvitation(db, viewerOf(guard.user), parsed.data.token));
}
