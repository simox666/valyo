import { open } from "node:fs/promises";
import { getSyntheses } from "@/lib/actus/synthesis.ts";
import { getPost } from "@/lib/data/posts";
import { db } from "@/lib/db";
import { clientIp, createIpLimiter } from "@/lib/ip-limit.ts";
import { getOrCreateAudio, openAiVoice, type AudioKind } from "@/lib/lecture-audio.ts";
import { guessLang, synthesisSpeech } from "@/lib/lecture.ts";

// Fabriquer un son coûte quelques centimes : au plus 20 fabrications par heure et par adresse IP
// (les sons déjà fabriqués ne sont pas comptés), en plus du plafond quotidien global.
const perIp = createIpLimiter(20, 60 * 60 * 1000);

/**
 * Lecture audio d'une publication publique (`?type=article` ou `?type=synthese`), avec une voix naturelle.
 * Le texte est toujours recalculé ici, jamais fourni par le navigateur. Réponses partielles (Range) prises
 * en charge : Safari les exige. 404 si la voix naturelle n'est pas disponible : le bouton se rabat alors
 * sur la voix de l'appareil.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const kind: AudioKind = new URL(request.url).searchParams.get("type") === "synthese" ? "synthese" : "article";
  const post = await getPost(id);
  if (!post || post.status !== "published") return new Response("Introuvable", { status: 404 });

  let text: string;
  let lang: "fr" | "en";
  if (kind === "synthese") {
    const state = (await getSyntheses(db.query, [id])).get(id);
    if (state?.status !== "ready") return new Response("Introuvable", { status: 404 });
    text = synthesisSpeech(state.content);
    lang = "fr";
  } else {
    // Seuls les articles de presse importés sont envoyés au service de voix : un texte écrit par un
    // membre reste lu par la voix de son appareil (aucune donnée de membre ne quitte Valyo).
    if (!post.sourceName) return new Response("Introuvable", { status: 404 });
    text = `${post.title}. ${post.body.split("\n\n———\n\n")[0]}`;
    lang = guessLang(text);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const allowed = perIp.allow(clientIp(request));
  const voice = apiKey && allowed ? openAiVoice({ apiKey }) : null;
  const result = await getOrCreateAudio(db.query, { postId: id, kind, text, lang }, voice);
  if (!result.ok) return new Response("Voix naturelle indisponible", { status: result.reason === "quota" || !allowed ? 429 : 404 });

  let handle;
  try { handle = await open(result.file, "r"); } catch { return new Response("Introuvable", { status: 404 }); }
  try {
    const size = (await handle.stat()).size;
    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
    let start = 0;
    let end = size - 1;
    let status = 200;
    if (range && (range[1] || range[2])) {
      if (range[1]) { start = Number(range[1]); if (range[2]) end = Math.min(Number(range[2]), size - 1); }
      else { start = Math.max(size - Number(range[2]), 0); }
      if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    }
    const length = end - start + 1;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    headers["Content-Length"] = String(length);
    return new Response(new Uint8Array(buffer), { status, headers });
  } finally {
    await handle.close();
  }
}
