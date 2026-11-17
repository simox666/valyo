// Lecture bornée du corps des requêtes (SEC-06). Module sans dépendance serveur : testable seul.

/** Plus large que tout JSON légitime de l'application (publication : ≤ ~50 Ko). */
export const MAX_JSON_BYTES = 256 * 1024;

/**
 * Lit le corps en imposant la limite PENDANT la lecture : la connexion est coupée dès le
 * dépassement, même sans en-tête Content-Length. null = corps absent ou trop volumineux.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function readJson(request: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  try {
    const body = await readBodyCapped(request, maxBytes);
    if (body === null || body.length === 0) return null;
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    return null;
  }
}
