import { fail, readJson } from "@/lib/http";
import { shortsAuthorized } from "@/lib/shorts/runs.ts";

const MAX_CHARS = 400;

/**
 * Une phrase du Short lue par la voix de synthèse (OpenAI), en WAV pour que l'automate connaisse sa durée exacte.
 * La clé du service reste sur le serveur ; l'automate n'a que son jeton.
 */
export async function POST(request: Request) {
  if (!shortsAuthorized(request)) return fail("Accès refusé.", 401);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fail("OPENAI_API_KEY n'est pas configurée.", 503);
  const body = ((await readJson(request).catch(() => null)) ?? {}) as { text?: unknown };
  const text = String(body.text ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > MAX_CHARS) return fail(`Texte vide ou trop long (${MAX_CHARS} caractères au plus).`, 400);
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.VALYO_VOIX_MODELE || "gpt-4o-mini-tts",
      voice: process.env.VALYO_SHORTS_VOIX || process.env.VALYO_VOIX || "marin",
      input: text,
      response_format: "wav",
      instructions: "Lis ce texte en français, avec un accent francophone naturel, sur le ton vif et souriant d'une chronique courte pour les réseaux sociaux. Rythme soutenu, articulation nette.",
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) return fail(`Service de voix : réponse ${response.status}.`, 502);
  return new Response(await response.arrayBuffer(), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
}
