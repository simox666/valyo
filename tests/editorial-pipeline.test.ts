// Agent éditorial, lot 2A : parcours complet sur fixtures avec le fournisseur
// de test déterministe (aucun appel réel), et cas de reprise du contrat §9.
import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetSummary, reserve, settle } from "../lib/editorial/budget.ts";
import { loadConfig, readiness } from "../lib/editorial/config.ts";
import { createFixtureTransport } from "../lib/editorial/fixture-transport.ts";
import { plan, pollBatches, runCycle, submitPending, type Deps } from "../lib/editorial/pipeline.ts";
import { createTestProvider, type TestProviderOptions } from "../lib/editorial/providers/test.ts";
import { claim, complete, enqueue } from "../lib/editorial/tasks.ts";
import type { Db } from "../lib/editorial/types.ts";
import { FIXTURES, NOW, addFixtureSources, addMemberPost, configureForTests, createTestDb } from "./editorial-helpers.ts";

function deps(db: Db, providerOptions: TestProviderOptions = {}, owner = "worker-test"): Deps {
  return { db, transport: createFixtureTransport(FIXTURES), provider: createTestProvider(db.query, providerOptions), now: () => NOW, owner };
}

async function setup() {
  const { db, lite } = await createTestDb();
  await configureForTests(db);
  await addFixtureSources(db);
  const member = await addMemberPost(db);
  return { db, lite, member };
}

const subjectStatus = async (db: Db) =>
  Object.fromEntries(
    (await db.query<{ group_key: string; status: string; block_reason: string | null }>(`SELECT group_key, status, block_reason FROM editorial_subjects`)).map((r) => [
      r.group_key.replace(/^[^/]+\/(articles|actu|prepublications)\//, ""),
      r.block_reason ? `${r.status}:${r.block_reason}` : r.status,
    ]),
  );

test("configuration par défaut : tout est désactivé et les paramètres manquants sont listés", async () => {
  const { db } = await createTestDb();
  const config = await loadConfig(db.query);
  assert.equal(config.paused, true);
  assert.equal(config.mode, "draft");
  assert.equal(config.provider, "none");
  const r = readiness(config);
  assert.equal(r.provider.enabled, false);
  assert.ok(r.provider.missing.some((m) => m.includes("D3")));
  assert.equal(r.recap.enabled, false);
  assert.ok(r.recap.missing.some((m) => m.includes("D8")));
  assert.equal(r.publication.enabled, false);
  const report = await plan({ db, transport: createFixtureTransport(FIXTURES), provider: null, now: () => NOW, owner: "w" });
  assert.equal(report.recapsPlanned, 0, "aucun récapitulatif sans politique validée");
  const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM editorial_sources WHERE active`);
  assert.equal(n, 0, "aucune source active par défaut");
});

test("parcours complet : collecte, regroupement, motifs d'examen, tri, rédaction, assemblage", async () => {
  const { db, member } = await setup();
  const d = deps(db);
  for (let i = 0; i < 3; i++) await runCycle(d);

  // Documents : périmé à la collecte, inaccessible, élément sans lien ignoré.
  const docs = Object.fromEntries(
    (await db.query<{ url: string; status: string; error_code: string | null }>(`SELECT url, status, error_code FROM editorial_documents`)).map((r) => [
      r.url.split("/").pop(),
      r.error_code ? `${r.status}:${r.error_code}` : r.status,
    ]),
  );
  assert.equal(docs.perime, "stale");
  assert.equal(docs.introuvable, "error:source_inaccessible");
  assert.equal(Object.keys(docs).length, 18, "18 éléments avec lien dans les trois flux ; l'élément sans lien est ignoré");

  const subjects = await subjectStatus(db);
  assert.equal(subjects["sans-date"], "review_required:date_manquante");
  assert.equal(subjects.injection, "review_required:instructions_suspectes");
  assert.equal(subjects.contradiction, "review_required:contradiction");
  assert.equal(subjects["url-inventee"], "review_required:resume_non_etaye");
  assert.equal(subjects["citation-inventee"], "review_required:resume_non_etaye");
  assert.equal(subjects["deja-partage"], "duplicate");
  assert.equal(subjects["hors-sujet"], "ignored:non_retenu_au_tri");
  assert.equal(subjects["resume-trompeur"], "review_required:resume_non_etaye", "citation réelle mais titre, chiffres et statut inventés (B003)");
  assert.ok(subjects["robot-humanoide"], "la redirection est regroupée sous l'URL finale");

  // Même annonce dans deux sources : un seul sujet, deux documents.
  const [modele] = await db.query<{ id: string; n: number }>(
    `SELECT s.id, (SELECT count(*)::int FROM editorial_documents d WHERE d.subject_id = s.id) AS n FROM editorial_subjects s WHERE group_key = 'labo.example/articles/modele-ouvert'`,
  );
  assert.equal(modele.n, 2);

  // Récapitulatif : 7 nouvelles prêtes, plafond de 6, sources propres à chaque nouvelle (plus de 5 au total).
  const [recap] = await db.query<{ id: string; state: string; slot_key: string; slot_at: string }>(`SELECT * FROM editorial_recaps`);
  assert.equal(recap.state, "ready");
  assert.equal(recap.slot_key, "2026-11-16T07:00[Europe/Brussels]");
  assert.equal(new Date(recap.slot_at).toISOString(), "2026-11-16T06:00:00.000Z");
  const items = await db.query<{ id: string; position: number; sources: { url: string }[]; subject_id: string }>(
    `SELECT * FROM editorial_recap_items WHERE recap_id = $1 ORDER BY position`,
    [recap.id],
  );
  assert.deepEqual(items.map((i) => i.position), [1, 2, 3, 4, 5, 6]);
  const allSources = items.flatMap((i) => i.sources.map((s) => s.url));
  assert.ok(allSources.length >= 7, `plus de cinq sources dans le récapitulatif (${allSources.length})`);
  assert.equal(items.find((i) => i.subject_id === modele.id)?.sources.length, 2);
  assert.ok(!allSources.some((u) => u.includes("source-inventee")), "aucune source inventée");
  assert.equal(Object.values(subjects).filter((s) => s === "ignored:non_retenu_plafond").length, 1);

  // Le texte du membre n'est jamais modifié et rien n'est publié dans ce lot.
  const [post] = await db.query<{ body: string }>(`SELECT body FROM posts WHERE id = $1`, [member.postId]);
  assert.equal(post.body, "Texte original du membre, à ne jamais modifier.");
  const [{ n: agentPosts }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM posts p JOIN users u ON u.id = p.author_id WHERE u.role = 'agent'`);
  assert.equal(agentPosts, 0);

  // Budget : trois lots (tri, rédaction, vérification), rapprochés une fois, sous le plafond.
  const spend = await db.query<{ state: string }>(`SELECT state FROM editorial_spend`);
  assert.deepEqual(spend.map((s) => s.state), ["settled", "settled", "settled"]);
  const summary = await budgetSummary(db.query, "2026-11", 5_000_000n, "USD");
  assert.ok(summary.settledMicros > 0n && summary.settledMicros <= 5_000_000n);
  assert.equal(summary.reservedMicros, 0n);

  // Idempotence : de nouveaux cycles ne dupliquent ni documents, ni sujets, ni nouvelles, ni coûts.
  const counts = async () =>
    (await db.query(`SELECT (SELECT count(*) FROM editorial_documents) d, (SELECT count(*) FROM editorial_subjects) s,
      (SELECT count(*) FROM editorial_recap_items) i, (SELECT count(*) FROM editorial_spend) c`))[0];
  const before = await counts();
  for (let i = 0; i < 2; i++) await runCycle(d);
  assert.deepEqual(await counts(), before);
});

