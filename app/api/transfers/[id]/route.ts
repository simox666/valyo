import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readJson, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { answerTransfer } from "@/lib/rooms/service.ts";

const bodySchema = z.object({ answer: z.enum(["accept", "decline"]) });

/** Réponse du destinataire à un transfert de propriété (D5 §4.1). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Transfert introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  return outcomeJson(await answerTransfer(db, viewerOf(guard.user), id, parsed.data.answer));
}
