import { createHash } from "node:crypto";
import { normalizeUrl } from "../urls.ts";
import { budgetSummary, estimateMicros } from "./budget.ts";
import { loadConfig, logRevision, type Prices } from "./config.ts";
import { pollBatches, runLocalTasks, submitPending, type Deps } from "./pipeline.ts";
import type { ProviderRequest } from "./providers/types.ts";
import { PROVIDER_KINDS, enqueue, toTask } from "./tasks.ts";
import { utcPeriod } from "./time.ts";
import type { Query, Row } from "./types.ts";

// Essai borné de l'intégration réelle (docs/protocole-premier-essai-claude.md, C008).
//
// Garde-fous, en plus de ceux du pipeline :
// - base DÉDIÉE exigée : aucune tâche, document, lot ni utilisateur humain préexistant ;
// - un seul sujet, issu d'un document synthétique clairement identifié ;
// - au plus `maxBatches` créations de lot (3 par défaut), une requête par lot ;
// - AUCUNE relance de génération : une tâche fournisseur déjà tentée arrête l'essai ;
// - tout état incertain ou en examen arrête l'essai et conserve l'état pour l'examen
//   humain ; l'essai ne crée jamais un nouveau lot pour contourner un état incertain ;
// - l'état de l'essai est persistant (table editorial_trial) : une reprise relit les
//   lots existants et ne soumet jamais deux fois la même étape.
//
// Ce module n'active aucune planification : la politique écrite dans la base d'essai
// n'a aucun créneau, donc `plan()` n'y programmerait aucun récapitulatif.

export const TRIAL_MAX_BATCHES = 3;
export const TRIAL_SLOT_KEY = "essai-borne";

/**
 * Document synthétique par défaut, clairement identifié comme tel (protocole §Préparation).
 * Il valide le TRANSPORT, jamais la qualité éditoriale : la recette humaine D4 reste due.
 */
export const SYNTHETIC_TRIAL_DOCUMENT = {
  title: "Un robot de tri des déchets électroniques présenté à Bruxelles",
  url: "https://essai-synthetique.invalid/articles/robot-tri-bruxelles",
  text: [
    "Un robot de tri des déchets électroniques, présenté à Bruxelles par un institut fictif, identifie 40 catégories de composants et en trie 1200 par heure, selon ce document synthétique d'essai sans source réelle.",
    "L'annonce précise que les résultats de ce document synthétique n'ont pas encore été publiés dans une revue scientifique à comité de lecture et ne proviennent d'aucune institution réelle.",
  ].join(" "),
};

export interface TrialSetup {
  config: {
    provider: "test" | "claude";
    model: string | null;
    prices: Prices;
    currency: string;
    budgetCapMicros: bigint;
    timezone: string;
  };
  document: { title: string; url: string; text: string; publishedAt?: Date };
  maxBatches?: number;
  actorLabel: string;
}

export class TrialError extends Error {}

async function one<T extends Row>(q: Query, sql: string, params?: unknown[]): Promise<T | null> {
  const [row] = await q<T>(sql, params);
  return row ?? null;
}

export async function loadTrial(q: Query) {
  return one(q, `SELECT * FROM editorial_trial WHERE id = 1`);
}

/** La base est dédiée : rien d'éditorial ni d'humain ne doit y préexister. */
async function assertDedicatedDb(q: Query) {
  const [counts] = await q<{ tasks: number; batches: number; docs: number; humans: number; posts: number }>(
    `SELECT (SELECT count(*) FROM editorial_tasks)::int AS tasks,
            (SELECT count(*) FROM editorial_batches)::int AS batches,
            (SELECT count(*) FROM editorial_documents)::int AS docs,
            (SELECT count(*) FROM users WHERE role <> 'agent')::int AS humans,
            (SELECT count(*) FROM posts)::int AS posts`,
  );
  const problems: string[] = [];
  if (Number(counts.tasks) > 0) problems.push(`${counts.tasks} tâche(s)`);
  if (Number(counts.batches) > 0) problems.push(`${counts.batches} lot(s)`);
  if (Number(counts.docs) > 0) problems.push(`${counts.docs} document(s)`);
  if (Number(counts.humans) > 0) problems.push(`${counts.humans} compte(s) humain(s)`);
  if (Number(counts.posts) > 0) problems.push(`${counts.posts} publication(s)`);
  if (problems.length > 0) {
    throw new TrialError(`Base non dédiée : ${problems.join(", ")} déjà présent(s). L'essai exige une base vierge (protocole §Préparation).`);
  }
}

