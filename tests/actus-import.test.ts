// Importation des actus réelles : fraîcheur, thème, hors-sujet écarté, doublons, image.
import assert from "node:assert/strict";
import { test } from "node:test";
import { importActus } from "../lib/actus/import.ts";
import type { ActuSource } from "../lib/actus/sources.ts";
import type { Transport } from "../lib/editorial/fetch.ts";
import { createTestDb } from "./editorial-helpers.ts";

const NOW = new Date("2026-11-15T12:00:00Z");
const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>${items}</channel></rss>`;
const item = (title: string, link: string, hoursAgo: number, extra = "") =>
  `<item><title>${title}</title><link>${link}</link><description>Résumé de ${title}.</description><pubDate>${new Date(NOW.getTime() - hoursAgo * 3600000).toUTCString()}</pubDate>${extra}</item>`;

const SOURCE: ActuSource = { id: "test", name: "Source Test", url: "https://source.test/rss", fallback: "sciences", perRun: 10, lang: "fr" };

test("actus : fraîches et dans le sujet seulement, thème déduit, image du flux, aucun doublon", async () => {
  const { db } = await createTestDb();
  const feed = rss(
    item("Une fusée réutilisable atterrit", "https://source.test/fusee", 2, `<media:content url="https://img.source.test/fusee.jpg" medium="image"/>`) +
      item("Un robot humanoïde marche seul", "https://source.test/robot", 3) +
      item("Black Friday : les meilleures offres", "https://source.test/promo", 1) +
      item("Une découverte en biologie", "https://source.test/bio", 5) +
      item("Vieille nouvelle", "https://source.test/vieux", 24 * 10) +
      item("Une fusion nucléaire record", "https://source.test/payant", 2) +
      item("Un piratage massif d'hôpitaux", "https://source.test/cyber", 4),
  );
  const pages: Record<string, string> = {
    "https://source.test/payant": `<html><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree": false}</script><article>Début…</article></html>`,
    "https://source.test/robot": `<html><head><meta property="og:image" content="https://img.source.test/robot.jpg"></head><article>Texte</article></html>`,
  };
  const transport: Transport = {
    get: async (url: string, accept: string) =>
      accept === "feed" ? { body: feed, finalUrl: SOURCE.url, contentType: "application/rss+xml" } : { body: pages[url] ?? "<html><article>Libre</article></html>", finalUrl: url, contentType: "text/html" },
  } as unknown as Transport;

  const first = await importActus({ db, transport, now: NOW, sources: [SOURCE] });
  assert.equal(first.imported, 4, "fusée, robot, biologie, piratage ; promo, vieille nouvelle et article payant écartés");
  assert.equal(first.paywalled, 1);
  const rows = await db.query<{ title: string; image_url: string | null; source_name: string; slug: string }>(
    `SELECT p.title, p.image_url, p.source_name, t.slug FROM posts p JOIN post_themes pt ON pt.post_id = p.id JOIN themes t ON t.id = pt.theme_id ORDER BY p.created_at DESC`,
  );
  const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
  assert.equal(byTitle["Une fusée réutilisable atterrit"].slug, "espace");
  assert.equal(byTitle["Une fusée réutilisable atterrit"].image_url, "https://img.source.test/fusee.jpg");
  assert.equal(byTitle["Un robot humanoïde marche seul"].slug, "robotique");
  assert.equal(byTitle["Un robot humanoïde marche seul"].image_url, "https://img.source.test/robot.jpg", "image og:image de la page");
  assert.equal(byTitle["Un piratage massif d'hôpitaux"].slug, "cyber");
  assert.equal(byTitle["Une découverte en biologie"] !== undefined, true);
  assert.equal(byTitle["Une découverte en biologie"].slug, "biologie");
  assert.equal(byTitle["Une découverte en biologie"].source_name, "Source Test");

  const second = await importActus({ db, transport, now: NOW, sources: [SOURCE] });
  assert.equal(second.imported, 0, "aucun doublon au passage suivant");
});

test("actus : article complet d'une source sous licence libre, avec auteur, licence et lien", async () => {
  const { fullArticle } = await import("../lib/actus/page.ts");
  const { licensedBody } = await import("../lib/actus/import.ts");
  const { ACTU_SOURCES } = await import("../lib/actus/sources.ts");
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("./fixtures/actus/theconversation.html", import.meta.url), "utf8");
  const article = fullArticle(html)!;
  assert.deepEqual(article.authors, [{ name: "Jean-François Stich", role: "Professeur en Ressources Humaines, ICN Business School" }]);
  assert.match(article.text, /^L’ESSENTIEL\n\n• Partie le jeudi 12 novembre/);
  assert.match(article.text, /panne mondiale de ses services, dont Outlook/, "liens retirés sans espace parasite");
  assert.match(article.text, /\n\nSe déconnecter de sa boîte mail \?\n\n/, "intertitres conservés");
  assert.doesNotMatch(article.text, /ressources humaines \(RH\)|Disclosure/, "ni mots-clés ni encadrés hors article");

  const tc = ACTU_SOURCES.find((s) => s.id === "theconversation")!;
  const body = licensedBody(tc, html, "https://theconversation.com/x")!;
  assert.match(body, /Auteur : Jean-François Stich \(Professeur en Ressources Humaines, ICN Business School\)\.\nCet article est republié à partir de The Conversation sous licence Creative Commons BY-ND 4\.0 \(https:\/\/creativecommons\.org\/licenses\/by-nd\/4\.0\/deed\.fr\)\. Lire l’article original : https:\/\/theconversation\.com\/x$/);
  assert.equal(licensedBody(ACTU_SOURCES.find((s) => s.id === "numerama")!, html, "https://x"), null, "source sans licence libre : jamais l'article complet");
});

test("actus : synthèse IA générée à l'import pour chaque nouvel article, plafond quotidien respecté", async () => {
  const { db } = await createTestDb();
  const feed = rss(item("Une fusée réutilisable atterrit", "https://source.test/a", 2) + item("Un robot humanoïde marche seul", "https://source.test/b", 3) + item("Une éclipse observée", "https://source.test/c", 4));
  const page = `<html><article>${"<p>Un long paragraphe de l'article, avec assez de texte pour être résumé correctement par le modèle.</p>".repeat(8)}</article></html>`;
  const transport = { get: async (url: string, accept: string) => (accept === "feed" ? { body: feed, finalUrl: SOURCE.url, contentType: "application/rss+xml" } : { body: page, finalUrl: url, contentType: "text/html" }) } as unknown as Transport;
  const calls: string[] = [];
  const summarize = async (input: { title: string }) => {
    calls.push(input.title);
    return { readable: true, model: "claude-haiku-5-5", synthesis: { essentiel: `Résumé : ${input.title}`, points: ["a"], contexte: "c", limites: "" } };
  };
  process.env.VALYO_SYNTHESES_AUTO_PAR_JOUR = "2";
  try {
    const report = await importActus({ db, transport, now: NOW, sources: [SOURCE], summarize });
    assert.equal(report.imported, 3);
    assert.equal(report.synthesized, 2, "plafond quotidien de 2 synthèses automatiques");
    const rows = await db.query<{ status: string; model: string; requested_by: string | null }>(`SELECT status, model, requested_by FROM post_syntheses`);
    assert.deepEqual(rows.map((r) => [r.status, r.model, r.requested_by]), [["ready", "claude-haiku-5-5", null], ["ready", "claude-haiku-5-5", null]]);
    assert.equal(calls.length, 2, "la page déjà lue à l'import sert à la synthèse");
  } finally {
    delete process.env.VALYO_SYNTHESES_AUTO_PAR_JOUR;
  }
});
