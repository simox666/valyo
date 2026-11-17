// Tests de la commande d'essai borné (lot d'accélération A1-A3, protocole C008).
// Transports et fournisseurs SYNTHÉTIQUES uniquement : aucun appel réseau réel.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFixtureTransport } from "../lib/editorial/fixture-transport.ts";
import { createTestProvider, type TestProviderOptions } from "../lib/editorial/providers/test.ts";
import type { EditorialProvider } from "../lib/editorial/providers/types.ts";
import {
  SYNTHETIC_TRIAL_DOCUMENT,
  TRIAL_MAX_BATCHES,
  TrialError,
  trialInit,
  trialPreview,
  trialReport,
  trialStatus,
  trialStep,
} from "../lib/editorial/trial.ts";
import type { Db } from "../lib/editorial/types.ts";
import { FIXTURES, addMemberPost, createTestDb } from "./editorial-helpers.ts";

const SETUP = {
  config: {
    provider: "test" as const,
    model: null,
    prices: { inputPerMTokMicros: 2_000_000, outputPerMTokMicros: 10_000_000 },
    currency: "USD",
    budgetCapMicros: 20_000_000n,
    timezone: "Europe/Brussels",
  },
  document: SYNTHETIC_TRIAL_DOCUMENT,
  actorLabel: "test de l'essai",
};

function makeDeps(db: Db, provider: EditorialProvider | null, owner = "essai-test") {
  return { db, transport: createFixtureTransport(FIXTURES), provider, now: () => new Date(), owner };
}

function depsWith(db: Db, options: TestProviderOptions = {}, owner = "essai-test") {
  return makeDeps(db, createTestProvider(db.query, options), owner);
}

async function runToEnd(deps: ReturnType<typeof makeDeps>, maxSteps = 8) {
  let status = await trialStep(deps);
  for (let i = 0; i < maxSteps && !status.stoppedReason && status.phase !== "terminee" && status.phase !== "vide"; i++) {
    status = await trialStep(deps);
  }
  return status;
}

test("essai complet : trois lots d'une requête, récapitulatif prêt, pause finale, rapport sans identifiant externe", async () => {
  const { db } = await createTestDb();
  const deps = depsWith(db);
  await trialInit(deps, SETUP);

  // Aperçu avant toute soumission : aucune génération, aucun lot.
  const preview = await trialPreview(deps);
  assert.equal(preview.simulated, true);
  assert.equal(preview.pending?.kind, "triage");
  assert.ok(preview.pending!.boundMicros > 0n);
  assert.equal(preview.worstCaseTotalMicros, preview.pending!.boundMicros * BigInt(TRIAL_MAX_BATCHES));
  assert.equal((await db.query(`SELECT id FROM editorial_batches`)).length, 0);

  const status = await runToEnd(deps);
  assert.equal(status.phase, "terminee");
  assert.equal(status.stoppedReason, null);
  assert.equal(status.batchesCreated, 3);
  assert.equal(status.requestsSubmitted, 3);
  assert.equal(status.items, 1);
  assert.equal(status.subject?.status, "ready");

  // Chaque lot a exactement une requête et est rapproché.
  const batches = await db.query(`SELECT state, task_ids, reconciled_at FROM editorial_batches`);
  assert.equal(batches.length, 3);
  for (const b of batches) {
    assert.equal((b.task_ids as string[]).length, 1);
    assert.equal(b.state, "ended");
    assert.ok(b.reconciled_at);
  }
  const spend = await db.query(`SELECT state FROM editorial_spend`);
  assert.deepEqual(spend.map((s) => s.state).sort(), ["settled", "settled", "settled"]);

  // Pause après la fin de l'essai (protocole §Limites).
  const [config] = await db.query(`SELECT paused FROM editorial_config WHERE id = 1`);
  assert.equal(config.paused, true);

  // Le rapport ne contient ni identifiant externe de lot ni mention d'une clé.
  const report = await trialReport(deps);
  const text = JSON.stringify(report);
  const externals = await db.query<{ external_id: string }>(`SELECT external_id FROM editorial_batches`);
  for (const e of externals) assert.ok(!text.includes(e.external_id as string), "identifiant externe présent dans le rapport");
  assert.ok(!/api[_-]?key|sk-ant/i.test(text));
  assert.equal((report.essai as { requetesSoumises: number }).requetesSoumises, 3);
});

test("base non dédiée refusée : données humaines ou éditoriales préexistantes", async () => {
  const { db } = await createTestDb();
  await addMemberPost(db);
  await assert.rejects(trialInit(depsWith(db), SETUP), (e: Error) => e instanceof TrialError && /Base non dédiée/.test(e.message));
});

