// Audit C019 (docs/audits/2026-11-17-securite.md) : tests du COMPORTEMENT SÉCURISÉ.
// Issus des reproductions de l'audit (tests/security/audit-2026-11-17.test.ts), converties
// après correction : ici, PASS signifie « défaut corrigé ». Aucun réseau ni appel IA réel.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTestDb, addMemberPost } from "./editorial-helpers.ts";
import { processImage, readVisibleImage, saveUpload, sniffImageFormat } from "../lib/media.ts";
import { SummarizeError, developPost, getSyntheses, type Summarizer } from "../lib/actus/synthesis.ts";
import { readJson } from "../lib/http-body.ts";
import type { Transport } from "../lib/editorial/fetch.ts";
import type { Db } from "../lib/editorial/types.ts";

/** Un membre et sa publication avec source, pseudos distincts (le helper partagé est unique). */
async function addPost(db: Db, handle: string) {
  const [user] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ($1, $2, $2, now()) RETURNING id`,
    [`${handle}@example.test`, handle],
  );
  const [post] = await db.query<{ id: string }>(
    `INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', 'Titre', 'x') RETURNING id`, [user.id],
  );
  await db.query(`INSERT INTO post_sources (post_id, position, url, normalized_url) VALUES ($1, 0, $2, $2)`, [post.id, `https://labo.example/${handle}`]);
  return { userId: user.id, postId: post.id };
}

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>');
const ARTICLE = { get: async () => ({ body: `<article>${"<p>Des chercheurs étudient une nouvelle batterie au sodium et ses limites pratiques.</p>".repeat(12)}</article>` }) } as unknown as Transport;

test("SEC-01 : le SVG est refusé AVANT le décodeur, par les octets, jamais par le nom ou le MIME", async () => {
  assert.equal(sniffImageFormat(SVG), null);
  await assert.rejects(processImage(SVG), /SVG/);
  const previous = process.env.UPLOADS_DIR;
  const dir = await mkdtemp(path.join(tmpdir(), "valyo-audit-media-"));
  process.env.UPLOADS_DIR = dir;
  const { db, lite } = await createTestDb();
  try {
    const { userId } = await addMemberPost(db);
    const result = await saveUpload(db.query, userId, SVG);
    assert.deepEqual([result.ok, !result.ok && result.status], [false, 400], "l'upload SVG est refusé");
  } finally {
    await lite.close();
    await rm(dir, { recursive: true, force: true });
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
  }
});

test("SEC-02 : une photo non publiée n'est servie qu'à son propriétaire ; l'avatar d'un profil est public", async () => {
  const previous = process.env.UPLOADS_DIR;
  const dir = await mkdtemp(path.join(tmpdir(), "valyo-audit-media2-"));
  process.env.UPLOADS_DIR = dir;
  const { db, lite } = await createTestDb();
  try {
    const { userId } = await addMemberPost(db);
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#135" } }).jpeg().toBuffer();
    const saved = await saveUpload(db.query, userId, jpeg);
    assert.ok(saved.ok);
    const id = saved.image.id;
    assert.equal(await readVisibleImage(db.query, id), null, "sans identité : rien, même avec l'URL");
    assert.equal(await readVisibleImage(db.query, id, crypto.randomUUID()), null, "un tiers : rien");
    const mine = await readVisibleImage(db.query, id, userId);
    assert.ok(mine && mine.public === false, "le propriétaire voit son aperçu, marqué privé (pas de cache partagé)");
    await db.query(`UPDATE users SET avatar_image_id = $2 WHERE id = $1`, [userId, id]);
    const avatar = await readVisibleImage(db.query, id);
    assert.ok(avatar?.public, "devenue photo de profil : publique");
  } finally {
    await lite.close();
    await rm(dir, { recursive: true, force: true });
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
  }
});