/**
 * Prépare l'essai sur une base dédiée : configuration explicite, document synthétique,
 * récapitulatif unique et tâche de préparation. Aucun appel fournisseur ici.
 */
export async function trialInit(deps: Deps, setup: TrialSetup): Promise<{ recapId: string }> {
  const { db, now } = deps;
  const existing = await loadTrial(db.query);
  if (existing) throw new TrialError("Un essai existe déjà dans cette base : reprendre avec « etat », « etape » ou « rapport ».");
  await assertDedicatedDb(db.query);
  const at = now();
  return db.transaction(async (q) => {
    // Politique de fixture SANS créneau : l'assemblage connaît son plafond, mais aucun
    // récapitulatif ne peut être planifié automatiquement pendant l'essai (protocole §Préparation).
    const policy = { slots: [], maxItems: 3, prepLeadHours: 1 };
    await q(
      `UPDATE editorial_config SET paused = false, mode = 'draft', provider = $1, model = $2, prices = $3, currency = $4,
         budget_cap_micros = $5, timezone = $6, policy = $7, estimation_blocked = false, version = version + 1, updated_at = now()
       WHERE id = 1`,
      [
        setup.config.provider,
        setup.config.model,
        JSON.stringify(setup.config.prices),
        setup.config.currency,
        setup.config.budgetCapMicros.toString(),
        setup.config.timezone,
        JSON.stringify(policy),
      ],
    );
    await logRevision(q, {
      entity: "config",
      entityId: "1",
      after: { ...setup.config, budgetCapMicros: setup.config.budgetCapMicros.toString(), policy },
      reason: "Configuration de l'essai borné (base dédiée, politique de fixture sans créneau)",
      actorLabel: setup.actorLabel,
    });

    const [source] = await q<{ id: string }>(
      `INSERT INTO editorial_sources (name, feed_url, source_type, priority, fetch_articles, active, authorization_reference)
       VALUES ('Source synthétique d''essai', $1, 'primary', 1, false, false, 'Document synthétique de test : aucune collecte réseau, aucune source réelle')
       RETURNING id`,
      [`${setup.document.url}#flux-essai`],
    );
    const publishedAt = setup.document.publishedAt ?? at;
    const doc = setup.document;
    await q(
      `INSERT INTO editorial_documents (source_id, version, url, normalized_url, title, summary, published_at, discovered_at, content_hash, status, extracted_text)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, 'extracted', $9)`,
      [
        source.id,
        doc.url,
        normalizeUrl(doc.url) ?? doc.url,
        doc.title,
        doc.text.slice(0, 4000),
        publishedAt.toISOString(),
        at.toISOString(),
        createHash("sha256").update(doc.text).digest("hex"),
        doc.text,
      ],
    );
    const [recap] = await q<{ id: string }>(
      `INSERT INTO editorial_recaps (slot_key, slot_at, state) VALUES ($1, $2, 'planned') RETURNING id`,
      [TRIAL_SLOT_KEY, new Date(at.getTime() + 3600_000).toISOString()],
    );
    await enqueue(q, { kind: "prepare_recap", key: `prepare:${TRIAL_SLOT_KEY}`, payload: { recapId: recap.id }, maxAttempts: 3 });
    await q(`INSERT INTO editorial_trial (id, recap_id, max_batches) VALUES (1, $1, $2)`, [recap.id, setup.maxBatches ?? TRIAL_MAX_BATCHES]);
    await logRevision(q, {
      entity: "trial",
      entityId: recap.id,
      after: { maxBatches: setup.maxBatches ?? TRIAL_MAX_BATCHES, document: { title: doc.title, url: doc.url, chars: doc.text.length } },
      reason: "Essai borné préparé : un sujet synthétique, trois étapes au plus, aucune soumission encore",
      actorLabel: setup.actorLabel,
    });
    return { recapId: recap.id };
  });
}

