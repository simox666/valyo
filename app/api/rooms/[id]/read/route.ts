import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, readJson, requireContributor } from "@/lib/http";
import { markRead } from "@/lib/rooms/chat.ts";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";

const bodySchema = z.object({ seq: z.number().int().min(0) });

/** Repère du dernier message lu, MONOTONE (F12, C25). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  return outcomeJson(await transaction((q) => markRead(q, viewerOf(guard.user), id, parsed.data.seq)));
}
