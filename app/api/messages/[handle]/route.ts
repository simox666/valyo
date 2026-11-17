import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { limitMessage, runLimited } from "@/lib/limits";
import { findRecipient, readThread, sendDirectMessage } from "@/lib/social/messages.ts";

const bodySchema = z.object({ body: z.string().max(4000) });

/** Fil d'une conversation ; l'ouvrir la marque comme lue. */
export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }) {
  const user = await getCurrentUser();
  if (!user?.onboarded) return fail("Connectez-vous pour continuer.", 401);
  const other = await findRecipient(db.query, user.id, (await context.params).handle);
  if (!other.ok) return fail(other.message, other.status);
  return json({ messages: await readThread(db.query, user.id, other.value.id) });
}

/** Envoi d'un message privé. */
export async function POST(request: Request, context: { params: Promise<{ handle: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Message invalide.", 400);
  const recipient = await findRecipient(db.query, guard.user.id, (await context.params).handle);
  if (!recipient.ok) return fail(recipient.message, recipient.status);
  const limited = await runLimited(transaction, "directMessage", guard.user.id, (q) => sendDirectMessage(q, guard.user.id, recipient.value, parsed.data.body));
  if (!limited.ok) return fail(limitMessage("directMessage", limited.rule), 429);
  if (!limited.value.ok) return fail(limited.value.message, limited.value.status);
  return json({ message: limited.value.value }, 201);
}