/** Clés d'idempotence autorisées : le tri du récapitulatif d'essai, puis la rédaction et la vérification de SON sujet. */
async function allowedKeys(q: Query, recapId: string): Promise<{ keys: Set<string>; subjects: Row[] }> {
  const subjects = await q(`SELECT * FROM editorial_subjects WHERE recap_id = $1 ORDER BY created_at`, [recapId]);
  const keys = new Set<string>([`triage:${recapId}`]);
  for (const s of subjects) {
    keys.add(`draft:${recapId}:${s.id}`);
    keys.add(`verify:${recapId}:${s.id}`);
  }
  return { keys, subjects };
}

/** Vérifie les limites de l'essai. Retourne le motif d'arrêt, ou null si l'essai peut continuer. */
async function checkGuards(q: Query, trial: Row): Promise<string | null> {
  const recapId = trial.recap_id as string;
  const batches = await q(`SELECT id, state, task_ids FROM editorial_batches ORDER BY created_at`);
  if (batches.some((b) => b.state === "uncertain")) {
    return "lot en état incertain : examen humain requis, aucune nouvelle soumission (protocole §Limites)";
  }
  if (batches.some((b) => b.state === "submitting")) {
    return "soumission interrompue avant confirmation : examen humain requis, l'essai ne recrée pas de lot";
  }
  if (batches.some((b) => ((b.task_ids as string[]) ?? []).length > 1)) {
    return "un lot contient plus d'une requête : hors protocole, examen requis";
  }
  const tasks = await q(`SELECT * FROM editorial_tasks WHERE kind = ANY($1::text[]) ORDER BY created_at`, [PROVIDER_KINDS]);
  const inReview = tasks.filter((t) => t.state === "review_required" || t.state === "uncertain");
  if (inReview.length > 0) {
    return `étape(s) en examen (${inReview.map((t) => t.kind).join(", ")}) : essai arrêté, état conservé`;
  }
  const { keys, subjects } = await allowedKeys(q, recapId);
  if (subjects.length > 1) return `plus d'un sujet sélectionné (${subjects.length}) : hors protocole (un seul sujet)`;
  for (const t of tasks) {
    if (!keys.has(t.idempotency_key as string)) return `tâche hors périmètre de l'essai : ${t.idempotency_key}`;
  }
  const pending = tasks.filter((t) => t.state === "pending");
  for (const t of pending) {
    if (Number(t.attempts) >= 1) {
      return `nouvelle tentative de génération interdite par le protocole (${t.kind}, tentative ${t.attempts} déjà faite) : essai arrêté`;
    }
  }
  if (pending.length > 0 && batches.length >= Number(trial.max_batches)) {
    return `nombre maximal de créations de lot atteint (${trial.max_batches}) : aucune nouvelle soumission`;
  }
  return null;
}

export interface TrialStatus {
  phase: "preparation" | "tri" | "redaction" | "verification" | "terminee" | "vide" | "arretee";
  stoppedReason: string | null;
  recapState: string;
  batchesCreated: number;
  maxBatches: number;
  requestsSubmitted: number;
  steps: { kind: string; state: string; attempts: number; error: unknown }[];
  budget: { capMicros: bigint | null; settledMicros: bigint; reservedMicros: bigint; currency: string | null; uncertainCount: number };
  subject: { id: string; status: string; blockReason: string | null } | null;
  items: number;
}

