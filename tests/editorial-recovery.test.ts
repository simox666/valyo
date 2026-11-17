// Revue du lot 2A : interruptions entre écritures (B001), coûts reprenables au tarif
// figé du lot (B002) et bail protégeant les écritures métier (B004).
import { test } from "node:test";
import assert from "node:assert/strict";
import { costMicros } from "../lib/editorial/budget.ts";
import { createFixtureTransport } from "../lib/editorial/fixture-transport.ts";
import type { Transport } from "../lib/editorial/fetch.ts";
import { plan, pollBatches, runCycle, runLocalTasks, submitPending, type Deps } from "../lib/editorial/pipeline.ts";
import { createTestProvider, type TestProviderOptions } from "../lib/editorial/providers/test.ts";
import { claim, enqueue, renewLease } from "../lib/editorial/tasks.ts";
import type { Db } from "../lib/editorial/types.ts";
import { FIXTURES, NOW, addFixtureSources, addMemberPost, configureForTests, createTestDb } from "./editorial-helpers.ts";

function deps(db: Db, extra: Partial<Deps> = {}, providerOptions: TestProviderOptions = {}): Deps {
  return { db, transport: createFixtureTransport(FIXTURES), provider: createTestProvider(db.query, providerOptions), now: () => NOW, owner: "w", ...extra };
}

async function setup() {
  const { db } = await createTestDb();
  await configureForTests(db);
  await addFixtureSources(db);
  await addMemberPost(db);
  return db;
}

const count = async (db: Db, sql: string, params: unknown[] = []) => (await db.query<{ n: number }>(sql, params))[0].n;
const makeDue = (db: Db) => db.query(`UPDATE editorial_tasks SET next_attempt_at = now() WHERE state = 'pending'`);

/** Panne injectée une seule fois au point donné. */
function injectOnce(point: string) {
  let fired = false;
  return (p: string) => {
    if (p === point && !fired) {
      fired = true;
      throw new Error(`panne injectée : ${p}`);
    }
  };
}

test("B001 — panne entre l'affectation des sujets et la tâche de tri : rien n'est perdu à la reprise", async () => {
  const db = await setup();
  await plan(deps(db));
  await runLocalTasks(deps(db, { inject: injectOnce("preparation:apres-affectation") }));

  assert.equal(await count(db, `SELECT count(*)::int AS n FROM editorial_subjects WHERE recap_id IS NOT NULL`), 0, "affectation annulée avec la transaction");
  assert.equal(await count(db, `SELECT count(*)::int AS n FROM editorial_tasks WHERE kind = 'triage'`), 0);
  const [prep] = await db.query<{ state: string }>(`SELECT state FROM editorial_tasks WHERE kind = 'prepare_recap'`);
  assert.equal(prep.state, "pending", "la préparation sera retentée");

  await makeDue(db);
  await runLocalTasks(deps(db));
  const assigned = await count(db, `SELECT count(*)::int AS n FROM editorial_subjects WHERE recap_id IS NOT NULL`);
  assert.ok(assigned > 0, "sujets affectés à la reprise");
  assert.equal(await count(db, `SELECT count(*)::int AS n FROM editorial_tasks WHERE kind = 'triage'`), 1, "une seule tâche de tri");
  const [recap] = await db.query<{ state: string }>(`SELECT state FROM editorial_recaps`);
  assert.equal(recap.state, "planned", "jamais « vide » à cause de la panne");
});

test("B001 — panne après la création d'un document : ni document orphelin ni tâche d'extraction manquante", async () => {
  const db = await setup();
  await plan(deps(db));
  await runLocalTasks(deps(db, { inject: injectOnce("collect:apres-document") }), 1);
  assert.equal(await count(db, `SELECT count(*)::int AS n FROM editorial_documents`), 0, "écritures annulées");

  await makeDue(db);
  await runLocalTasks(deps(db));
  const docs = await count(db, `SELECT count(*)::int AS n FROM editorial_documents WHERE status <> 'stale'`);
  const extracts = await count(db, `SELECT count(*)::int AS n FROM editorial_tasks WHERE kind = 'extract_document'`);
  assert.ok(docs > 0);
  assert.equal(extracts, docs, "une tâche d'extraction par document non périmé");
});