test("résultat rejoué ou tardif : ni double application ni double coût", async () => {
  const { db } = await setup();
  const d = deps(db);
  for (let i = 0; i < 3; i++) await runCycle(d);
  const spendBefore = await db.query(`SELECT * FROM editorial_spend ORDER BY created_at`);
  await db.query(`UPDATE editorial_batches SET state = 'submitted'`);
  const report = await pollBatches(d);
  assert.equal(report.applied, 0);
  assert.ok(report.ignored > 0);
  assert.equal(report.settled, 0);
  assert.deepEqual(await db.query(`SELECT * FROM editorial_spend ORDER BY created_at`), spendBefore);
});

test("réponse partielle : rien n'est appliqué ni resoumis, la réservation est conservée (revue C201)", async () => {
  const { db } = await setup();
  await runCycle(deps(db)); // collecte + tri
  const [draft] = await db.query<{ id: string }>(`SELECT id FROM editorial_tasks WHERE kind = 'draft' ORDER BY created_at LIMIT 1`);
  const d = deps(db, { dropTaskIds: new Set([draft.id]) });
  await submitPending(d);
  const report = await pollBatches(d);
  assert.equal(report.incomplete, 1);
  assert.equal(report.applied, 0, "aucun résultat d'un lot incomplet n'est appliqué");
  const [task] = await db.query<{ state: string }>(`SELECT state FROM editorial_tasks WHERE id = $1`, [draft.id]);
  assert.equal(task.state, "waiting_provider", "pas de resoumission d'une requête possiblement facturée");
  const [spend] = await db.query<{ state: string }>(`SELECT s.state FROM editorial_spend s JOIN editorial_batches b ON b.id = s.batch_id ORDER BY b.created_at DESC LIMIT 1`);
  assert.equal(spend.state, "reserved");
  const [recap] = await db.query<{ state: string }>(`SELECT state FROM editorial_recaps`);
  assert.equal(recap.state, "planned", "pas d'assemblage tant qu'une rédaction manque");
});

