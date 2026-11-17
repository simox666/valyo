import { z } from "zod";
import { transaction } from "@/lib/db";
import { limitMessage, runLimited } from "@/lib/limits";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import { createRoom, type Outcome } from "@/lib/rooms/service.ts";

const bodySchema = z.object({
  name: z.string().trim().min(3, "Nom de 3 à 60 caractères.").max(60, "Nom de 3 à 60 caractères."),
  description: z.string().trim().max(280, "Description de 280 caractères au plus.").default(""),
  themeId: z.uuid().nullable().default(null),
  visibility: z.enum(["public", "private"]),
  format: z.enum(["chat", "chat_vocal"]).default("chat"),
  postId: z.uuid().nullable().default(null),
});

/** Création d'un salon (F10), autonome ou depuis une publication. Limite D6 : 5 par jour et par membre. */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Requête invalide.", 400);
  const limited = await runLimited(transaction, "roomCreate", guard.user.id, (q) => createRoom(q, viewerOf(guard.user), parsed.data));
  if (!limited.ok) return fail(limitMessage("roomCreate", limited.rule), 429);
  const outcome = limited.value as Outcome<{ roomId: string }>;
  return outcome.ok ? json({ ok: true, roomId: outcome.roomId }, 201) : outcomeJson(outcome);
}
