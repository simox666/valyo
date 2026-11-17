import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, readJson, requireContributor } from "@/lib/http";
import { deleteMessage, editMessage } from "@/lib/rooms/chat.ts";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";

const editSchema = z.object({ body: z.string().trim().min(1).max(2000) });
const deleteSchema = z.object({ reason: z.string().trim().min(3).max(500).optional() });

/** Modification par l'auteur (F12). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string; messageId: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id, messageId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(messageId)) return fail("Message introuvable.", 404);
  const parsed = editSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Message invalide (1 à 2 000 caractères).", 400);
  return outcomeJson(await transaction((q) => editMessage(q, viewerOf(guard.user), id, messageId, parsed.data.body)));
}

/** Suppression par l'auteur, ou retrait de modération avec motif enregistré (F12). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string; messageId: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id, messageId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(messageId)) return fail("Message introuvable.", 404);
  const parsed = deleteSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return fail("Motif invalide.", 400);
  return outcomeJson(await transaction((q) => deleteMessage(q, viewerOf(guard.user), id, messageId, parsed.data.reason)));
}
