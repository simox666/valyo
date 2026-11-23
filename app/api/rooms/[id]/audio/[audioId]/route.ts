import { open } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findAudio } from "@/lib/rooms/audio.ts";
import { viewerOf } from "@/lib/rooms/http.ts";

/**
 * Sert un message vocal à qui peut lire le salon. Les lectures partielles (en-tête Range)
 * sont prises en charge : Safari les exige pour lire un fichier audio.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string; audioId: string }> }) {
  const { id, audioId } = await context.params;
  const user = await getCurrentUser();
  const audio = await findAudio(db.query, user ? viewerOf(user) : null, id, audioId);
  if (!audio) return new Response("Introuvable", { status: 404 });

  let handle;
  try { handle = await open(audio.file, "r"); } catch { return new Response("Introuvable", { status: 404 }); }
  try {
    const size = (await handle.stat()).size;
    const headers: Record<string, string> = {
      "Content-Type": audio.mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
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
