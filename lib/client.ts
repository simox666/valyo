// Appels d'API depuis les composants client.

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string; fields?: Record<string, string> };
}

const CONTRIBUTION = /^\/api\/(posts(\/[^/]+\/(comments|reactions))?|rooms(\/[^/]+\/messages)?)$/;

export async function api<T = Record<string, unknown>>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    // Une contribution peut faire franchir un palier : la progression se recharge (toast).
    if (response.ok && method === "POST" && CONTRIBUTION.test(url) && typeof window !== "undefined") {
      window.dispatchEvent(new Event("valyo:progress"));
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Connexion impossible. Vérifiez votre réseau puis réessayez." } as ApiResult<T>["data"],
    };
  }
}

export function loginUrl(next: string) {
  return `/connexion?next=${encodeURIComponent(next)}`;
}