test("SEC-03 : chaque tentative IA compte, le plafond bloque le troisième appel même après deux échecs", async () => {
  const previous = process.env.VALYO_SYNTHESES_PAR_JOUR;
  process.env.VALYO_SYNTHESES_PAR_JOUR = "2";
  const { db, lite } = await createTestDb();
  try {
    const { userId, postId } = await addMemberPost(db);
    let calls = 0;
    const summarize: Summarizer = async () => { calls++; throw new Error("échec simulé après réponse fournisseur"); };
    for (let i = 0; i < 2; i++) {
      const result = await developPost({ db, transport: ARTICLE, summarize, userId, postId });
      assert.ok(result.ok && result.state.status === "failed");
    }
    const third = await developPost({ db, transport: ARTICLE, summarize, userId, postId });
    assert.deepEqual([third.ok, !third.ok && third.status], [false, 429], "troisième tentative refusée");
    assert.equal(calls, 2, "le fournisseur n'est jamais appelé au-delà du plafond");
    const [attempts] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM synthesis_attempts`);
    assert.equal(attempts.n, 2, "le journal compte les tentatives, pas la ligne de cache");
  } finally {
    await lite.close();
    if (previous === undefined) delete process.env.VALYO_SYNTHESES_PAR_JOUR;
    else process.env.VALYO_SYNTHESES_PAR_JOUR = previous;
  }
});

test("SEC-03 : relances par publication limitées, cache gratuit, budget monétaire respecté", async () => {
  const budget = process.env.VALYO_SYNTHESES_BUDGET_JOUR;
  const { db, lite } = await createTestDb();
  try {
    const { userId, postId } = await addMemberPost(db);
    const failing: Summarizer = async () => { throw new Error("échec simulé"); };
    for (let i = 0; i < 3; i++) assert.ok((await developPost({ db, transport: ARTICLE, summarize: failing, userId, postId })).ok);
    const fourth = await developPost({ db, transport: ARTICLE, summarize: failing, userId, postId });
    assert.deepEqual([fourth.ok, !fourth.ok && fourth.message.includes("tenté plusieurs fois")], [false, true], "3 relances par article et par jour");

    // Un autre article réussit, avec un coût réel consigné ; le relire ne consomme rien.
    const second = await addPost(db, 'membre2');
    let calls = 0;
    const pricey: Summarizer = async () => {
      calls++;
      return { readable: true, model: "claude-haiku-5-5", costMicros: 1_500_000, synthesis: { essentiel: "E", points: [], contexte: "", limites: "" } };
    };
    assert.equal((await developPost({ db, transport: ARTICLE, summarize: pricey, userId: second.userId, postId: second.postId })).ok, true);
    const again = await developPost({ db, transport: ARTICLE, summarize: pricey, userId: second.userId, postId: second.postId });
    assert.ok(again.ok && again.state.status === "ready");
    assert.equal(calls, 1, "une synthèse terminée est servie du cache, sans nouvel appel");
    const [spent] = await db.query<{ s: string }>(`SELECT COALESCE(sum(cost_micros),0)::text AS s FROM synthesis_attempts`);
    // 1 500 000 réels + 3 échecs à coût inconnu comptés à l'estimation par défaut (3 × 100 000).
    assert.equal(spent.s, "1800000", "coût réel + estimations des échecs journalisés");
    const [estimated] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM synthesis_attempts WHERE cost_estimated`);
    assert.equal(estimated.n, 3, "les coûts inconnus sont marqués comme estimés");

    // Budget quotidien dépassé (1,5 > 1,4) : plus aucune réservation, pour personne.
    process.env.VALYO_SYNTHESES_BUDGET_JOUR = "1.4";
    const third = await addPost(db, 'membre3');
    const blocked = await developPost({ db, transport: ARTICLE, summarize: pricey, userId: third.userId, postId: third.postId });
    assert.deepEqual([blocked.ok, !blocked.ok && blocked.message.includes("budget")], [false, true]);
    assert.equal(calls, 1);
  } finally {
    await lite.close();
    if (budget === undefined) delete process.env.VALYO_SYNTHESES_BUDGET_JOUR;
    else process.env.VALYO_SYNTHESES_BUDGET_JOUR = budget;
  }
});

