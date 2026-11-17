import { cookies } from "next/headers";
import { getCurrentUser, hashToken, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { emitRoomBatch, latestEventSeq, streamAccessAllowed } from "@/lib/rooms/chat.ts";
import { viewerOf } from "@/lib/rooms/http.ts";

// Flux SSE reprenable d'un salon (C23, C24 ; corrections ACC01/ACC06 de la recette C010).
// - `?cursor=<seq>` : reprise exacte ; sans curseur, départ au présent (l'historique vient
//   de l'instantané cohérent servi avec la page).
// - Resynchronisation : UNIQUEMENT si le curseur est passé sous le watermark de purge du
//   salon (les numéros viennent d'une suite globale : un trou n'implique rien). L'événement
//   `resync` FOURNIT le nouveau curseur ; le client recharge l'historique puis reprend.
// - Droits revérifiés À CHAQUE itération AVANT d'émettre (session d'origine comprise), et
//   immédiatement à tout événement `revoke` visant le membre : plus aucune donnée après
//   une perte d'accès (départ, exclusion, suppression de compte, déconnexion, sanction).
// - La connexion se referme d'elle-même après `MAX_CONNECTION_MS` ; le client reprend par
//   curseur : compatible avec les hébergements qui limitent la durée des réponses.

export const dynamic = "force-dynamic";

const POLL_MS = 1500;
const MAX_CONNECTION_MS = 110_000;

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Connectez-vous pour continuer.", 401);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Salon introuvable.", 404);
  const viewer = viewerOf(user);
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) return fail("Connectez-vous pour continuer.", 401);
  const sessionTokenHash = hashToken(sessionToken);
  if (!(await streamAccessAllowed(db, viewer, id, { sessionTokenHash }))) return fail("Salon introuvable.", 404);

  const url = new URL(request.url);
  const raw = url.searchParams.get("cursor");
  let cursor = raw !== null && /^\d+$/.test(raw) ? Number(raw) : await latestEventSeq(db.query, id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));
      const startedAt = Date.now();
      try {
        send("ready", { cursor });
        while (!request.signal.aborted && Date.now() - startedAt < MAX_CONNECTION_MS) {
          const batch = await emitRoomBatch(db, viewer, id, cursor, sessionTokenHash, send);
          cursor = batch.cursor;
          if (batch.closed) return;
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        send("fin", { cursor });
      } catch {
        // Connexion interrompue : la reprise se fait par curseur.
      } finally {
        try {
          controller.close();
        } catch {
          // déjà fermée
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
