import { transaction } from "@/lib/db";
import { fail, json, readBodyCapped, requireContributor } from "@/lib/http";
import { limitMessage, limitRule, runLimited } from "@/lib/limits";
import { MAX_AUDIO_BYTES, sendVoiceMessage } from "@/lib/rooms/audio.ts";
import { outcomeJson, viewerOf } from "@/lib/rooms/http.ts";

/**
 * Envoi d'un message vocal : le corps de la requête EST l'enregistrement ; l'identifiant
 * client (relance sans doublon) et la durée passent dans l'adresse. Mêmes limites que les
 * messages écrits (20/min/salon), plus un quota quotidien de messages vocaux par membre.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  const durationMs = Number(url.searchParams.get("duree"));
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(clientId) || !Number.isFinite(durationMs) || durationMs < 300) return fail("Enregistrement trop court ou requête invalide.", 400);
  const data = await readBodyCapped(request, MAX_AUDIO_BYTES);
  if (!data || data.length === 0) return fail("Enregistrement trop lourd : 2 minutes au plus.", 413);

  const user = guard.user;
  const limited = await runLimited(transaction, "roomAudio", user.id, async (q) => {
    // Seconde limite, dans la même transaction : la cadence par salon des messages écrits.
    const perMinute = limitRule("roomMessage");
    const [recent] = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM room_messages WHERE room_id = $1 AND author_id = $2 AND created_at > now() - make_interval(mins => $3)`,
      [id, user.id, perMinute.windowMinutes],
    );
    if (Number(recent.n) >= perMinute.max) return { ok: false as const, code: "cadence", message: limitMessage("roomMessage", perMinute) };
    return sendVoiceMessage(q, viewerOf(user), id, { clientId, data, durationMs });
  });
  if (!limited.ok) return fail(limitMessage("roomAudio", limited.rule), 429);
  const outcome = limited.value;
  if (!outcome.ok) return outcome.code === "cadence" ? fail(outcome.message, 429) : outcome.code === "format" || outcome.code === "taille" ? fail(outcome.message, 400) : outcomeJson(outcome);
  return json({ ok: true, message: outcome.message, duplicate: outcome.duplicate }, outcome.duplicate ? 200 : 201);
}