export async function trialStatus(deps: Deps): Promise<TrialStatus> {
  const q = deps.db.query;
  const trial = await loadTrial(q);
  if (!trial) throw new TrialError("Aucun essai dans cette base : lancer d'abord la préparation.");
  const config = await loadConfig(q);
  const recap = await one(q, `SELECT * FROM editorial_recaps WHERE id = $1`, [trial.recap_id]);
  const batches = await q(`SELECT state, task_ids FROM editorial_batches ORDER BY created_at`);
  const tasks = await q(`SELECT kind, state, attempts, error FROM editorial_tasks ORDER BY created_at`);
  const subject = await one(q, `SELECT id, status, block_reason FROM editorial_subjects WHERE recap_id = $1`, [trial.recap_id]);
  const [{ n: items }] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM editorial_recap_items WHERE recap_id = $1`, [trial.recap_id]);
  const budget = await budgetSummary(q, utcPeriod(deps.now()), config.budgetCapMicros, config.currency);

  const providerTasks = tasks.filter((t) => (PROVIDER_KINDS as readonly string[]).includes(t.kind as string));
  const stateOf = (kind: string) => providerTasks.find((t) => t.kind === kind)?.state ?? null;
  let phase: TrialStatus["phase"];
  if (trial.stopped_reason) phase = "arretee";
  else if (recap?.state === "ready") phase = "terminee";
  else if (recap?.state === "empty") phase = "vide";
  else if (!stateOf("triage")) phase = "preparation";
  else if (stateOf("triage") !== "done") phase = "tri";
  else if (stateOf("draft") !== "done") phase = "redaction";
  else phase = "verification";

  return {
    phase,
    stoppedReason: (trial.stopped_reason as string) ?? null,
    recapState: (recap?.state as string) ?? "absent",
    batchesCreated: batches.length,
    maxBatches: Number(trial.max_batches),
    requestsSubmitted: batches.reduce((n, b) => n + ((b.task_ids as string[]) ?? []).length, 0),
    steps: tasks.map((t) => ({ kind: t.kind as string, state: t.state as string, attempts: Number(t.attempts), error: t.error ?? null })),
    budget: {
      capMicros: budget.capMicros,
      settledMicros: budget.settledMicros,
      reservedMicros: budget.reservedMicros,
      currency: budget.currency,
      uncertainCount: budget.uncertainCount,
    },
    subject: subject ? { id: subject.id as string, status: subject.status as string, blockReason: (subject.block_reason as string) ?? null } : null,
    items: Number(items),
  };
}

async function stopTrial(q: Query, reason: string) {
  await q(`UPDATE editorial_trial SET stopped_reason = COALESCE(stopped_reason, $1), updated_at = now() WHERE id = 1`, [reason]);
}

/**
 * Un pas borné de l'essai : préparation locale (gratuite), garde-fous, au plus UNE
 * soumission d'un lot d'UNE requête, puis une lecture de suivi. À appeler en boucle
 * bornée par l'appelant ; chaque étape est rapprochée avant que la suivante ne soit soumise
 * (la tâche suivante n'existe qu'après l'application du résultat précédent).
 */
export async function trialStep(deps: Deps): Promise<TrialStatus> {
  const q = deps.db.query;
  const trial = await loadTrial(q);
  if (!trial) throw new TrialError("Aucun essai dans cette base : lancer d'abord la préparation.");
  if (trial.stopped_reason || trial.finished_at) return trialStatus(deps);

  // Étapes locales : préparation du récapitulatif (aucun réseau, aucun coût).
  await runLocalTasks(deps, 10);

  const guard = await checkGuards(q, trial);
  if (guard) {
    await stopTrial(q, guard);
    return trialStatus(deps);
  }

  const pending = await q(
    `SELECT * FROM editorial_tasks WHERE kind = ANY($1::text[]) AND state = 'pending' AND next_attempt_at <= now()`,
    [PROVIDER_KINDS],
  );
  const open = await q(`SELECT id FROM editorial_batches WHERE state IN ('submitting', 'submitted')`);
  if (pending.length === 1 && open.length === 0) {
    const res = await submitPending(deps);
    if (res.submitted === 0) {
      await stopTrial(q, `soumission refusée : ${res.reason ?? "motif inconnu"}`);
      return trialStatus(deps);
    }
    if (res.submitted !== 1) {
      await stopTrial(q, `lot de ${res.submitted} requêtes soumis : hors protocole (une requête par étape)`);
      return trialStatus(deps);
    }
  } else if (pending.length > 1) {
    await stopTrial(q, `${pending.length} tâches fournisseur en attente simultanément : hors protocole (une à la fois)`);
    return trialStatus(deps);
  }

  // Suivi : une lecture par pas ; l'appelant répète de façon bornée.
  try {
    await pollBatches(deps);
  } catch (error) {
    // Erreur de suivi inattendue : rien n'est appliqué, l'état reste repris au prochain pas.
    await q(`UPDATE editorial_trial SET updated_at = now() WHERE id = 1`);
    throw error;
  }
  await runLocalTasks(deps, 10);

  // Un résultat appliqué peut avoir mis une étape en examen ou un lot en incertain : consigner l'arrêt.
  const after = await checkGuards(q, trial);
  if (after) await stopTrial(q, after);

  const status = await trialStatus(deps);
  if ((status.phase === "terminee" || status.phase === "vide") && !trial.finished_at) {
    await deps.db.transaction(async (tx) => {
      await tx(`UPDATE editorial_trial SET finished_at = now(), updated_at = now() WHERE id = 1 AND finished_at IS NULL`);
      // Pause après la fin de l'essai (protocole §Limites) : aucune soumission ultérieure.
      await tx(`UPDATE editorial_config SET paused = true, version = version + 1, updated_at = now() WHERE id = 1`);
      await logRevision(tx, { entity: "config", entityId: "1", reason: "Essai borné terminé : agent remis en pause", actorLabel: "essai" });
    });
  }
  return status;
}

export interface TrialPreview {
  provider: string;
  simulated: boolean;
  model: string | null;
  steps: string[];
  maxBatches: number;
  capMicros: bigint | null;
  prices: Prices | null;
  currency: string | null;
  pending: { kind: string; estimateMicros: bigint; boundMicros: bigint } | null;
  /** Pire cas si chaque étape coûte la même borne que la requête en attente. */
  worstCaseTotalMicros: bigint | null;
  networkCalls: string[];
}

/**
 * Aperçu SANS génération : ce qui serait soumis, à quel prix borné, sous quelles limites.
 * Avec le fournisseur Claude, le calcul de borne fait des appels réseau GRATUITS
 * (liste du modèle, comptage de jetons) : ils sont nommés dans `networkCalls`.
 */
export async function trialPreview(deps: Deps): Promise<TrialPreview> {
  const q = deps.db.query;
  const trial = await loadTrial(q);
  if (!trial) throw new TrialError("Aucun essai dans cette base : lancer d'abord la préparation.");
  await runLocalTasks(deps, 10);
  const config = await loadConfig(q);
  const provider = deps.provider;
  if (!provider) throw new TrialError("Aucun fournisseur construit : configuration ou clé absente.");

  const pending = (
    await q(`SELECT * FROM editorial_tasks WHERE kind = ANY($1::text[]) AND state = 'pending' ORDER BY created_at LIMIT 1`, [PROVIDER_KINDS])
  ).map(toTask);
  let cost: { kind: string; estimateMicros: bigint; boundMicros: bigint } | null = null;
  const networkCalls: string[] = [];
  if (pending.length === 1 && config.prices) {
    const t = pending[0];
    const request = { taskId: t.id, kind: t.kind, input: t.payload.input, maxOutputTokens: Number(t.payload.maxOutputTokens) } as ProviderRequest;
    if (provider.costPerRequest) {
      networkCalls.push("GET /v1/models/{modele} (limite d'entrée)", "POST /v1/messages/count_tokens (comptage, estimation)");
      const [c] = await provider.costPerRequest([request], config.prices);
      cost = { kind: t.kind, ...c };
    } else {
      const m = estimateMicros([{ inputChars: JSON.stringify(request.input).length, maxOutputTokens: request.maxOutputTokens }], config.prices);
      cost = { kind: t.kind, estimateMicros: m, boundMicros: m };
    }
  }
  return {
    provider: provider.id,
    simulated: provider.simulated,
    model: provider.model ?? config.model,
    steps: [...PROVIDER_KINDS],
    maxBatches: Number(trial.max_batches),
    capMicros: config.budgetCapMicros,
    prices: config.prices,
    currency: config.currency,
    pending: cost,
    worstCaseTotalMicros: cost ? cost.boundMicros * BigInt(Number(trial.max_batches)) : null,
    networkCalls,
  };
}

/**
 * Rapport d'essai exportable (protocole §Preuves) : états, réservations, coûts et sorties
 * à relire. SANS clé API et SANS identifiant externe : les identifiants de lots du
 * fournisseur restent dans la base et la console privées.
 */
export async function trialReport(deps: Deps): Promise<Record<string, unknown>> {
  const q = deps.db.query;
  const trial = await loadTrial(q);
  if (!trial) throw new TrialError("Aucun essai dans cette base : lancer d'abord la préparation.");
  const config = await loadConfig(q);
  const status = await trialStatus(deps);
  const docs = await q(`SELECT title, url, published_at, length(extracted_text) AS chars FROM editorial_documents ORDER BY discovered_at`);
  const tasks = await q(`SELECT kind, idempotency_key, state, attempts, max_attempts, error, created_at, updated_at FROM editorial_tasks ORDER BY created_at`);
  const batches = await q(
    `SELECT id, state, model, currency, prices, task_ids, estimate_micros, usage, reconcile_attempts, reconcile_error, error,
            created_at, submitted_at, ended_at, reconciled_at
     FROM editorial_batches ORDER BY created_at`,
  );
  const spend = await q(`SELECT batch_id, period, currency, reserved_micros, actual_micros, state, created_at, settled_at FROM editorial_spend ORDER BY created_at`);
  const subjects = await q(`SELECT id, status, block_reason, triage_score, scientific_status, draft FROM editorial_subjects ORDER BY created_at`);
  const items = await q(`SELECT position, title, summary, scientific_status, sources, claims FROM editorial_recap_items ORDER BY position`);
  const revisions = await q(`SELECT entity, reason, actor_label, created_at FROM editorial_revisions ORDER BY created_at`);
  return {
    genereLe: deps.now().toISOString(),
    protocole: "docs/protocole-premier-essai-claude.md",
    configuration: {
      provider: config.provider,
      model: config.model,
      prices: config.prices,
      currency: config.currency,
      plafondMicros: config.budgetCapMicros?.toString() ?? null,
      mode: config.mode,
      paused: config.paused,
    },
    essai: {
      phase: status.phase,
      motifArret: status.stoppedReason,
      lotsCrees: status.batchesCreated,
      lotsMaximum: status.maxBatches,
      requetesSoumises: status.requestsSubmitted,
      commenceLe: trial.created_at,
      termineLe: trial.finished_at ?? null,
    },
    budget: {
      plafondMicros: status.budget.capMicros?.toString() ?? null,
      rapprocheMicros: status.budget.settledMicros.toString(),
      reserveMicros: status.budget.reservedMicros.toString(),
      incertains: status.budget.uncertainCount,
      devise: status.budget.currency,
    },
    documents: docs,
    taches: tasks,
    lots: batches.map((b) => ({ ...b, nbRequetes: ((b.task_ids as string[]) ?? []).length, task_ids: undefined })),
    depenses: spend,
    sujets: subjects,
    elementsAssembles: items,
    journal: revisions,
  };
}