test("B001 — filet de sécurité : une tâche d'extraction manquante est reconstruite depuis les documents", async () => {
  const db = await setup();
  await runCycle(deps(db));
  const [doc] = await db.query<{ id: string }>(`SELECT id FROM editorial_documents WHERE status IN ('extracted', 'grouped') LIMIT 1`);
  await db.query(`UPDATE editorial_documents SET status = 'collected' WHERE id = $1`, [doc.id]);
  await db.query(`DELETE FROM editorial_tasks WHERE idempotency_key = $1`, [`extract:${doc.id}`]);
  const report = await plan(deps(db));
  assert.equal(report.extractRepaired, 1);
  assert.equal(await count(db, `SELECT count(*)::int AS n FROM editorial_tasks WHERE idempotency_key = $1`, [`extract:${doc.id}`]), 1);
});

test("B004 — ancien worker libéré après reprise par un autre (même nom de worker) : aucune écriture de l'ancien", async () => {
  const db = await setup();
  const [source] = await db.query<{ id: string }>(`SELECT id FROM editorial_sources WHERE feed_url = 'https://labo.example/flux.xml'`);
  await enqueue(db.query, { kind: "collect_source", key: "collect-unique", payload: { sourceId: source.id } });

  // Le worker A lit une version différente du flux, puis reste bloqué sur le réseau.
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let reached!: () => void;
  const atGate = new Promise<void>((r) => (reached = r));
  const base = createFixtureTransport(FIXTURES);
  const slowA: Transport = {
    async get(url, accept) {
      const res = await base.get(url, accept);
      reached();
      await gate;
      return { ...res, body: res.body.replace(/<title>([^<]+)<\/title>/g, "<title>$1 (version A)</title>") };
    },
  };
  const runA = runLocalTasks(deps(db, { transport: slowA, owner: "meme-worker" }), 1);
  await atGate;

  // Le bail de A expire ; B (même nom de worker) reprend et termine.
  await db.query(`UPDATE editorial_tasks SET lease_expires_at = now() - interval '1 second' WHERE idempotency_key = 'collect-unique'`);
  const reportB = await runLocalTasks(deps(db, { owner: "meme-worker" }), 1);
  assert.equal(reportB.done, 1);
  const [afterB] = await db.query<{ result: unknown; updated_at: string }>(`SELECT result, updated_at FROM editorial_tasks WHERE idempotency_key = 'collect-unique'`);

  release();
  const reportA = await runA;
  assert.equal(reportA.leaseLost, 1, "A constate la perte du bail");
  assert.equal(await count(db, `SELECT count(*)::int AS n FROM editorial_documents WHERE title LIKE '%(version A)%'`), 0, "aucune écriture métier de A");
  const [afterA] = await db.query<{ state: string; result: unknown; updated_at: string }>(`SELECT * FROM editorial_tasks WHERE idempotency_key = 'collect-unique'`);
  assert.equal(afterA.state, "done");
  assert.deepEqual(afterA.result, afterB.result, "la clôture de B n'est pas remplacée");
  assert.equal(new Date(afterA.updated_at).getTime(), new Date(afterB.updated_at).getTime());
});