test("second lancement refusé ; reprise après lecture incomplète sans double soumission", async () => {
  const { db } = await createTestDb();
  // Première lecture du lot incomplète (usage pas encore disponible) : rien n'est appliqué.
  const first = depsWith(db, { usageFailures: ["null"] }, "essai-1");
  await trialInit(first, SETUP);
  await assert.rejects(trialInit(first, SETUP), (e: Error) => e instanceof TrialError && /existe déjà/.test(e.message));

  await trialStep(first); // soumission du tri + lecture incomplète
  let batches = await db.query(`SELECT state, reconcile_attempts FROM editorial_batches`);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].state, "submitted");
  assert.equal(Number(batches[0].reconcile_attempts), 1);
  const reserved = await db.query(`SELECT state FROM editorial_spend`);
  assert.deepEqual(reserved.map((s) => s.state), ["reserved"]);

  // « Relance » : un nouveau processus reprend l'état persistant, ne resoumet pas le tri.
  const resumed = depsWith(db, {}, "essai-2");
  await assert.rejects(trialInit(resumed, SETUP), TrialError);
  const status = await runToEnd(resumed);
  assert.equal(status.phase, "terminee");
  assert.equal(status.batchesCreated, 3);
  assert.equal(status.requestsSubmitted, 3);
  const triages = await db.query(`SELECT attempts FROM editorial_tasks WHERE kind = 'triage'`);
  assert.equal(Number(triages[0].attempts), 1);
});

test("soumission ambiguë : arrêt, réservation conservée, aucun nouveau lot", async () => {
  const { db } = await createTestDb();
  const deps = depsWith(db, { failSubmitAfterSend: true });
  await trialInit(deps, SETUP);
  let status = await trialStep(deps);
  assert.match(status.stoppedReason ?? "", /incertaine|incertain/);

  // Nouvel essai de pas, même avec un fournisseur redevenu sain : rien n'est recréé.
  status = await trialStep(depsWith(db));
  assert.equal(status.phase, "arretee");
  assert.equal(status.batchesCreated, 1);
  const [batch] = await db.query(`SELECT state FROM editorial_batches`);
  assert.equal(batch.state, "uncertain");
  const spend = await db.query(`SELECT state FROM editorial_spend`);
  assert.deepEqual(spend.map((s) => s.state), ["uncertain"]);
});

test("nombre maximal de créations de lot : la requête suivante n'est pas soumise", async () => {
  const { db } = await createTestDb();
  const deps = depsWith(db);
  await trialInit(deps, { ...SETUP, maxBatches: 2 });
  const status = await runToEnd(deps);
  assert.equal(status.phase, "arretee");
  assert.match(status.stoppedReason ?? "", /nombre maximal de créations de lot atteint \(2\)/);
  assert.equal(status.batchesCreated, 2);
  // L'étape de vérification reste en attente, sans tentative.
  const [verify] = await db.query(`SELECT state, attempts FROM editorial_tasks WHERE kind = 'verify'`);
  assert.equal(verify.state, "pending");
  assert.equal(Number(verify.attempts), 0);
});

test("relance de génération interdite : une tâche déjà tentée arrête l'essai", async () => {
  const { db } = await createTestDb();
  const deps = depsWith(db);
  await trialInit(deps, SETUP);
  await trialStep(deps); // tri soumis et appliqué ; la rédaction est créée
  // Simule un résultat en erreur temporaire : la tâche revient en attente avec une tentative comptée.
  const updated = await db.query(`UPDATE editorial_tasks SET attempts = 1 WHERE kind = 'draft' AND state = 'pending' RETURNING id`);
  assert.equal(updated.length, 1);
  const status = await trialStep(deps);
  assert.equal(status.phase, "arretee");
  assert.match(status.stoppedReason ?? "", /tentative de génération interdite/);
  assert.equal(status.batchesCreated, 1, "aucun lot de relance n'a été créé");
});

test("tâche hors périmètre : l'essai s'arrête sans la soumettre", async () => {
  const { db } = await createTestDb();
  const deps = depsWith(db);
  await trialInit(deps, SETUP);
  await db.query(
    `INSERT INTO editorial_tasks (kind, idempotency_key, payload, max_attempts) VALUES ('triage', 'triage:intrus', '{"maxOutputTokens": 100, "input": {"candidates": []}}', 5)`,
  );
  const status = await trialStep(deps);
  assert.equal(status.phase, "arretee");
  assert.match(status.stoppedReason ?? "", /hors périmètre/);
  assert.equal(status.batchesCreated, 0);
});
