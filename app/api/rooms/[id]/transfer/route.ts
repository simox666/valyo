import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readJson, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { proposeTransfer } from "@/lib/rooms/service.ts";

const bodySchema = z.object({ toUserId: z.uuid() });

/** Proposition de transfert de propriété ; effet à l'acceptation, expiration 7 jours (D5 §4.1). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  return outcomeJson(await proposeTransfer(db, viewerOf(guard.user), id, parsed.data.toUserId));
}
