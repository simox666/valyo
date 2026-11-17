import { readFile } from "node:fs/promises";
import path from "node:path";
import { FetchError, type Transport } from "./fetch.ts";

// Transport de fixtures : sert des fichiers locaux à la place du réseau, pour
// les tests et la démonstration locale (EDITORIAL_TRANSPORT=fixtures).
// https://hote/chemin → <dossier>/hote/chemin. Un fichier qui commence par
// « REDIRECT <url> » simule une redirection. Fichier absent : HTTP 404.

const TYPES: Record<string, string> = {
  ".xml": "application/rss+xml",
  ".atom": "application/atom+xml",
  ".html": "text/html",
  ".txt": "text/plain",
};

export function createFixtureTransport(root: string): Transport {
  return {
    async get(rawUrl, accept) {
      let url = new URL(rawUrl);
      for (let hop = 0; hop <= 3; hop++) {
        const file = path.join(root, url.hostname, decodeURIComponent(url.pathname));
        if (!file.startsWith(path.resolve(root))) throw new FetchError("bad_url", "Chemin hors des fixtures", true);
        let body: string;
        try {
          body = await readFile(file, "utf8");
        } catch {
          throw new FetchError("http_error", "Réponse HTTP 404", true);
        }
        const redirect = /^REDIRECT (\S+)/.exec(body);
        if (redirect) {
          url = new URL(redirect[1], url);
          continue;
        }
        // Extension non listée (ou absente, ou « .0001 » d'un identifiant) : page HTML.
        const contentType = TYPES[path.extname(file)] ?? "text/html";
        const allowed = accept === "feed" ? ["application/rss+xml", "application/atom+xml"] : ["text/html"];
        if (!allowed.includes(contentType)) throw new FetchError("bad_content_type", `Type de contenu refusé : ${contentType}`, true);
        return { finalUrl: url.toString(), status: 200, contentType, body };
      }
      throw new FetchError("too_many_redirects", "Plus de 3 redirections", true);
    },
  };
}