test("SEC-04 : plus aucune synthèse lisible après retrait, même si la génération finit après coup", async () => {
  const { db, lite } = await createTestDb();
  try {
    const { postId } = await addMemberPost(db);
    const content = { essentiel: "Contenu retiré", points: [], contexte: "", limites: "" };
    await db.query("INSERT INTO post_syntheses(post_id,status,content) VALUES ($1,'ready',$2)", [postId, JSON.stringify(content)]);
    // Mêmes mutations que deletePost (qui purge en plus la synthèse) : la lecture doit refuser
    // même si une ligne a survécu à une suppression ancienne.
    await db.query("UPDATE posts SET status='deleted',deleted_at=now(),title='',body='',demo_url=NULL WHERE id=$1", [postId]);
    await db.query("DELETE FROM post_sources WHERE post_id=$1", [postId]);
    assert.equal((await getSyntheses(db.query, [postId])).get(postId), undefined, "lecture conditionnée au statut publié");

    // Génération qui se termine APRÈS le retrait : rien ne doit être enregistré.
    const late = await addPost(db, 'membre4');
    const summarize: Summarizer = async () => {
      await db.query("UPDATE posts SET status='removed' WHERE id=$1", [late.postId]);
      return { readable: true, model: "m", synthesis: content };
    };
    await developPost({ db, transport: ARTICLE, summarize, userId: late.userId, postId: late.postId });
    const [row] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM post_syntheses WHERE post_id=$1", [late.postId]);
    assert.equal(row.n, 0, "la synthèse tardive est détruite, pas enregistrée");
  } finally { await lite.close(); }
});

test("SEC-06 : la limite de taille coupe la lecture du corps, avec ou sans Content-Length", async () => {
  const ok = await readJson(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ a: 1 }) }));
  assert.deepEqual(ok, { a: 1 });
  const big = "x".repeat(300 * 1024);
  assert.equal(await readJson(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ big }) })), null, "corps déclaré trop grand refusé");
  // Flux sans Content-Length : coupé pendant la lecture, au premier dépassement.
  let pushed = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pushed++;
      if (pushed > 200) controller.close();
      else controller.enqueue(new TextEncoder().encode("y".repeat(64 * 1024)));
    },
  });
  const request = new Request("http://localhost/x", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  assert.equal(request.headers.get("content-length"), null, "pas de Content-Length sur un flux");
  assert.equal(await readJson(request), null);
  assert.ok(pushed < 10, `lecture interrompue tôt (${pushed} blocs de 64 Ko lus, pas 200)`);
});

test("C020-01 : le budget est réservé À LA RÉSERVATION ; des appels concurrents ne le dépassent pas ensemble", async () => {
  const budget = process.env.VALYO_SYNTHESES_BUDGET_JOUR;
  process.env.VALYO_SYNTHESES_BUDGET_JOUR = "1"; // 1,00 ; chaque tentative réserve 0,60
  const { db, lite } = await createTestDb();
  try {
    const [a, b, c] = await Promise.all([addPost(db, "ca"), addPost(db, "cb"), addPost(db, "cc")]);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let calls = 0;
    const summarize: Summarizer = async () => {
      calls++;
      await gate;
      return { readable: true, model: "fixture", costMicros: 600_000, synthesis: { essentiel: "E", points: [], contexte: "", limites: "" } };
    };
    const first = developPost({ db, transport: ARTICLE, summarize, ...a, estimateMicros: 600_000 });
    await new Promise((r) => setTimeout(r, 150)); // la réservation du premier est posée, l'appel est en vol
    const second = await developPost({ db, transport: ARTICLE, summarize, ...b, estimateMicros: 600_000 });
    assert.deepEqual([second.ok, !second.ok && second.message.includes("budget")], [false, true], "refusé PENDANT le premier appel : 0,60 réservé + 0,60 demandé > 1,00");
    release();
    assert.equal((await first).ok, true);
    const third = await developPost({ db, transport: ARTICLE, summarize, ...c, estimateMicros: 600_000 });
    assert.deepEqual([third.ok, !third.ok && third.message.includes("budget")], [false, true], "refusé APRÈS rapprochement : 0,60 dépensé + 0,60 demandé > 1,00");
    assert.equal(calls, 1, "un seul appel fournisseur");
    const [sum] = await db.query<{ s: string }>(`SELECT COALESCE(sum(cost_micros),0)::text AS s FROM synthesis_attempts WHERE finished_at IS NOT NULL`);
    assert.ok(BigInt(sum.s) <= 1_000_000n, `coût total ${sum.s} ≤ plafond`);
  } finally {
    await lite.close();
    if (budget === undefined) delete process.env.VALYO_SYNTHESES_BUDGET_JOUR;
    else process.env.VALYO_SYNTHESES_BUDGET_JOUR = budget;
  }
});

