import { mkdir, rename, unlink, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { QueryFn } from "./db";

// Photos des membres. Chaque image envoyée est décodée puis réencodée en WebP (1600 px au plus) :
// les métadonnées (position GPS, appareil…) disparaissent, et un fichier qui n'est pas une vraie
// image est refusé. Fichiers sur disque (volume Railway en production), métadonnées en base.

export const MAX_IMAGES_PER_POST = 4;
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const UPLOADS_PER_DAY = 40;
const MAX_SIDE = 1600;

export interface PostImage {
  id: string;
  width: number;
  height: number;
}

export const uploadsDir = () => process.env.UPLOADS_DIR || path.join(process.cwd(), ".data", "uploads");
const fileFor = (id: string) => path.join(uploadsDir(), `${id}.webp`);
export const mediaUrl = (id: string) => `/media/${id}`;

export class ImageError extends Error {}

export type ImagePurpose = "post" | "avatar" | "banner";

// Photo de profil : carré 400 px ; bannière : 1500 × 500 ; publication : 1600 px au plus.
const RESIZE: Record<ImagePurpose, { width: number; height: number; fit: "inside" | "cover" }> = {
  post: { width: MAX_SIDE, height: MAX_SIDE, fit: "inside" },
  avatar: { width: 400, height: 400, fit: "cover" },
  banner: { width: 1500, height: 500, fit: "cover" },
};

/**
 * Format photo reconnu par ses octets d'en-tête, jamais par le nom de fichier ni le MIME client.
 * Liste fermée : tout le reste — dont le SVG, vecteur d'attaques du décodeur librsvg (SEC-01) —
 * est refusé AVANT d'atteindre le décodeur.
 */
export function sniffImageFormat(input: Buffer): "jpeg" | "png" | "webp" | "gif" | "heif" | "tiff" | null {
  if (input.length < 12) return null;
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return "jpeg";
  if (input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  const ascii = (from: number, to: number) => input.subarray(from, to).toString("latin1");
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "gif";
  if (ascii(4, 8) === "ftyp") return "heif"; // HEIC, HEIF, AVIF
  if (ascii(0, 4) === "II*\u0000" || ascii(0, 4) === "MM\u0000*") return "tiff";
  return null;
}

/** Décode, oriente, réduit et réencode ; aucune métadonnée conservée. */
export async function processImage(input: Buffer, purpose: ImagePurpose = "post"): Promise<{ data: Buffer; width: number; height: number }> {
  if (!sniffImageFormat(input)) {
    throw new ImageError("Format refusé : envoyez une photo JPEG, PNG, WebP, GIF, HEIC ou TIFF (le SVG n’est pas accepté).");
  }
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate()
      .resize({ ...RESIZE[purpose], withoutEnlargement: purpose === "post", position: "attention" })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new ImageError("Ce fichier n’est pas une image lisible (JPEG, PNG, WebP, HEIC…).");
  }
}

export type UploadOutcome = { ok: true; image: PostImage } | { ok: false; status: number; message: string };

export async function saveUpload(q: QueryFn, userId: string, input: Buffer, purpose: ImagePurpose = "post"): Promise<UploadOutcome> {
  // Quota atomique quand `q` est une transaction (route /api/uploads) : le verrou sérialise
  // le décompte et l'insertion d'un même membre. Hors transaction, le verrou est sans effet.
  await q(`SELECT pg_advisory_xact_lock(hashtext('valyo-uploads-' || $1::text))`, [userId]);
  const [usage] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM post_images WHERE uploader_id = $1 AND created_at > now() - interval '1 day'`,
    [userId],
  );
  if (Number(usage.n) >= UPLOADS_PER_DAY) return { ok: false, status: 429, message: `${UPLOADS_PER_DAY} photos par jour au plus : revenez demain.` };
  let processed;
  try {
    processed = await processImage(input, purpose);
  } catch (error) {
    return { ok: false, status: 400, message: (error as Error).message };
  }
  await cleanupOrphans(q);
  const [row] = await q<{ id: string }>(
    `INSERT INTO post_images (uploader_id, width, height, bytes) VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, processed.width, processed.height, processed.data.length],
  );
  await mkdir(uploadsDir(), { recursive: true });
  const tmp = `${fileFor(row.id)}.tmp`;
  await writeFile(tmp, processed.data);
  await rename(tmp, fileFor(row.id));
  return { ok: true, image: { id: row.id, width: processed.width, height: processed.height } };
}

/** Rattache à la publication les photos de l'auteur encore libres, dans l'ordre choisi. */
export async function attachImages(q: QueryFn, postId: string, userId: string, imageIds: string[]): Promise<void> {
  const ids = [...new Set(imageIds)].slice(0, MAX_IMAGES_PER_POST);
  if (!ids.length) return;
  await q(
    `UPDATE post_images SET post_id = $1, position = array_position($3::uuid[], id)
     WHERE id = ANY($3::uuid[]) AND uploader_id = $2 AND post_id IS NULL`,
    [postId, userId, ids],
  );
}

/** Photos envoyées mais jamais utilisées depuis 24 h (ni publication, ni profil) : supprimées. */
async function cleanupOrphans(q: QueryFn) {
  const rows = await q<{ id: string }>(
    `DELETE FROM post_images WHERE id IN (
       SELECT pi.id FROM post_images pi WHERE pi.post_id IS NULL AND pi.created_at < now() - interval '1 day'
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_image_id = pi.id OR u.banner_image_id = pi.id)
       LIMIT 50
     ) RETURNING id`,
  );
  for (const r of rows) await unlink(fileFor(r.id)).catch(() => {});
}

/** Photo de profil ou bannière : seulement une image libre envoyée par ce membre (ou déjà la sienne). */
export async function ownsFreeImage(q: QueryFn, userId: string, imageId: string): Promise<boolean> {
  const [row] = await q(`SELECT 1 FROM post_images WHERE id = $1 AND uploader_id = $2 AND post_id IS NULL`, [imageId, userId]);
  return Boolean(row);
}

/**
 * Fichier d'une photo visible (SEC-02). Publique : attachée à une publication PUBLIÉE, ou
 * photo de profil/bannière d'un compte non supprimé. Sinon, aperçu PRIVÉ réservé à son
 * propriétaire (viewerId) ; tout autre lecteur reçoit null, comme une image inexistante.
 * Une photo attachée à une publication retirée n'est servie à personne.
 */
export async function readVisibleImage(q: QueryFn, id: string, viewerId: string | null = null): Promise<{ data: Buffer; public: boolean } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await q<{ pub: boolean; mine: boolean }>(
    `SELECT (CASE WHEN pi.post_id IS NOT NULL THEN p.status = 'published'
                  ELSE EXISTS (SELECT 1 FROM users u WHERE (u.avatar_image_id = pi.id OR u.banner_image_id = pi.id) AND u.status <> 'deleted') END) AS pub,
            (pi.post_id IS NULL AND pi.uploader_id = $2::uuid) AS mine
     FROM post_images pi LEFT JOIN posts p ON p.id = pi.post_id WHERE pi.id = $1`,
    [id, viewerId],
  );
  if (!row || (!row.pub && !row.mine)) return null;
  const data = await readFile(fileFor(id)).catch(() => null);
  return data ? { data, public: Boolean(row.pub) } : null;
}
