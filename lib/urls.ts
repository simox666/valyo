// Fonctions pures (testées dans tests/urls.test.ts).

const TRACKING_PARAMS = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|source)$/i;

/** URL http(s) absolue, sans identifiants intégrés. Toute autre forme (javascript:, data:, relative…) est refusée. */
export function parseHttpUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  return url;
}

/**
 * Forme canonique servant à détecter qu'une même page a déjà été partagée :
 * protocole et « www. » ignorés, paramètres de suivi retirés, paramètres
 * restants triés, ancre et barre oblique finale supprimées.
 */
export function normalizeUrl(input: string): string | null {
  const url = parseHttpUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const port = url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.test(key))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const search = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${port}${path}${search}`;
}

export function displayHost(input: string): string {
  const url = parseHttpUrl(input);
  return url ? url.hostname.replace(/^www\./, "") : input;
}
