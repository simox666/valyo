import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Query } from "./editorial/types.ts";

// Lecture audio avec une voix naturelle (service de synthèse vocale). Le son est fabriqué au premier
// clic sur « Écouter », puis conservé : les écoutes suivantes ne coûtent rien. Un fichier par
// publication et par type (article ou synthèse) ; si le texte change, il est refait.
// Garde-fous : longueur plafonnée par écoute, et nombre de caractères plafonné par jour.

export type AudioKind = "article" | "synthese";
/** Fabrique le son d'un passage (MP3). Injecté : les tests n'appellent aucun service. */
export type Voice = (text: string, lang: "fr" | "en") => Promise<Buffer>;

export const MAX_SPOKEN_CHARS = 6000;
/** Limite par appel du service de voix (4 096 caractères), avec une marge. */
const REQUEST_CHARS = 3800;

const uploadsDir = () => process.env.UPLOADS_DIR || path.join(process.cwd(), ".data", "uploads");
export const lectureDir = () => path.join(uploadsDir(), "lecture");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const lectureFile = (id: string) => path.join(lectureDir(), id);

export const dailyCharLimit = () => Math.max(0, Number.parseInt(process.env.VALYO_AUDIO_CARACTERES_PAR_JOUR ?? "", 10) || 200_000);
/** La voix naturelle n'est proposée que si une clé du service est configurée. */
export const naturalVoiceEnabled = () => Boolean(process.env.OPENAI_API_KEY);

/** Texte réellement lu : espaces normalisés, adresses retirées, coupé proprement à la fin d'une phrase. */
export function spokenText(text: string, max = MAX_SPOKEN_CHARS): string {
  const clean = text.replace(/https?:\/\/\S+/g, " ").replace(/[*_#>`]+/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const end = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  return end > max * 0.5 ? slice.slice(0, end + 1) : slice;
}

/** Découpe en morceaux acceptés par le service, sans couper une phrase quand c'est possible. */
export function requestChunks(text: string, max = REQUEST_CHARS): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    const end = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "), slice.lastIndexOf("… "));
    const at = end > max * 0.4 ? end + 1 : slice.lastIndexOf(" ") > 0 ? slice.lastIndexOf(" ") : max;
    chunks.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function openAiVoice(options: { apiKey: string; model?: string; voice?: string; fetchFn?: typeof fetch }): Voice {
  const model = options.model || process.env.VALYO_VOIX_MODELE || "gpt-4o-mini-tts";
  const voice = options.voice || process.env.VALYO_VOIX || "marin";
  const send = options.fetchFn ?? fetch;
  return async (text, lang) => {
    const body: Record<string, unknown> = { model, voice, input: text, response_format: "mp3" };
    // Les voix sont réglées pour l'anglais : on précise la langue et le ton (ignoré par les anciens modèles tts-1).
    if (!model.startsWith("tts-1")) {
      body.instructions = lang === "fr"
        ? "Lis ce texte en français de France, avec un accent français naturel, sur le ton posé et clair d’un journaliste de radio."
        : "Read this text in clear, natural English, in the calm tone of a radio journalist.";
    }
    const response = await send("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Service de voix : réponse ${response.status} ${(await response.text()).slice(0, 200)}`);
    return Buffer.from(await response.arrayBuffer());
  };
}

export type AudioResult =
  | { ok: true; file: string; bytes: number; created: boolean }
  | { ok: false; reason: "vide" | "quota" | "service" };

const inFlight = new Map<string, Promise<AudioResult>>();

/**
 * Renvoie le fichier audio de cette publication, en le fabriquant si besoin.
 * `voice` absent (pas de clé) : seul un son déjà fabriqué peut être servi.
 */
export function getOrCreateAudio(q: Query, input: { postId: string; kind: AudioKind; text: string; lang: "fr" | "en" }, voice: Voice | null): Promise<AudioResult> {
  const key = `${input.postId}:${input.kind}`;
  const running = inFlight.get(key);
  if (running) return running; // deux écoutes simultanées : une seule fabrication
  const work = produce(q, input, voice).finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}

async function produce(q: Query, input: { postId: string; kind: AudioKind; text: string; lang: "fr" | "en" }, voice: Voice | null): Promise<AudioResult> {
  const text = spokenText(input.text);
  if (text.length < 20) return { ok: false, reason: "vide" };
  const hash = createHash("sha256").update(`${input.lang}\n${text}`).digest("hex");
  const [existing] = await q<{ id: string; text_hash: string; bytes: number }>(`SELECT id, text_hash, bytes FROM post_audio WHERE post_id = $1 AND kind = $2`, [input.postId, input.kind]);
  if (existing && existing.text_hash === hash) {
    try { await stat(lectureFile(existing.id)); return { ok: true, file: lectureFile(existing.id), bytes: existing.bytes, created: false }; } catch { /* fichier perdu : on le refait */ }
  }
  if (!voice) return { ok: false, reason: "service" };
  const [{ used }] = await q<{ used: number }>(`SELECT coalesce(sum(chars), 0)::int AS used FROM post_audio WHERE created_at > now() - interval '24 hours'`);
  if (used + text.length > dailyCharLimit()) return { ok: false, reason: "quota" };

  let audio: Buffer;
  try {
    const parts: Buffer[] = [];
    for (const chunk of requestChunks(text)) parts.push(await voice(chunk, input.lang));
    audio = Buffer.concat(parts);
  } catch (error) {
    console.error("[lecture] fabrication en échec :", (error as Error).message);
    return { ok: false, reason: "service" };
  }
  if (audio.length < 200) return { ok: false, reason: "service" };

  const id = randomUUID();
  await mkdir(lectureDir(), { recursive: true });
  await writeFile(`${lectureFile(id)}.tmp`, audio);
  await rename(`${lectureFile(id)}.tmp`, lectureFile(id));
  await q(
    `INSERT INTO post_audio (id, post_id, kind, text_hash, bytes, chars) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (post_id, kind) DO UPDATE SET id = EXCLUDED.id, text_hash = EXCLUDED.text_hash, bytes = EXCLUDED.bytes, chars = EXCLUDED.chars, created_at = now()`,
    [id, input.postId, input.kind, hash, audio.length, text.length],
  );
  if (existing) await unlink(lectureFile(existing.id)).catch(() => {});
  return { ok: true, file: lectureFile(id), bytes: audio.length, created: true };
}

/** Efface les sons des publications retirées ou supprimées, et les fichiers sans ligne en base. */
export async function sweepLecture(q: Query, minAgeMs = 10 * 60 * 1000): Promise<number> {
  await q(`DELETE FROM post_audio a USING posts p WHERE p.id = a.post_id AND p.status <> 'published'`);
  let names: string[];
  try { names = await readdir(lectureDir()); } catch { return 0; }
  const ids = names.filter((n) => UUID.test(n));
  const known = new Set(ids.length ? (await q<{ id: string }>(`SELECT id FROM post_audio WHERE id = ANY($1::uuid[])`, [ids])).map((r) => r.id) : []);
  let removed = 0;
  for (const name of [...ids.filter((id) => !known.has(id)), ...names.filter((n) => n.endsWith(".tmp"))]) {
    const file = path.join(lectureDir(), name);
    try {
      if (Date.now() - (await stat(file)).mtimeMs < minAgeMs) continue;
      await unlink(file);
      removed++;
    } catch { /* déjà parti */ }
  }
  return removed;
}
