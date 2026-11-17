// « Développer » : synthèse IA mise en cache, une seule génération, paywall refusé, quotas.
import assert from "node:assert/strict";
import { test } from "node:test";
import { developPost, getSyntheses, type Summarizer } from "../lib/actus/synthesis.ts";
import type { Transport } from "../lib/editorial/fetch.ts";
import { createTestDb } from "./editorial-helpers.ts";

const ARTICLE = `<html><article>${"Des chercheurs annoncent un résultat important sur les batteries au sodium. ".repeat(20)}</article></html>`;

async function setup(pages: Record<string, string>) {
  const { db } = await createTestDb();
  const [user] = await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ('ana', 'Ana', now()) RETURNING id`);
  const post = async (url: string) => {
    const [p] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body, source_name) VALUES ($1, 'news', 'Titre', 'x', 'Source') RETURNING id`, [user.id]);
    await db.query(`INSERT INTO post_sources (post_id, position, url, normalized_url) VALUES ($1, 0, $2, $2)`, [p.id, url]);
    return p.id;
  };
  const transport = { get: async (url: string) => ({ body: pages[url] ?? "", finalUrl: url, status: 200, contentType: "text/html" }) } as unknown as Transport;
  return { db, user: user.id, post, transport };
}

test("synthèse : générée une fois, gardée, montrée ensuite sans nouvel appel", async () => {
  const { db, user, post, transport } = await setup({ "https://a.test/libre": ARTICLE });
  const id = await post("https://a.test/libre");
  let calls = 0;
  const summarize: Summarizer = async ({ text }) => {
    calls++;
    assert.ok(text.includes("batteries au sodium"));
    return { readable: true, model: "faux", synthesis: { essentiel: "Batteries au sodium.", points: ["Point"], contexte: "Contexte", limites: "" } };
  };
  const first = await developPost({ db, transport, summarize, userId: user, postId: id });
  assert.deepEqual(first, { ok: true, state: { status: "ready", content: { essentiel: "Batteries au sodium.", points: ["Point"], contexte: "Contexte", limites: "" } } });
  await developPost({ db, transport, summarize, userId: user, postId: id });
  assert.equal(calls, 1, "pas de seconde génération");
  assert.equal((await getSyntheses(db.query, [id])).get(id)?.status, "ready");
});

test("synthèse : article payant jamais résumé ; échec réessayable", async () => {
  const { db, user, post, transport } = await setup({ "https://a.test/payant": `<html><script>{"isAccessibleForFree":"False"}</script>${ARTICLE}</html>`, "https://a.test/libre": ARTICLE });
  const never: Summarizer = async () => assert.fail("pas d'appel IA pour un article payant");
  const paid = await developPost({ db, transport, summarize: never, userId: user, postId: await post("https://a.test/payant") });
  assert.equal(paid.ok && paid.state.status, "unavailable");

  const id = await post("https://a.test/libre");
  const broken: Summarizer = async () => { throw new Error("panne"); };
  const failed = await developPost({ db, transport, summarize: broken, userId: user, postId: id });
  assert.equal(failed.ok && failed.state.status, "failed");
  const ok: Summarizer = async () => ({ readable: true, model: "faux", synthesis: { essentiel: "E", points: [], contexte: "", limites: "" } });
  const retried = await developPost({ db, transport, summarize: ok, userId: user, postId: id });
  assert.equal(retried.ok && retried.state.status, "ready");
});

test("lecture d'article : le vrai corps est retenu même après une vignette <article>", async () => {
  const { articleText } = await import("../lib/actus/page.ts");
  const html = `<html><body><article class="vignette"><p>Lire aussi : un autre sujet très intéressant à découvrir ici.</p></article>
    <nav><p>Menu du site avec beaucoup de liens et de rubriques diverses.</p></nav>
    <article class="principal">${"<p>Des chercheurs ont mesuré un effet inattendu dans une expérience menée sur trois ans.</p>".repeat(15)}</article></body></html>`;
  const text = articleText(html);
  assert.ok(text.length > 1000, `texte trop court : ${text.length}`);
  assert.ok(text.startsWith("Des chercheurs"), "le corps de l'article, pas la vignette");
  assert.ok(!text.includes("Menu du site"), "la navigation est écartée");
});
