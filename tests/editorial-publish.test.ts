// Transaction de publication et retrait/correction éditoriale (lot d'accélération A8).
// Voie testée sur base PGlite en mémoire UNIQUEMENT : la capacité reste désactivée
// (mode brouillon) sur toute base réelle.
import assert from "node:assert/strict";
import { test } from "node:test";
import { correctPublishedItem, publishRecap, withdrawRecap } from "../lib/editorial/publish.ts";
import type { Db } from "../lib/editorial/types.ts";
import { addMemberPost, configureForTests, createTestDb } from "./editorial-helpers.ts";

const NOW = new Date("2026-11-16T05:00:00Z");
const FRESH = new Date("2026-11-15T08:00:00Z"); // 21 h avant NOW
const STALE = new Date("2026-11-06T08:00:00Z"); // bien au-delà de 72 h

let seq = 0;

async function seedItem(db: Db, recapId: string, position: number, publishedAt: Date, url?: string) {
  const n = ++seq;
  const theUrl = url ?? `https://pub-${n}.example/article`;
  const [source] = await db.query<{ id: string }>(
    `INSERT INTO editorial_sources (name, feed_url, source_type, priority, fetch_articles, active) VALUES ($1, $2, 'primary', 1, false, false) RETURNING id`,
    [`Source ${n}`, `https://pub-${n}.example/flux`],
  );
  const [subject] = await db.query<{ id: string }>(
    `INSERT INTO editorial_subjects (group_key, title, status, recap_id) VALUES ($1, $2, 'ready', $3) RETURNING id`,
    [`groupe-${n}`, `Nouvelle numéro ${n}`, recapId],
  );
  await db.query(
    `INSERT INTO editorial_documents (source_id, url, normalized_url, title, summary, published_at, content_hash, status, extracted_text, subject_id)
     VALUES ($1, $2, $3, $4, 'Résumé.', $5, md5($2), 'grouped', 'Texte du document.', $6)`,
    [source.id, theUrl, theUrl.replace(/^https:\/\//, ""), `Nouvelle numéro ${n}`, publishedAt.toISOString(), subject.id],
  );
  const [item] = await db.query<{ id: string }>(
    `INSERT INTO editorial_recap_items (recap_id, subject_id, position, title, summary, scientific_status, sources, claims)
     VALUES ($1, $2, $3, $4, $5, 'announcement', $6, '{"statements":[],"simulated":true}') RETURNING id`,
    [recapId, subject.id, position, `Nouvelle numéro ${n}`, `Résumé vérifié de la nouvelle numéro ${n}, suffisamment long.`, JSON.stringify([{ url: theUrl, title: `Nouvelle numéro ${n}` }])],
  );
  return { itemId: item.id, subjectId: subject.id, url: theUrl };
}

async function seedReadyRecap(db: Db, dates: Date[] = [FRESH]) {
  const n = ++seq;
  const [recap] = await db.query<{ id: string }>(
    `INSERT INTO editorial_recaps (slot_key, slot_at, state) VALUES ($1, $2, 'ready') RETURNING id`,
    [`publication-${n}`, new Date(NOW.getTime() - 3600_000).toISOString()],
  );
  const items = [];
  for (let i = 0; i < dates.length; i++) items.push(await seedItem(db, recap.id, i + 1, dates[i]));
  return { recapId: recap.id, items };
}

async function setupDb(mode: "draft" | "public", paused = false) {
  const { db } = await createTestDb();
  await configureForTests(db, { paused });
  await db.query(`UPDATE editorial_config SET mode = $1 WHERE id = 1`, [mode]);
  return db;
}

const ACTOR = { actorId: null, actorLabel: "admin-test" };

test("capacité désactivée : en mode brouillon ou en pause, aucune publication", async () => {
  const draftDb = await setupDb("draft");
  const a = await seedReadyRecap(draftDb);
  const refusedDraft = await publishRecap(draftDb, { recapId: a.recapId, expectedVersion: 1, now: NOW, ...ACTOR });
  assert.deepEqual([refusedDraft.ok, (refusedDraft as { code: string }).code], [false, "capacite"]);

  const pausedDb = await setupDb("public", true);
  const b = await seedReadyRecap(pausedDb);
  const refusedPause = await publishRecap(pausedDb, { recapId: b.recapId, expectedVersion: 1, now: NOW, ...ACTOR });
  assert.deepEqual([refusedPause.ok, (refusedPause as { code: string }).code], [false, "pause"]);
  for (const db of [draftDb, pausedDb]) assert.equal((await db.query(`SELECT id FROM posts`)).length, 0);
});

test("publication : post de l'agent créé avec sources, unicité et version garanties", async () => {
  const db = await setupDb("public");
  const { recapId } = await seedReadyRecap(db, [FRESH, FRESH]);

  const wrongVersion = await publishRecap(db, { recapId, expectedVersion: 7, now: NOW, ...ACTOR });
  assert.equal((wrongVersion as { code: string }).code, "version");

  const outcome = await publishRecap(db, { recapId, expectedVersion: 1, now: NOW, ...ACTOR });
  assert.ok(outcome.ok);
  assert.equal(outcome.ok && outcome.published, 2);

  const [post] = await db.query(`SELECT p.*, u.role FROM posts p JOIN users u ON u.id = p.author_id`);
  assert.equal(post.role, "agent");
  assert.match(post.body as string, /Résumés automatisés par l'agent éditorial/);
  assert.equal((await db.query(`SELECT * FROM post_sources WHERE post_id = $1`, [post.id])).length, 2);
  const [recap] = await db.query(`SELECT * FROM editorial_recaps WHERE id = $1`, [recapId]);
  assert.equal(recap.state, "published");
  assert.equal(Number(recap.version), 2);

  const again = await publishRecap(db, { recapId, expectedVersion: 2, now: NOW, ...ACTOR });
  assert.equal((again as { code: string }).code, "deja_publie");
  assert.equal((await db.query(`SELECT id FROM posts`)).length, 1, "aucun second post");
});

test("au commit : fraîcheur à l'instant réel et doublon tardif excluent leurs éléments", async () => {
  const db = await setupDb("public");
  const { recapId, items } = await seedReadyRecap(db, [FRESH, STALE, FRESH]);
  // Doublon tardif : un membre publie la même adresse APRÈS l'assemblage.
  await addMemberPost(db, items[2].url);
  await db.query(`UPDATE post_sources SET normalized_url = $1 WHERE normalized_url = 'labo.example/articles/deja-partage'`, [
    items[2].url.replace(/^https:\/\//, ""),
  ]);

  const outcome = await publishRecap(db, { recapId, expectedVersion: 1, now: NOW, ...ACTOR });
  assert.ok(outcome.ok);
  assert.equal(outcome.ok && outcome.published, 1);
  assert.deepEqual(
    outcome.ok && outcome.excluded.map((e) => e.motif).sort(),
    ["doublon_tardif", "perime_au_commit"],
  );
  const [stale] = await db.query(`SELECT status, block_reason FROM editorial_subjects WHERE id = $1`, [items[1].subjectId]);
  assert.deepEqual([stale.status, stale.block_reason], ["ignored", "perime"]);
  const [dup] = await db.query(`SELECT status FROM editorial_subjects WHERE id = $1`, [items[2].subjectId]);
  assert.equal(dup.status, "duplicate");
});

test("plus rien de publiable au commit : rien n'est publié", async () => {
  const db = await setupDb("public");
  const { recapId } = await seedReadyRecap(db, [STALE]);
  const outcome = await publishRecap(db, { recapId, expectedVersion: 1, now: NOW, ...ACTOR });
  assert.equal((outcome as { code: string }).code, "vide");
  assert.equal((await db.query(`SELECT id FROM posts`)).length, 0);
});

test("retrait : la publication devient indisponible, le motif est journalisé", async () => {
  const db = await setupDb("public");
  const { recapId } = await seedReadyRecap(db);
  const published = await publishRecap(db, { recapId, expectedVersion: 1, now: NOW, ...ACTOR });
  assert.ok(published.ok);

  const outcome = await withdrawRecap(db, { recapId, motif: "Erreur factuelle signalée", ...ACTOR });
  assert.ok(outcome.ok);
  const [post] = await db.query(`SELECT status FROM posts`);
  assert.equal(post.status, "removed");
  const [recap] = await db.query(`SELECT state FROM editorial_recaps WHERE id = $1`, [recapId]);
  assert.equal(recap.state, "withdrawn");
  const log = await db.query(`SELECT reason FROM editorial_revisions WHERE entity = 'recap' ORDER BY created_at DESC LIMIT 1`);
  assert.match(log[0].reason as string, /Retrait éditorial : Erreur factuelle signalée/);
});

test("correction publiée : texte remplacé dans le post, version augmentée, vérification invalidée", async () => {
  const db = await setupDb("public");
  const { recapId, items } = await seedReadyRecap(db);
  const published = await publishRecap(db, { recapId, expectedVersion: 1, now: NOW, ...ACTOR });
  assert.ok(published.ok);

  const outcome = await correctPublishedItem(db, {
    itemId: items[0].itemId,
    title: "Titre corrigé après publication",
    summary: "Résumé corrigé après publication, suffisamment long pour le schéma.",
    motif: "Chiffre corrigé d'après la source",
    ...ACTOR,
  });
  assert.ok(outcome.ok);
  const [post] = await db.query(`SELECT body, edited_at FROM posts`);
  assert.match(post.body as string, /Titre corrigé après publication/);
  assert.ok(post.edited_at);
  const [recap] = await db.query(`SELECT version FROM editorial_recaps WHERE id = $1`, [recapId]);
  assert.equal(Number(recap.version), 3);
  const [item] = await db.query(`SELECT claims, human_revision FROM editorial_recap_items WHERE id = $1`, [items[0].itemId]);
  assert.equal(item.claims, null);
  assert.equal((item.human_revision as { correctionPubliee: boolean }).correctionPubliee, true);
});
