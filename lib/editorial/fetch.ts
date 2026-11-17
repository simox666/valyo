import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

// Collecte réseau sécurisée (contrat §6, recette R23).
// - Seules les adresses publiques sont jointes, IPv4 et IPv6, y compris après
//   résolution DNS et à chaque redirection.
// - L'adresse vérifiée est celle utilisée pour la connexion (option `lookup`
//   du socket) : un changement de résolution entre contrôle et connexion est impossible.
// - Limites de durée, de taille, de redirections et de types de contenu.

export type FetchErrorCode =
  | "bad_url"
  | "blocked_address"
  | "dns_failure"
  | "too_many_redirects"
  | "too_large"
  | "timeout"
  | "bad_content_type"
  | "http_error"
  | "network";

export class FetchError extends Error {
  code: FetchErrorCode;
  permanent: boolean;
  constructor(code: FetchErrorCode, message: string, permanent: boolean) {
    super(message);
    this.code = code;
    this.permanent = permanent;
  }
}

export interface FetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
}

export interface Transport {
  get(url: string, accept: "feed" | "html"): Promise<FetchResult>;
}

// Deux listes séparées : une règle IPv6 sur les adresses mappées (::ffff:0:0/96)
// placée dans la même liste qu'IPv4 bloquerait toutes les adresses IPv4.
const BLOCKED_V4 = new BlockList();
const BLOCKED_V6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED_V4.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128],
  // Adresses IPv4 embarquées (mappées, NAT64, 6to4, Teredo) : refusées en bloc par prudence.
  ["::ffff:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["2002::", 16], ["2001::", 32],
  ["100::", 64], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) BLOCKED_V6.addSubnet(net, prefix, "ipv6");

/** Adresse joignable publiquement ; toute autre forme (privée, locale, métadonnées, documentation…) est refusée. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !BLOCKED_V4.check(address, "ipv4");
  if (family === 6) return !BLOCKED_V6.check(address, "ipv6");
  return false;
}

const ACCEPT: Record<"feed" | "html", { header: string; types: string[] }> = {
  feed: {
    header: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
    types: ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml", "application/rdf+xml"],
  },
  html: { header: "text/html, application/xhtml+xml;q=0.9", types: ["text/html", "application/xhtml+xml"] },
};

export interface HttpTransportOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
  /** Résolution DNS (injectable pour les tests). */
  resolve?: (hostname: string) => Promise<{ address: string; family: number }[]>;
  /** Politique d'adresse (injectable pour les tests) ; par défaut, adresses publiques uniquement. */
  isAllowed?: (address: string, hostname: string) => boolean;
}

export function createHttpTransport(options: HttpTransportOptions = {}): Transport {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const maxRedirects = options.maxRedirects ?? 3;
  const userAgent = options.userAgent ?? "ValyoAgentEditorial/0.1 (+veille sourcee)";
  const resolve = options.resolve ?? (async (h: string) => dnsLookup(h, { all: true, verbatim: true }));
  const isAllowed = options.isAllowed ?? ((address: string) => isPublicAddress(address));

  async function vettedAddress(hostname: string): Promise<{ address: string; family: number }> {
    const bare = hostname.replace(/^\[|\]$/g, "");
    if (isIP(bare)) {
      if (!isAllowed(bare, bare)) throw new FetchError("blocked_address", `Adresse non publique refusée : ${bare}`, true);
      return { address: bare, family: isIP(bare) };
    }
    let addresses: { address: string; family: number }[];
    try {
      addresses = await resolve(bare);
    } catch {
      throw new FetchError("dns_failure", `Résolution DNS impossible : ${bare}`, false);
    }
    if (addresses.length === 0) throw new FetchError("dns_failure", `Aucune adresse pour ${bare}`, false);
    // Une seule adresse non publique suffit à refuser l'hôte entier.
    const blocked = addresses.find((a) => !isAllowed(a.address, bare));
    if (blocked) throw new FetchError("blocked_address", `${bare} résout vers une adresse non publique (${blocked.address})`, true);
    return addresses[0];
  }

  function requestOnce(url: URL, accept: "feed" | "html", vetted: { address: string; family: number }, deadline: number) {
    return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolvePromise, reject) => {
      const mod = url.protocol === "https:" ? https : http;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return reject(new FetchError("timeout", "Délai dépassé", false));
      const req = mod.request(
        url,
        {
          method: "GET",
          headers: { "User-Agent": userAgent, Accept: ACCEPT[accept].header, "Accept-Encoding": "identity" },
          // La connexion utilise exclusivement l'adresse déjà vérifiée.
          lookup: (_host, opts, cb) => {
            const all = typeof opts === "object" && (opts as { all?: boolean }).all;
            if (all) (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [vetted]);
            else cb(null, vetted.address, vetted.family);
          },
          timeout: remaining,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              req.destroy();
              reject(new FetchError("too_large", `Réponse supérieure à ${maxBytes} octets`, true));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () => resolvePromise({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
          res.on("error", () => reject(new FetchError("network", "Lecture interrompue", false)));
        },
      );
      req.on("timeout", () => {
        req.destroy();
        reject(new FetchError("timeout", "Délai dépassé", false));
      });
      req.on("error", (error) => {
        if (error instanceof FetchError) reject(error);
        else reject(new FetchError("network", `Erreur réseau : ${error.message}`, false));
      });
      req.end();
    });
  }

  return {
    async get(rawUrl, accept) {
      const deadline = Date.now() + timeoutMs;
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        throw new FetchError("bad_url", `URL invalide : ${rawUrl}`, true);
      }
      for (let hop = 0; hop <= maxRedirects; hop++) {
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError("bad_url", `Protocole refusé : ${url.protocol}`, true);
        if (url.username || url.password) throw new FetchError("bad_url", "Identifiants dans l'URL refusés", true);
        const vetted = await vettedAddress(url.hostname);
        const res = await requestOnce(url, accept, vetted, deadline);
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.location;
          if (!location) throw new FetchError("http_error", `Redirection ${res.status} sans destination`, true);
          url = new URL(location, url);
          continue;
        }
        if (res.status >= 400) throw new FetchError("http_error", `Réponse HTTP ${res.status}`, res.status !== 429 && res.status < 500);
        const contentType = String(res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
        if (!ACCEPT[accept].types.includes(contentType)) {
          throw new FetchError("bad_content_type", `Type de contenu refusé : ${contentType || "absent"}`, true);
        }
        const charset = /charset=([\w-]+)/i.exec(String(res.headers["content-type"] ?? ""))?.[1] ?? "utf-8";
        let body: string;
        try {
          body = new TextDecoder(charset).decode(res.body);
        } catch {
          body = new TextDecoder("utf-8").decode(res.body);
        }
        return { finalUrl: url.toString(), status: res.status, contentType, body };
      }
      throw new FetchError("too_many_redirects", `Plus de ${maxRedirects} redirections`, true);
    },
  };
}
