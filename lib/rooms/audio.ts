import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Query } from "../editorial/types.ts";
import { sendMessage, type MessageView } from "./chat.ts";
import { canPreviewRoom, canReadRoom, loadAccess, type RoomViewer } from "./permissions.ts";
import type { Outcome } from "./service.ts";

// Messages vocaux des salons. L'enregistrement arrive tel que le navigateur l'a produit
// (MP4/AAC, ou WebM/Ogg Opus) : pas de réencodage, mais un format reconnu par ses octets
// d'en-tête, une taille plafonnée et un quota quotidien. Le fichier vit sur le volume des
// photos, sous `audio/` ; il n'est servi qu'à qui peut lire le salon.

export const MAX_AUDIO_MS = 120_000;
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const VOICE_BODY = "Message vocal";

export type AudioMime = "audio/mp4" | "audio/webm" | "audio/ogg";

const uploadsDir = () => process.env.UPLOADS_DIR || path.join(process.cwd(), ".data", "uploads");
export const audioDir = () => path.join(uploadsDir(), "audio");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const audioFile = (id: string) => path.join(audioDir(), id);

/** Format reconnu par l'en-tête du fichier, jamais par le type annoncé par le navigateur. */
export function sniffAudio(input: Uint8Array): AudioMime | null {
  if (input.length < 12) return null;
  const ascii = (from: number, to: number) => Buffer.from(input.subarray(from, to)).toString("latin1");
  if (ascii(4, 8) === "ftyp") return "audio/mp4";
  if (input[0] === 0x1a && input[1] === 0x45 && input[2] === 0xdf && input[3] === 0xa3) return "audio/webm";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  return null;
}

const refuse = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });

/**
 * Envoi d'un message vocal : l'enregistrement et son message sont créés dans la MÊME
 * transaction (à appeler via runLimited). Un refus du salon ou une relance du même envoi
 * retire la ligne d'enregistrement : jamais de fichier sans message.
 */
export async function sendVoiceMessage(
  q: Query,
  viewer: RoomViewer,
  roomId: string,
  input: { clientId: string; data: Uint8Array; durationMs: number },
): Promise<Outcome<{ message: MessageView; duplicate: boolean }>> {
  const mime = sniffAudio(input.data);
  if (!mime) return refuse("format", "Enregistrement illisible : réessayez depuis le bouton micro.");
  if (input.data.length > MAX_AUDIO_BYTES) return refuse("taille", "Enregistrement trop lourd.");
  const durationMs = Math.min(Math.max(Math.round(input.durationMs), 1), MAX_AUDIO_MS);
  const [audio] = await q<{ id: string }>(
    `INSERT INTO room_audio (room_id, author_id, mime, duration_ms, bytes) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [roomId, viewer.id, mime, durationMs, input.data.length],
  );
  const outcome = await sendMessage(q, viewer, roomId, { clientId: input.clientId, body: VOICE_BODY, audioId: audio.id });
  if (!outcome.ok || outcome.duplicate) {
    await q(`DELETE FROM room_audio WHERE id = $1`, [audio.id]);
    return outcome;
  }
  // Écrit avant la validation de la transaction : si l'écriture échoue, tout est annulé.
  await mkdir(audioDir(), { recursive: true });
  const tmp = `${audioFile(audio.id)}.tmp`;
  await writeFile(tmp, input.data);
  await rename(tmp, audioFile(audio.id));
  return outcome;
}

/** L'enregistrement d'un message visible, pour qui peut lire le salon (ou l'aperçu d'un salon public). */
export async function findAudio(q: Query, viewer: RoomViewer | null, roomId: string, audioId: string): Promise<{ file: string; mime: AudioMime; bytes: number } | null> {
  if (!UUID.test(audioId) || !UUID.test(roomId)) return null;
  const access = await loadAccess(q, roomId, viewer);
  if (!access.room || !(canReadRoom(access) || canPreviewRoom(access))) return null;
  const [row] = await q<{ mime: AudioMime; bytes: number }>(
    `SELECT a.mime, a.bytes FROM room_audio a JOIN room_messages m ON m.audio_id = a.id
     WHERE a.id = $1 AND a.room_id = $2 AND m.deleted_at IS NULL`,
    [audioId, roomId],
  );
  return row ? { file: audioFile(audioId), mime: row.mime, bytes: Number(row.bytes) } : null;
}

/**
 * Nettoyage : efface du disque les fichiers qui n'ont plus de ligne (message supprimé ou
 * retiré, salon supprimé, compte supprimé). Les fichiers très récents sont épargnés : leur
 * transaction d'envoi n'est peut-être pas encore validée.
 */
export async function sweepAudio(q: Query, minAgeMs = 10 * 60 * 1000): Promise<number> {
  let names: string[];
  try { names = await readdir(audioDir()); } catch { return 0; }
  const ids = names.filter((n) => UUID.test(n));
  const strays = names.filter((n) => n.endsWith(".tmp"));
  const known = new Set(ids.length ? (await q<{ id: string }>(`SELECT id FROM room_audio WHERE id = ANY($1::uuid[])`, [ids])).map((r) => r.id) : []);
  let removed = 0;
  for (const name of [...ids.filter((id) => !known.has(id)), ...strays]) {
    const file = path.join(audioDir(), name);
    try {
      if (Date.now() - (await stat(file)).mtimeMs < minAgeMs) continue;
      await unlink(file);
      removed++;
    } catch { /* déjà parti */ }
  }
  return removed;
}