test("soumission dont la réponse est perdue : état incertain, réservation conservée, aucune seconde soumission", async () => {
  const { db } = await setup();
  const d = deps(db, { failSubmitAfterSend: true });
  await runCycle(d);
  const [batch] = await db.query<{ id: string; state: string }>(`SELECT * FROM editorial_batches`);
  assert.equal(batch.state, "uncertain");
  const tasks = await db.query<{ state: string }>(`SELECT state FROM editorial_tasks WHERE batch_id = $1`, [batch.id]);
  assert.ok(tasks.length > 0 && tasks.every((t) => t.state === "uncertain"));
  const [spend] = await db.query<{ state: string }>(`SELECT state FROM editorial_spend WHERE batch_id = $1`, [batch.id]);
  assert.equal(spend.state, "uncertain");
  await runCycle(d);
  const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM editorial_batches`);
  assert.equal(n, 1, "les tâches incertaines ne sont pas resoumises");
});

test("soumission perdue mais retrouvée par identifiant interne : rapprochement sans doublon", async () => {
  const { db } = await setup();
  const d = deps(db, { failSubmitAfterSend: true, canFindByInternalId: true });
  await runCycle(d);
  const [batch] = await db.query<{ state: string; external_id: string }>(`SELECT * FROM editorial_batches`);
  assert.equal(batch.state, "ended");
  assert.ok(batch.external_id.startsWith("test_"));
});

test("pause : aucune nouvelle soumission ; les résultats déjà payés sont récupérés en brouillon", async () => {
  const { db } = await setup();
  const d = deps(db);
  await runCycle(d); // tri soumis puis appliqué ; rédactions en attente
  await db.query(`UPDATE editorial_config SET paused = true WHERE id = 1`);
  const res = await submitPending(d);
  assert.equal(res.submitted, 0);
  assert.match(res.reason ?? "", /pause/);
  const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM editorial_tasks WHERE kind = 'draft' AND state = 'pending'`);
  assert.ok(n > 0, "les rédactions restent en attente");
});

test("plafond : la réservation qui dépasserait le budget est refusée, sans écriture", async () => {
  const { db } = await setup();
  await db.query(`UPDATE editorial_config SET budget_cap_micros = 1 WHERE id = 1`);
  const res = await submitPending({ ...deps(db), now: () => NOW });
  await plan(deps(db));
  await runCycle(deps(db));
  assert.equal(res.submitted, 0);
  const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM editorial_batches`);
  assert.equal(n, 0, "aucun lot créé au-delà du plafond");
});

test("deux réservations simultanées près du plafond : une seule passe", async () => {
  const { db } = await createTestDb();
  const batches = await Promise.all([0, 1].map(async () => (await db.query<{ id: string }>(`INSERT INTO editorial_batches (provider, state) VALUES ('test', 'submitting') RETURNING id`))[0].id));
  const results = await Promise.all(
    batches.map((batchId) => db.transaction((q) => reserve(q, { batchId, estimateMicros: 600n, capMicros: 1000n, currency: "USD", now: NOW }))),
  );
  assert.deepEqual([...results].sort(), [false, true]);
  const accepted = batches[results.indexOf(true)];
  const refused = batches[results.indexOf(false)];
  assert.equal(await settle(db.query, refused, 1n), "already", "aucune réservation n'existe pour le lot refusé");
  assert.equal(await settle(db.query, accepted, 700n), "estimation_exceeded", "coût réel supérieur à la réservation : signalé");
  assert.equal(await settle(db.query, accepted, 700n), "already", "rapprochement unique");
});

test("tâches : réclamations simultanées distinctes, bail expiré repris, résultat d'un bail perdu ignoré", async () => {
  const { db } = await createTestDb();
  await enqueue(db.query, { kind: "collect_source", key: "a", payload: {} });
  await enqueue(db.query, { kind: "collect_source", key: "b", payload: {} });
  assert.equal((await enqueue(db.query, { kind: "collect_source", key: "a", payload: {} })).created, false, "clé d'idempotence");
  const [t1, t2] = await Promise.all([claim(db, "w1", ["collect_source"]), claim(db, "w2", ["collect_source"])]);
  assert.ok(t1 && t2 && t1.id !== t2.id);

  await db.query(`UPDATE editorial_tasks SET lease_expires_at = now() - interval '1 second' WHERE id = $1`, [t1!.id]);
  const reclaimed = await claim(db, "w3", ["collect_source"]);
  assert.equal(reclaimed?.id, t1!.id);
  assert.equal(await complete(db.query, t1!, {}), false, "l'ancien jeton de bail ne peut plus terminer");
  assert.equal(await complete(db.query, reclaimed!, {}), true);
});

test("créneau dépassé avant assemblage : aucun résultat incomplet publié, examen requis", async () => {
  const { db } = await setup();
  await runCycle(deps(db)); // tri fait, rédactions en attente
  const later = { ...deps(db), now: () => new Date("2026-11-16T07:00:00Z"), provider: null };
  const report = await plan(later);
  assert.equal(report.recapsOverdue, 1);
  const [recap] = await db.query<{ state: string; notes: { motif: string } }>(`SELECT * FROM editorial_recaps`);
  assert.equal(recap.state, "review_required");
  assert.equal(recap.notes.motif, "echeance_depassee");
});