test("B004 — bail expiré sans nouvelle réclamation : aucune écriture, la tâche reste reprenable", async () => {
  const db = await setup();
  const [source] = await db.query<{ id: string }>(`SELECT id FROM editorial_sources WHERE feed_url = 'https://agence.example/flux.atom'`);
  await enqueue(db.query, { kind: "collect_source", key: "collect-expire", payload: { sourceId: source.id } });
  const base = createFixtureTransport(FIXTURES);
  const expiring: Transport = {
    async get(url, accept) {
      const res = await base.get(url, accept);
      await db.query(`UPDATE editorial_tasks SET lease_expires_at = now() - interval '1 second' WHERE idempotency_key = 'collect-expire'`);
      return res;
    },
  };
  const report = await runLocalTasks(deps(db, { transport: expiring }), 1);
  assert.equal(report.leaseLost, 1);
  assert.equal(await count(db, `SELECT count(*)::int AS n FROM editorial_documents`), 0);
  const again = await claim(db, "autre", ["collect_source"]);
  assert.equal(again?.idempotencyKey, "collect-expire", "reprise possible par un autre worker");
});

test("B004 — renouvellement du bail seulement par le détenteur du jeton courant", async () => {
  const db = await setup();
  await enqueue(db.query, { kind: "collect_source", key: "renouvelle", payload: {} });
  const t = (await claim(db, "w", ["collect_source"]))!;
  assert.equal(await renewLease(db.query, t, 600), true);
  assert.equal(await renewLease(db.query, { ...t, leaseToken: "00000000-0000-0000-0000-000000000000" }, 600), false);
});

test("B002/C201 — lecture incomplète puis en erreur puis complète : réservation conservée, résultats et coût appliqués une seule fois", async () => {
  const db = await setup();
  const d = deps(db, {}, { usageFailures: ["null", "throw"] });
  await runCycle(d); // tri soumis ; première lecture incomplète
  const [batch] = await db.query<{ id: string; state: string; reconciled_at: string | null }>(`SELECT * FROM editorial_batches`);
  assert.equal(batch.state, "submitted", "rien n'est appliqué tant que la lecture est incomplète");
  assert.equal(batch.reconciled_at, null);
  const [spend1] = await db.query<{ state: string }>(`SELECT state FROM editorial_spend WHERE batch_id = $1`, [batch.id]);
  assert.equal(spend1.state, "reserved", "réservation conservée tant que l'usage est inconnu");

  const second = await pollBatches(d); // la lecture lève une erreur : rien ne change
  assert.equal(second.applied, 0);
  const third = await pollBatches(d); // lecture complète
  assert.equal(third.applied, 1);
  assert.equal(third.settled, 1);
  const fourth = await pollBatches(d);
  assert.equal(fourth.settled, 0, "jamais rapproché deux fois");
  const [spend] = await db.query<{ state: string }>(`SELECT state FROM editorial_spend WHERE batch_id = $1`, [batch.id]);
  assert.equal(spend.state, "settled");
  assert.equal(await count(db, `SELECT count(*)::int AS n FROM editorial_tasks WHERE kind = 'triage' AND state = 'done'`), 1, "résultats non réappliqués");
});

test("B002 — prix modifiés pendant le lot : le coût suit le tarif figé à la soumission", async () => {
  const db = await setup();
  const d = deps(db);
  await runCycle(d); // tri : terminé et rapproché
  await submitPending(d); // rédactions soumises au tarif initial
  await db.query(`UPDATE editorial_config SET prices = '{"inputPerMTokMicros": 400000000, "outputPerMTokMicros": 2000000000}'::jsonb WHERE id = 1`);
  await pollBatches(d);
  const [batch] = await db.query<{ id: string; prices: { inputPerMTokMicros: number; outputPerMTokMicros: number }; usage: { inputTokens: number; outputTokens: number } }>(
    `SELECT * FROM editorial_batches ORDER BY created_at DESC LIMIT 1`,
  );
  assert.equal(batch.prices.inputPerMTokMicros, 4_000_000, "instantané du tarif initial");
  const [spend] = await db.query<{ actual_micros: string | bigint }>(`SELECT actual_micros FROM editorial_spend WHERE batch_id = $1`, [batch.id]);
  assert.equal(BigInt(String(spend.actual_micros)), costMicros(batch.usage, batch.prices));
});
