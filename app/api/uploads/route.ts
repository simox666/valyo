import { transaction } from "@/lib/db";
import { fail, json, readBodyCapped, requireContributor } from "@/lib/http";
import { MAX_UPLOAD_BYTES, mediaUrl, saveUpload, type ImagePurpose } from "@/lib/media";

// Envoi d'une photo (champ « file ») avant publication.
// SEC-06 : la limite de taille est imposée PENDANT la lecture du flux (pas après), même sans
// Content-Length ; le nombre de traitements d'images simultanés est borné ; le quota quotidien
// est décompté dans une transaction sous verrou consultatif (pas de course compte/insertion).

const MAX_CONCURRENT_UPLOADS = 4;
let activeUploads = 0;

export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) return fail("Beaucoup d’envois en même temps : réessayez dans un instant.", 429);
  activeUploads++;
  try {
    const body = await readBodyCapped(request, MAX_UPLOAD_BYTES + 100_000);
    if (body === null) return fail("Photo trop lourde (12 Mo au plus).", 413);
    let file: FormDataEntryValue | null = null;
    let purpose: ImagePurpose = "post";
    try {
      const form = await new Request(request.url, { method: "POST", headers: request.headers, body: new Uint8Array(body).buffer as ArrayBuffer }).formData();
      file = form.get("file");
      const asked = form.get("purpose");
      if (asked === "avatar" || asked === "banner") purpose = asked;
    } catch {
      return fail("Envoi invalide.", 400);
    }
    if (!(file instanceof File) || file.size === 0) return fail("Aucune photo reçue.", 400);
    if (file.size > MAX_UPLOAD_BYTES) return fail("Photo trop lourde (12 Mo au plus).", 413);
    const data = Buffer.from(await file.arrayBuffer());
    const outcome = await transaction((q) => saveUpload(q, guard.user.id, data, purpose));
    if (!outcome.ok) return fail(outcome.message, outcome.status);
    return json({ ...outcome.image, url: mediaUrl(outcome.image.id) }, 201);
  } finally {
    activeUploads--;
  }
}