test("C020-01 : usage connu conservé malgré l'échec ; inconnu remplacé par l'estimation marquée ; tarif inconnu jamais compté en Haiku", async () => {
  const { db, lite } = await createTestDb();
  try {
    // Réponse reçue puis inutilisable : le coût réel (porté par SummarizeError) est journalisé.
    const a = await addPost(db, "ka");
    const unusable: Summarizer = async () => { throw new SummarizeError("tronquée", 12_345); };
    await developPost({ db, transport: ARTICLE, summarize: unusable, ...a, estimateMicros: 50_000 });
    // Échec sans usage lisible : l'estimation réservée devient le coût, marquée comme estimée.
    const b = await addPost(db, "kb");
    const unknown: Summarizer = async () => { throw new Error("réseau coupé"); };
    await developPost({ db, transport: ARTICLE, summarize: unknown, ...b, estimateMicros: 50_000 });
    const rows = await db.query<{ post_id: string; cost_micros: string; cost_estimated: boolean }>(
      `SELECT post_id, cost_micros::text, cost_estimated FROM synthesis_attempts ORDER BY created_at`,
    );
    assert.deepEqual(rows.map((r) => [r.post_id, r.cost_micros, r.cost_estimated]), [[a.postId, "12345", false], [b.postId, "50000", true]]);

    const { estimatedCostMicros } = await import("../lib/actus/claude-summarizer.ts");
    assert.equal(estimatedCostMicros("modele-tout-neuf"), estimatedCostMicros("claude-opus-5-5"), "tarif inconnu : compté au plus cher connu, pas en Haiku");
    assert.ok(estimatedCostMicros("claude-haiku-5-5") < estimatedCostMicros("modele-tout-neuf"));
  } finally { await lite.close(); }
});

test("C020-02 : la réponse au demandeur initial ne contient AUCUN texte si la publication est retirée pendant la génération", async () => {
  const { db, lite } = await createTestDb();
  try {
    const f = await addPost(db, "retrait");
    const summarize: Summarizer = async () => {
      await db.query("UPDATE posts SET status='removed' WHERE id=$1", [f.postId]);
      return { readable: true, model: "fixture", synthesis: { essentiel: "Texte retiré", points: [], contexte: "", limites: "" } };
    };
    const result = await developPost({ db, transport: ARTICLE, summarize, ...f });
    assert.ok(result.ok);
    assert.equal(result.state.status, "unavailable", "ni « ready » ni contenu au POST initial");
    assert.ok(!("content" in result.state), "aucun texte dans la réponse");
    assert.equal((await getSyntheses(db.query, [f.postId])).size, 0);
    const [rows] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM post_syntheses WHERE post_id=$1", [f.postId]);
    assert.equal(rows.n, 0);
  } finally { await lite.close(); }
});
