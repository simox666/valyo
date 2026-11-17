import { lockRoom } from "@/lib/community-locks.ts";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { limitMessage, runLimited } from "@/lib/limits";
import { chatSnapshot, listMessages, sendMessage } from "@/lib/rooms/chat.ts";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";
import type { Outcome } from "@/lib/rooms/service.ts";

const sendSchema = z.object({
  clientId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Identifiant client invalide."),
  body: z.string().trim().min(1, "Message vide.").max(2000, "2 000 caractères maximum."),
});

/** Envoi persistant (F12, C21) : relance sans doublon via l'identifiant client ; limite D6 20/min/salon, atomique. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const parsed = sendSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Requête invalide.", 400);
  const limited = await runLimited(transaction, "roomMessage", `${id}:${guard.user.id}`, (q) => sendMessage(q, viewerOf(guard.user), id, parsed.data));
  if (!limited.ok) return fail(limitMessage("roomMessage", limited.rule), 429);
  const outcome = limited.value as Outcome<{ message: unknown; duplicate: boolean }>;
  if (!outcome.ok) return outcomeJson(outcome);
  return json({ ok: true, message: outcome.message, duplicate: outcome.duplicate }, outcome.duplicate ? 200 : 201);
}

/** Historique paginé (F12, C22) : membres uniquement, ordre stable, chargement vers l'arrière. Lecture : pas de contrôle d'origine. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Connectez-vous pour continuer.", 401);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const url = new URL(request.url);
  const beforeRaw = url.searchParams.get("before");
  const before = beforeRaw !== null && /^\d+$/.test(beforeRaw) ? Number(beforeRaw) : undefined;
  if (before === undefined) {
    const snapshot = await chatSnapshot(db, viewerOf(user), id);
    return snapshot ? json({ ok: true, ...snapshot }) : fail("Salon introuvable.", 404);
  }
  return outcomeJson(await db.transaction(async (q) => {
    await lockRoom(q, id, true);
    return listMessages(q, viewerOf(user), id, { before });
  }));
}
