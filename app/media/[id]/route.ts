import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readVisibleImage } from "@/lib/media";

/**
 * Sert une photo de membre ; jamais interprétée autrement qu'une image.
 * Image publique : cache court (10 min), un retrait cesse donc d'être servi rapidement et
 * seules des copies navigateur déjà faites peuvent subsister jusqu'à 10 minutes.
 * Aperçu privé (photo non publiée, propriétaire seulement) : aucune mise en cache (SEC-02).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  const image = await readVisibleImage(db.query, id, user?.id ?? null);
  if (!image) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": image.public ? "public, max-age=600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
