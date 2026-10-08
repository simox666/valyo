// A "challenge" is just the round sequence + the score to beat, packed into
// a URL-safe string — no backend, no accounts, nothing to store server-side
// (project.md, scan de pièce section established the same cost-conscious
// bias: don't add infrastructure a static encoding can avoid). The link
// itself IS the challenge.
export interface ChallengePayload {
  ids: string[];
  score: number;
}

export function encodeChallenge(payload: ChallengePayload): string {
  const json = JSON.stringify(payload);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeChallenge(encoded: string): ChallengePayload | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("ids" in parsed) ||
      !("score" in parsed) ||
      !Array.isArray((parsed as { ids: unknown }).ids) ||
      !(parsed as { ids: unknown[] }).ids.every((id) => typeof id === "string") ||
      typeof (parsed as { score: unknown }).score !== "number" ||
      !Number.isFinite((parsed as { score: number }).score)
    ) {
      return null;
    }
    return parsed as ChallengePayload;
  } catch {
    return null;
  }
}
