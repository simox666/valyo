import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizeUrl } from "../urls.ts";
import { budgetSummary, costMicros, estimateMicros, markUncertain, releaseConfirmedUnsent, reserve, settle } from "./budget.ts";
import { FRESHNESS_HOURS, SCIENTIFIC_FRESHNESS_HOURS, loadConfig, logRevision, readiness, type EditorialConfig, type Prices } from "./config.ts";
import { extractPage, hasSuspiciousInstructions, parseFeed, type FeedItem } from "./extract.ts";
import { FetchError, type Transport } from "./fetch.ts";
import { compareForGrouping, type GroupingComparator, type GroupingItem } from "./grouping.ts";
import { ProviderNotSentError, type BatchReadout, type DraftDocument, type EditorialProvider, type ProviderRequest, type ProviderResult } from "./providers/types.ts";
import { LOCAL_KINDS, LeaseLostError, PROVIDER_KINDS, claim, commitTask, enqueue, fail, toTask, withLease, type Task, type TaskError } from "./tasks.ts";
import { slotsBetween, utcPeriod } from "./time.ts";
import type { Db, Query, Row } from "./types.ts";
import { checkVerification, statementsFor, validateDevelopment, validateDraft, type ValidatedDraft } from "./validate.ts";

// Orchestration de l'agent éditorial, lot 2A (contrat §2 à §5, revue lot 2A).
//
// Règle d'écriture (B001, B004) : une étape locale fait d'abord son travail
// réseau, sans transaction ; puis elle applique TOUTES ses écritures métier,
// crée ses tâches suivantes et se clôture dans une seule transaction protégée
// par le jeton de bail (commitTask). Une interruption ne laisse donc jamais
// d'écriture partielle, et un worker dont le bail est perdu n'écrit rien.
//
// Étapes fournisseur : tri, rédaction, puis vérification indépendante de
// fidélité (B003), soumises par lots et rapprochées. Le rapprochement des coûts
// est indépendant de l'application des résultats et reprenable (B002).
// Aucune publication publique dans ce lot.

export interface Deps {
  db: Db;
  transport: Transport;
  provider: EditorialProvider | null;
  now: () => Date;
  owner: string;
  /** Comparaison de contenus pour la règle 3 de regroupement ; lexicale par défaut (grouping.ts). */
  compare?: GroupingComparator;
  /** Tests uniquement : point d'injection de panne entre deux écritures d'une même transaction. */
  inject?: (point: string) => void;
}

const MAX_FEED_ITEMS = 100;
const MAX_DOC_CHARS_FOR_DRAFT = 8_000;
const MAX_DOCS_PER_DRAFT = 4;
// La réflexion (toujours active sur Opus 5.5) compte dans max_tokens : marge pour réfléchir puis répondre.
const TRIAGE_MAX_OUTPUT_TOKENS = 8_000;
const DRAFT_MAX_OUTPUT_TOKENS = 8_000;
const VERIFY_MAX_OUTPUT_TOKENS = 8_000;
const STALE_SUBMISSION_MINUTES = 10;
const MISSED_LOOKBACK_DAYS = 14;

class TaskFailure extends Error {
  error: TaskError;
  constructor(error: TaskError) {
    super(error.message);
    this.error = error;
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;
const freshnessLimit = (sourceType: string) => (sourceType === "scientific" ? SCIENTIFIC_FRESHNESS_HOURS : FRESHNESS_HOURS);

// ───────────────────────────── Planification ─────────────────────────────

export async function plan(deps: Deps) {
  const { db, now } = deps;
  const at = now();
  const config = await loadConfig(db.query);
  const report = { collectEnqueued: 0, extractRepaired: 0, recapsPlanned: 0, recapsMissed: 0, recapsOverdue: 0 };

  // Collecte : une tâche par source active et par heure UTC (idempotente).
  const sources = await db.query<{ id: string }>(`SELECT id FROM editorial_sources WHERE active`);
  const bucket = at.toISOString().slice(0, 13);
  for (const s of sources) {
    const r = await enqueue(db.query, { kind: "collect_source", key: `collect:${s.id}:${bucket}`, payload: { sourceId: s.id }, maxAttempts: 3 });
    if (r.created) report.collectEnqueued++;
  }

  // Filet de sécurité (B001) : toute tâche d'extraction manquante est reconstruite depuis les documents persistés.
  const orphans = await db.query<{ id: string }>(
    `SELECT d.id FROM editorial_documents d JOIN editorial_sources s ON s.id = d.source_id
     WHERE d.status = 'collected' AND d.is_current AND s.active AND s.fetch_articles
       AND NOT EXISTS (SELECT 1 FROM editorial_tasks t WHERE t.idempotency_key = 'extract:' || d.id)`,
  );
  for (const d of orphans) {
    await enqueue(db.query, { kind: "extract_document", key: `extract:${d.id}`, payload: { documentId: d.id }, maxAttempts: 3 });
    report.extractRepaired++;
  }

  const ready = readiness(config);
  if (!ready.recap.enabled || !config.policy || !config.timezone) return report;

  // Échéance dépassée : aucun résultat incomplet n'est publié pour tenir l'horaire.
  const overdue = await db.query(
    `UPDATE editorial_recaps SET state = 'review_required', updated_at = now(),
       notes = notes || '{"motif": "echeance_depassee"}'::jsonb
     WHERE state = 'planned' AND slot_at < $1 RETURNING id`,
    [at.toISOString()],
  );
  report.recapsOverdue = overdue.length;

  // Créneaux : la politique garantit qu'au plus un créneau est dans la fenêtre de préparation
  // (config.policyProblems). Les créneaux passés sans récapitulatif sont consignés « manqués ».
  const since = new Date(Math.max(at.getTime() - MISSED_LOOKBACK_DAYS * 86400000, new Date(config.updatedAt).getTime()));
  const horizon = new Date(at.getTime() + config.policy.prepLeadHours * 3600000);
  for (const slot of slotsBetween(config.policy.slots, config.timezone, since, horizon)) {
    if (slot.at.getTime() > at.getTime()) {
      await db.transaction(async (q) => {
        const inserted = await q<{ id: string }>(
          `INSERT INTO editorial_recaps (slot_key, slot_at, state) VALUES ($1, $2, 'planned') ON CONFLICT (slot_key) DO NOTHING RETURNING id`,
          [slot.key, slot.at.toISOString()],
        );
        const [recap] = inserted.length ? inserted : await q<{ id: string }>(`SELECT id FROM editorial_recaps WHERE slot_key = $1`, [slot.key]);
        const r = await enqueue(q, { kind: "prepare_recap", key: `prepare:${slot.key}`, payload: { recapId: recap.id } });
        if (r.created) report.recapsPlanned++;
      });
    } else {
      const missed = await db.query(
        `INSERT INTO editorial_recaps (slot_key, slot_at, state, notes) VALUES ($1, $2, 'missed', '{"motif": "creneau_manque"}'::jsonb)
         ON CONFLICT (slot_key) DO NOTHING RETURNING id`,
        [slot.key, slot.at.toISOString()],
      );
      report.recapsMissed += missed.length;
    }
  }
  return report;
}

// ───────────────────────────── Étapes locales ─────────────────────────────

async function collectSource(deps: Deps, task: Task) {
  const { db, transport, now } = deps;
  const [source] = await db.query(`SELECT * FROM editorial_sources WHERE id = $1`, [task.payload.sourceId]);
  if (!source || !source.active) return commitTask(db, task, async () => ({ skipped: "source inactive" }));

  // 1. Réseau, hors transaction.
  let items: FeedItem[];
  try {
    items = parseFeed((await transport.get(source.feed_url as string, "feed")).body).slice(0, MAX_FEED_ITEMS);
  } catch (error) {
    const fe = error instanceof FetchError ? error : null;
    const message = fe ? `${fe.code} : ${fe.message}` : String(error);
    await withLease(db, task, (q) => q(`UPDATE editorial_sources SET last_error = $2, last_error_at = now() WHERE id = $1`, [source.id, message]));
    throw new TaskFailure(
      fe ? { code: fe.code, message: fe.message, permanent: fe.permanent, reason: "source_inaccessible" } : { code: "bad_feed", message, permanent: true },
    );
  }

  // 2. Toutes les écritures, tâches d'extraction comprises, dans une transaction protégée par le bail.
  return commitTask(db, task, async (q) => {
    let created = 0;
    let skippedNoLink = 0;
    for (const item of items) {
      const normalized = item.link ? normalizeUrl(item.link) : null;
      if (!normalized) {
        skippedNoLink++;
        continue;
      }
      const hash = sha256(`${item.title}\n${item.summary}\n${item.publishedAt?.toISOString() ?? ""}`);
      const stale = item.publishedAt !== null && hoursBetween(item.publishedAt, now()) > freshnessLimit(source.source_type as string);
      const [current] = await q(
        `SELECT id, content_hash, version FROM editorial_documents WHERE source_id = $1 AND normalized_url = $2 AND is_current FOR UPDATE`,
        [source.id, normalized],
      );
      if (current && current.content_hash === hash) continue;
      if (current) await q(`UPDATE editorial_documents SET is_current = false WHERE id = $1`, [current.id]);
      const [doc] = await q<{ id: string }>(
        `INSERT INTO editorial_documents (source_id, version, url, normalized_url, title, summary, published_at, content_hash, status, discovered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          source.id,
          current ? Number(current.version) + 1 : 1,
          item.link,
          normalized,
          item.title.slice(0, 500) || item.link,
          item.summary.slice(0, 4000),
          item.publishedAt?.toISOString() ?? null,
          hash,
          stale ? "stale" : "collected",
          now().toISOString(),
        ],
      );
      created++;
      deps.inject?.("collect:apres-document");
      if (stale) continue;
      if (source.fetch_articles) {
        await enqueue(q, { kind: "extract_document", key: `extract:${doc.id}`, payload: { documentId: doc.id }, maxAttempts: 3 });
      } else {
        await q(`UPDATE editorial_documents SET status = 'extracted', extracted_text = summary WHERE id = $1`, [doc.id]);
      }
    }
    await q(`UPDATE editorial_sources SET last_collected_at = $2, last_error = NULL WHERE id = $1`, [source.id, now().toISOString()]);
    return { items: items.length, created, skippedNoLink };
  });
}

async function extractDocument(deps: Deps, task: Task) {
  const { db, transport, now } = deps;
  const [doc] = await db.query(
    `SELECT d.*, s.active, s.source_type FROM editorial_documents d JOIN editorial_sources s ON s.id = d.source_id WHERE d.id = $1`,
    [task.payload.documentId],
  );
  if (!doc || !doc.active || !doc.is_current) return commitTask(db, task, async () => ({ skipped: "document remplacé ou source inactive" }));

  let result;
  try {
    result = await transport.get(doc.url as string, "html");
  } catch (error) {
    const fe = error instanceof FetchError ? error : new FetchError("network", String(error), false);
    if (fe.permanent) {
      return commitTask(db, task, async (q) => {
        await q(`UPDATE editorial_documents SET status = 'error', error_code = 'source_inaccessible' WHERE id = $1`, [doc.id]);
        return { inaccessible: fe.code };
      });
    }
    throw new TaskFailure({ code: fe.code, message: fe.message, permanent: false });
  }
  const page = extractPage(result.body);
  const canonical = page.canonicalUrl ? safeAbsolute(page.canonicalUrl, result.finalUrl) : null;
  const publishedAt = doc.published_at ? new Date(doc.published_at as string) : page.publishedAt;
  const stale = publishedAt !== null && hoursBetween(publishedAt, now()) > freshnessLimit(doc.source_type as string);
  return commitTask(db, task, async (q) => {
    await q(
      `UPDATE editorial_documents SET final_url = $2, canonical_url = $3, extracted_text = $4, published_at = $5, status = $6 WHERE id = $1`,
      [doc.id, result.finalUrl, canonical, page.text || doc.summary, publishedAt?.toISOString() ?? null, stale ? "stale" : "extracted"],
    );
    return { chars: page.text.length, truncated: page.truncated };
  });
}

function safeAbsolute(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function documentUrls(doc: Row): string[] {
  return [doc.url, doc.final_url, doc.canonical_url]
    .filter((u): u is string => typeof u === "string")
    .map((u) => normalizeUrl(u))
    .filter((u): u is string => Boolean(u));
}

/** Publication humaine publiée citant déjà l'une de ces adresses (R07). Le texte du membre n'est jamais modifié. */
export async function memberDuplicate(q: Query, normalizedUrls: string[]): Promise<string | null> {
  if (normalizedUrls.length === 0) return null;
  const [row] = await q<{ id: string }>(
    `SELECT p.id FROM post_sources ps JOIN posts p ON p.id = ps.post_id JOIN users u ON u.id = p.author_id
     WHERE ps.normalized_url = ANY($1::text[]) AND p.status = 'published' AND u.role <> 'agent' LIMIT 1`,
    [normalizedUrls],
  );
  return row?.id ?? null;
}

export async function subjectDocuments(q: Query, subjectId: string) {
  return q(
    `SELECT d.*, s.source_type, s.priority FROM editorial_documents d JOIN editorial_sources s ON s.id = d.source_id
     WHERE d.subject_id = $1 AND d.is_current ORDER BY s.priority, d.published_at DESC NULLS LAST`,
    [subjectId],
  );
}

/**
 * Préparation d'un récapitulatif, sans réseau : regroupement, contrôles déterministes,
 * affectation des sujets et tâche de tri dans UNE transaction protégée par le bail (B001),
 * sérialisée entre workers par un verrou consultatif (revue C005, point 2).
 */
async function prepareRecap(deps: Deps, task: Task) {
  return commitTask(deps.db, task, async (q) => {
    await q(`SELECT pg_advisory_xact_lock(hashtext('editorial:prepare'))`);
    const [recap] = await q(`SELECT * FROM editorial_recaps WHERE id = $1 FOR UPDATE`, [task.payload.recapId]);
    if (!recap || recap.state !== "planned") return { skipped: `récapitulatif ${recap?.state ?? "absent"}` };
    const slotAt = new Date(recap.slot_at as string);

    // Un créneau antérieur encore en préparation passe en premier : aucun chevauchement de sujets.
    const [earlier] = await q(`SELECT id FROM editorial_recaps WHERE state = 'planned' AND slot_at < $1 LIMIT 1`, [recap.slot_at]);
    if (earlier) throw new TaskFailure({ code: "creneau_anterieur", message: "Un créneau antérieur est encore en préparation", permanent: false });

    // 1. Regroupement (règles 1 et 2 de decisions.md §3.3 : même URL normalisée, canonique ou finale).
    const docs = await q(
      `SELECT d.*, s.priority, s.theme_ids FROM editorial_documents d JOIN editorial_sources s ON s.id = d.source_id
       WHERE d.status = 'extracted' AND d.is_current ORDER BY s.priority, d.discovered_at`,
    );
    for (const doc of docs) {
      const groupKey =
        (doc.canonical_url && normalizeUrl(doc.canonical_url as string)) ||
        (doc.final_url && normalizeUrl(doc.final_url as string)) ||
        (doc.normalized_url as string);
      const inserted = await q<{ id: string }>(
        `INSERT INTO editorial_subjects (group_key, title, primary_document_id, theme_ids) VALUES ($1, $2, $3, $4)
         ON CONFLICT (group_key) DO NOTHING RETURNING id`,
        [groupKey, doc.title, doc.id, doc.theme_ids ?? []],
      );
      const subjectId = inserted[0]?.id ?? (await q<{ id: string }>(`SELECT id FROM editorial_subjects WHERE group_key = $1`, [groupKey]))[0].id;
      await q(`UPDATE editorial_documents SET subject_id = $2, status = 'grouped' WHERE id = $1`, [doc.id, subjectId]);
    }

    // 1 bis. Regroupement règle 3 (decisions.md §3.3) : même annonce chez deux émetteurs,
    // confirmée par la comparaison des contenus (injectable). Fusion NON destructrice
    // (statut `merged`, documents déplacés, preuves conservées) ; doute = `doublon_incertain`
    // vers l'examen humain, jamais une fusion.
    const compare = deps.compare ?? compareForGrouping;
    const groupables = await q(
      `SELECT s.* FROM editorial_subjects s WHERE s.status = 'candidate' AND s.recap_id IS NULL
       ORDER BY (SELECT min(src.priority) FROM editorial_documents d JOIN editorial_sources src ON src.id = d.source_id WHERE d.subject_id = s.id),
                s.created_at, s.group_key`,
    );
    const items: (GroupingItem & { absorbed: boolean })[] = [];
    for (const subject of groupables) {
      const sdocs = await subjectDocuments(q, subject.id as string);
      if (sdocs.length === 0) continue;
      items.push({
        subjectId: subject.id as string,
        title: subject.title as string,
        text: sdocs.map((d) => `${d.title}\n${String(d.extracted_text ?? d.summary ?? "")}`).join("\n").slice(0, 20_000),
        publishedAt: sdocs[0].published_at ? new Date(sdocs[0].published_at as string) : null,
        absorbed: false,
      });
    }
    for (let i = 0; i < items.length; i++) {
      if (items[i].absorbed) continue;
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].absorbed) continue;
        const { kind, evidence } = compare(items[i], items[j]);
        if (kind === "distinct") continue;
        items[j].absorbed = true;
        if (kind === "merge") {
          await q(`UPDATE editorial_documents SET subject_id = $2 WHERE subject_id = $1`, [items[j].subjectId, items[i].subjectId]);
          await q(
            `UPDATE editorial_subjects SET status = 'merged', merged_into_subject_id = $2, grouping = $3, updated_at = now() WHERE id = $1`,
            [items[j].subjectId, items[i].subjectId, JSON.stringify({ verdict: "fusion", avec: items[i].subjectId, preuves: evidence })],
          );
          await logRevision(q, {
            entity: "subject",
            entityId: items[j].subjectId,
            after: evidence,
            reason: `Règle 3 : même annonce que le sujet ${items[i].subjectId}, documents regroupés`,
            actorLabel: "worker",
          });
        } else {
          await setSubject(q, items[j].subjectId, { status: "review_required", reason: "doublon_incertain" });
          await q(`UPDATE editorial_subjects SET grouping = $2 WHERE id = $1`, [
            items[j].subjectId,
            JSON.stringify({ verdict: "doublon_incertain", avec: items[i].subjectId, preuves: evidence }),
          ]);
          await logRevision(q, {
            entity: "subject",
            entityId: items[j].subjectId,
            after: evidence,
            reason: `Règle 3 : regroupement douteux avec le sujet ${items[i].subjectId}, examen humain`,
            actorLabel: "worker",
          });
        }
      }
    }

    // 2. Contrôles déterministes avant tout appel fournisseur (aucun coût pour les cas à examiner).
    // Ordre déterministe : priorité de la meilleure source (decisions.md §3.1), puis date de création, puis clé de regroupement.
    const candidates = await q(
      `SELECT s.* FROM editorial_subjects s WHERE s.status = 'candidate' AND s.recap_id IS NULL
       ORDER BY (SELECT min(src.priority) FROM editorial_documents d JOIN editorial_sources src ON src.id = d.source_id WHERE d.subject_id = s.id),
                s.created_at, s.group_key`,
    );
    const selected: Row[] = [];
    for (const subject of candidates) {
      const sdocs = await subjectDocuments(q, subject.id as string);
      if (sdocs.length === 0) continue;
      const dup = await memberDuplicate(q, sdocs.flatMap(documentUrls));
      if (dup) {
        await setSubject(q, subject.id as string, { status: "duplicate", duplicatePostId: dup });
        continue;
      }
      if (!sdocs.some((d) => d.published_at)) {
        await setSubject(q, subject.id as string, { status: "review_required", reason: "date_manquante" });
        continue;
      }
      if (sdocs.some((d) => hasSuspiciousInstructions(`${d.title}\n${d.extracted_text ?? d.summary}`))) {
        await setSubject(q, subject.id as string, { status: "review_required", reason: "instructions_suspectes" });
        continue;
      }
      if (!isFresh(sdocs, slotAt)) {
        await setSubject(q, subject.id as string, { status: "ignored", reason: "perime" });
        continue;
      }
      await q(`UPDATE editorial_subjects SET recap_id = $2, updated_at = now() WHERE id = $1`, [subject.id, recap.id]);
      selected.push({ ...subject, docs: sdocs });
    }
    deps.inject?.("preparation:apres-affectation");

    if (selected.length === 0) {
      await q(`UPDATE editorial_recaps SET state = 'empty', updated_at = now() WHERE id = $1`, [recap.id]);
      return { selected: 0 };
    }

    // 3. Tri par le fournisseur, enregistré dans la même transaction que l'affectation.
    await enqueue(q, {
      kind: "triage",
      key: `triage:${recap.id}`,
      payload: {
        recapId: recap.id,
        maxOutputTokens: TRIAGE_MAX_OUTPUT_TOKENS,
        input: {
          candidates: selected.map((s) => {
            const d = (s.docs as Row[])[0];
            return {
              subjectId: s.id,
              title: s.title,
              summary: String(d.summary || d.extracted_text || "").slice(0, 600),
              sourceType: d.source_type,
              publishedAt: d.published_at ? new Date(d.published_at as string).toISOString() : null,
              url: d.url,
            };
          }),
        },
      },
    });
    await q(`UPDATE editorial_recaps SET notes = notes || '{"etape": "tri"}'::jsonb, updated_at = now() WHERE id = $1`, [recap.id]);
    return { selected: selected.length };
  });
}

/** La nouvelle est retenue si son document le plus récent respecte la fraîcheur à l'instant du créneau visé. */
export function isFresh(sdocs: Row[], slotAt: Date): boolean {
  return sdocs.some((d) => d.published_at && hoursBetween(new Date(d.published_at as string), slotAt) <= freshnessLimit(d.source_type as string));
}

async function setSubject(
  q: Query,
  id: string,
  change: { status: string; reason?: string; duplicatePostId?: string; draft?: unknown; score?: number; scientificStatus?: string },
) {
  await q(
    `UPDATE editorial_subjects SET status = $2, block_reason = $3, duplicate_post_id = COALESCE($4, duplicate_post_id),
       draft = COALESCE($5, draft), triage_score = COALESCE($6, triage_score), scientific_status = COALESCE($7, scientific_status),
       updated_at = now() WHERE id = $1`,
    [
      id,
      change.status,
      change.reason ?? null,
      change.duplicatePostId ?? null,
      change.draft === undefined ? null : JSON.stringify(change.draft),
      change.score ?? null,
      change.scientificStatus ?? null,
    ],
  );
}

const LOCAL_HANDLERS: Record<(typeof LOCAL_KINDS)[number], (deps: Deps, task: Task) => Promise<unknown>> = {
  collect_source: collectSource,
  extract_document: extractDocument,
  prepare_recap: prepareRecap,
};

/** Exécute les tâches locales prêtes, une par une. */
export async function runLocalTasks(deps: Deps, maxTasks = 200) {
  const report = { done: 0, retried: 0, review: 0, leaseLost: 0 };
  for (let i = 0; i < maxTasks; i++) {
    const task = await claim(deps.db, deps.owner, LOCAL_KINDS);
    if (!task) break;
    try {
      await LOCAL_HANDLERS[task.kind as (typeof LOCAL_KINDS)[number]](deps, task);
      report.done++;
    } catch (error) {
      if (error instanceof LeaseLostError) {
        // Bail perdu : rien n'a été écrit ; la tâche appartient désormais à un autre worker ou sera reprise.
        report.leaseLost++;
        continue;
      }
      const taskError: TaskError =
        error instanceof TaskFailure ? error.error : { code: "unexpected", message: String(error), permanent: false };
      const outcome = await fail(deps.db.query, task, taskError);
      if (outcome === "retry") report.retried++;
      if (outcome === "review_required") report.review++;
    }
  }
  return report;
}

// ───────────────────────────── Fournisseur ─────────────────────────────

class BudgetRefused extends Error {}

/** Champs de configuration dont dépend une soumission : ils doivent être identiques avant le comptage et sous verrou (revue C203). */
function submissionSnapshot(config: EditorialConfig) {
  return JSON.stringify({
    provider: config.provider,
    model: config.model,
    prices: config.prices,
    currency: config.currency,
    cap: config.budgetCapMicros?.toString() ?? null,
    paused: config.paused,
    estimationBlocked: config.estimationBlocked,
  });
}

/**
 * Soumet les tâches fournisseur en attente dans un lot, après réservation du budget.
 * - Identité du fournisseur (modèle compris) contrôlée avant tout appel réseau (C203).
 * - Coût par requête calculé hors transaction : la RÉSERVATION utilise la borne garantie,
 *   jamais l'estimation (C202). Le lot ne contient que les requêtes dont les bornes tiennent
 *   dans le budget restant.
 * - Sous verrou : configuration complète revalidée (C203), tâches toujours disponibles,
 *   puis réservation. Bloqué par la pause.
 */
export async function submitPending(deps: Deps): Promise<{ submitted: number; reason?: string }> {
  const { db, provider, now } = deps;
  if (!provider) return { submitted: 0, reason: "aucun fournisseur disponible" };
  await reconcileStaleSubmissions(deps);

  const config = await loadConfig(db.query);
  // Un fournisseur Claude n'est construit qu'avec une clé (providers/index.ts).
  const ready = readiness(config, { claudeKeyPresent: provider.id === "claude" });
  if (!ready.provider.enabled) return { submitted: 0, reason: ready.provider.missing.join(" ; ") };
  if (config.provider !== provider.id) return { submitted: 0, reason: "fournisseur configuré différent" };
  if (!provider.simulated && provider.model !== config.model) {
    return { submitted: 0, reason: `modèle de l'adaptateur (${provider.model}) différent de la configuration (${config.model}) : fournisseur à reconstruire` };
  }
  const snapshot = submissionSnapshot(config);

  const candidates = (
    await db.query(
      `SELECT * FROM editorial_tasks WHERE kind = ANY($1::text[]) AND state = 'pending' AND next_attempt_at <= now()
       ORDER BY created_at LIMIT 50`,
      [PROVIDER_KINDS],
    )
  ).map(toTask);
  if (candidates.length === 0) return { submitted: 0, reason: "aucune tâche ou agent en pause" };
  const allRequests = candidates.map((t) => ({ taskId: t.id, kind: t.kind, input: t.payload.input, maxOutputTokens: Number(t.payload.maxOutputTokens) })) as ProviderRequest[];

  let costs: { estimateMicros: bigint; boundMicros: bigint }[];
  if (provider.costPerRequest) {
    try {
      costs = await provider.costPerRequest(allRequests, config.prices!);
    } catch (error) {
      return { submitted: 0, reason: `borne de coût indisponible, soumission refusée : ${String(error)}` };
    }
  } else if (provider.simulated) {
    // Majorant simulé, réservé au fournisseur de test.
    costs = allRequests.map((r) => {
      const m = estimateMicros([{ inputChars: JSON.stringify(r.input).length, maxOutputTokens: r.maxOutputTokens }], config.prices!);
      return { estimateMicros: m, boundMicros: m };
    });
  } else {
    return { submitted: 0, reason: "aucune borne de coût garantie pour ce fournisseur : soumission refusée" };
  }

  // Taille du lot : les premières requêtes dont la somme des bornes tient dans le budget restant du mois.
  const summary = await budgetSummary(db.query, utcPeriod(now()), config.budgetCapMicros, config.currency);
  let remaining = config.budgetCapMicros! - summary.settledMicros - summary.reservedMicros;
  const chosen: number[] = [];
  for (let i = 0; i < allRequests.length; i++) {
    if (costs[i].boundMicros > remaining) break;
    remaining -= costs[i].boundMicros;
    chosen.push(i);
  }
  if (chosen.length === 0) return { submitted: 0, reason: "budget restant insuffisant pour la borne d'une seule requête" };
  const requests = chosen.map((i) => allRequests[i]);
  const bound = chosen.reduce((sum, i) => sum + costs[i].boundMicros, 0n);
  const estimate = chosen.reduce((sum, i) => sum + costs[i].estimateMicros, 0n);

  let prepared: { batchId: string; requests: ProviderRequest[] } | null;
  try {
    prepared = await db.transaction(async (q) => {
      // Verrou de configuration : toute modification pendant le comptage (pause, prix, modèle, budget, devise) annule la soumission.
      const locked = await loadConfig(q, { lock: true });
      if (submissionSnapshot(locked) !== snapshot) return null;
      if (!readiness(locked, { claudeKeyPresent: provider.id === "claude" }).provider.enabled) return null;
      const ids = requests.map((r) => r.taskId);
      const still = await q(`SELECT id FROM editorial_tasks WHERE id = ANY($1::uuid[]) AND state = 'pending' FOR UPDATE SKIP LOCKED`, [ids]);
      // Les bornes couvrent exactement ces requêtes : si l'une a été prise entre-temps, on recommencera au prochain cycle.
      if (still.length !== ids.length) return null;
      // Instantané du modèle, des tarifs et de la devise : base du coût de ce lot, quoi qu'il arrive ensuite (B002).
      const [batch] = await q<{ id: string }>(
        `INSERT INTO editorial_batches (provider, state, model, prices, currency, task_ids, estimate_micros)
         VALUES ($1, 'submitting', $2, $3, $4, $5, $6) RETURNING id`,
        [provider.id, locked.model, JSON.stringify(locked.prices), locked.currency, ids, estimate.toString()],
      );
      const ok = await reserve(q, { batchId: batch.id, estimateMicros: bound, capMicros: locked.budgetCapMicros!, currency: locked.currency!, now: now() });
      if (!ok) throw new BudgetRefused();
      await q(
        `UPDATE editorial_tasks SET state = 'waiting_provider', batch_id = $2, attempts = attempts + 1, updated_at = now() WHERE id = ANY($1::uuid[])`,
        [ids, batch.id],
      );
      return { batchId: batch.id, requests };
    });
  } catch (error) {
    if (error instanceof BudgetRefused) return { submitted: 0, reason: "plafond de budget atteint" };
    throw error;
  }
  if (!prepared) return { submitted: 0, reason: "configuration ou tâches modifiées pendant la préparation : soumission reportée" };

  try {
    const { externalId } = await provider.submitBatch(prepared.batchId, prepared.requests);
    await db.query(`UPDATE editorial_batches SET external_id = $2, state = 'submitted', submitted_at = now() WHERE id = $1`, [prepared.batchId, externalId]);
    return { submitted: prepared.requests.length };
  } catch (error) {
    if (error instanceof ProviderNotSentError) {
      // Non-envoi confirmé : la réservation est libérée et les tâches reviennent en attente.
      await db.transaction(async (q) => {
        await q(`UPDATE editorial_batches SET state = 'failed', error = $2, reconciled_at = now() WHERE id = $1`, [prepared!.batchId, JSON.stringify({ message: String(error) })]);
        await q(
          `UPDATE editorial_tasks SET state = 'pending', batch_id = NULL, next_attempt_at = now() + interval '5 minutes', updated_at = now()
           WHERE batch_id = $1 AND state = 'waiting_provider'`,
          [prepared!.batchId],
        );
        await releaseConfirmedUnsent(q, prepared!.batchId);
      });
      return { submitted: 0, reason: "soumission refusée avant envoi" };
    }
    await markAmbiguous(deps, prepared.batchId, String(error));
    return { submitted: 0, reason: "soumission incertaine : examen requis" };
  }
}

async function markAmbiguous(deps: Deps, batchId: string, message: string) {
  const { db, provider } = deps;
  if (provider?.capabilities.findByInternalId && provider.findBatchByInternalId) {
    try {
      const found = await provider.findBatchByInternalId(batchId);
      if (found) {
        await db.query(`UPDATE editorial_batches SET external_id = $2, state = 'submitted', submitted_at = now() WHERE id = $1`, [batchId, found.externalId]);
        return;
      }
    } catch {
      // Rapprochement impossible : état incertain ci-dessous.
    }
  }
  await db.transaction(async (q) => {
    await q(`UPDATE editorial_batches SET state = 'uncertain', error = $2 WHERE id = $1`, [batchId, JSON.stringify({ message })]);
    await q(`UPDATE editorial_tasks SET state = 'uncertain', updated_at = now() WHERE batch_id = $1 AND state = 'waiting_provider'`, [batchId]);
    await markUncertain(q, batchId);
    await logRevision(q, { entity: "batch", entityId: batchId, reason: `Soumission incertaine : ${message}`, actorLabel: "worker" });
  });
}

async function reconcileStaleSubmissions(deps: Deps) {
  const stale = await deps.db.query<{ id: string }>(
    `SELECT id FROM editorial_batches WHERE state = 'submitting' AND created_at < now() - make_interval(mins => $1)`,
    [STALE_SUBMISSION_MINUTES],
  );
  for (const b of stale) await markAmbiguous(deps, b.id, "Worker interrompu pendant la soumission");
}

/** Nombre de lectures incomplètes d'un lot terminé avant de le passer en examen (sans resoumission). */
const MAX_INCOMPLETE_READS = 5;

/**
 * Suivi des lots, autorisé pendant la pause. Une seule lecture VALIDÉE (revue C201) fournit à la
 * fois les résultats et l'usage : tant qu'elle est incomplète, rien n'est appliqué, la réservation
 * est conservée et aucune requête possiblement facturée n'est resoumise. Après plusieurs lectures
 * incomplètes, le lot passe en état incertain (examen humain).
 */
export async function pollBatches(deps: Deps) {
  const { db, provider } = deps;
  const report = { applied: 0, ignored: 0, settled: 0, incomplete: 0, toReview: 0 };
  if (!provider) return report;
  const batches = await db.query<{ id: string; external_id: string; state: string; task_ids: string[]; prices: Prices | null }>(
    `SELECT id, external_id, state, task_ids, prices FROM editorial_batches
     WHERE provider = $1 AND external_id IS NOT NULL AND (state = 'submitted' OR (state = 'ended' AND reconciled_at IS NULL))`,
    [provider.id],
  );
  for (const batch of batches) {
    let readout: BatchReadout;
    try {
      readout = await provider.readBatch(batch.external_id, batch.task_ids ?? []);
    } catch (error) {
      // Erreur réseau ou API pendant le suivi : rien n'est modifié, nouvelle tentative au prochain cycle.
      await db.query(`UPDATE editorial_batches SET error = $2 WHERE id = $1`, [batch.id, JSON.stringify({ suivi: String(error) })]);
      continue;
    }
    if (readout.state === "in_progress") continue;
    if (!readout.complete) {
      report.incomplete++;
      const [row] = await db.query<{ n: number }>(
        `UPDATE editorial_batches SET reconcile_attempts = reconcile_attempts + 1, reconcile_error = $2 WHERE id = $1 RETURNING reconcile_attempts AS n`,
        [batch.id, readout.reason],
      );
      if (Number(row.n) >= MAX_INCOMPLETE_READS) {
        await markAmbiguousAfterRead(deps, batch.id, `Résultats incohérents après ${row.n} lectures : ${readout.reason}`);
        report.toReview++;
      }
      continue;
    }
    for (const result of readout.results) {
      if (await applyResult(deps, batch.id, result)) report.applied++;
      else report.ignored++;
    }
    await db.query(`UPDATE editorial_batches SET state = 'ended', ended_at = COALESCE(ended_at, now()) WHERE id = $1 AND state = 'submitted'`, [batch.id]);
    if (!batch.prices) continue;
    const outcome = await db.transaction(async (q) => {
      const r = await settle(q, batch.id, costMicros(readout.usage, batch.prices!));
      await q(`UPDATE editorial_batches SET usage = $2, reconciled_at = now(), reconcile_error = NULL WHERE id = $1`, [batch.id, JSON.stringify(readout.usage)]);
      if (r === "estimation_exceeded") {
        await q(`UPDATE editorial_config SET estimation_blocked = true, updated_at = now() WHERE id = 1`);
        await logRevision(q, { entity: "config", entityId: "1", reason: `Coût réel supérieur à la réservation (lot ${batch.id})`, actorLabel: "worker" });
      }
      return r;
    });
    if (outcome !== "already") report.settled++;
  }
  return report;
}

/** Lot terminé mais illisible de façon cohérente : examen humain, réservation conservée, aucune resoumission. */
async function markAmbiguousAfterRead(deps: Deps, batchId: string, message: string) {
  await deps.db.transaction(async (q) => {
    await q(`UPDATE editorial_batches SET state = 'uncertain', error = $2 WHERE id = $1`, [batchId, JSON.stringify({ message })]);
    await q(`UPDATE editorial_tasks SET state = 'uncertain', updated_at = now() WHERE batch_id = $1 AND state = 'waiting_provider'`, [batchId]);
    await markUncertain(q, batchId);
    await logRevision(q, { entity: "batch", entityId: batchId, reason: message, actorLabel: "worker" });
  });
}

const triageSchema = z.object({
  decisions: z.array(
    z.object({ subjectId: z.string(), keep: z.boolean(), score: z.number(), scientificStatus: z.enum(["announcement", "preprint", "published", "unknown", "analysis"]) }),
  ),
});

/** Applique un résultat une seule fois : un résultat rejoué ou tardif est ignoré. */
async function applyResult(deps: Deps, batchId: string, result: ProviderResult): Promise<boolean> {
  return deps.db.transaction(async (q) => {
    const [row] = await q(`SELECT * FROM editorial_tasks WHERE id = $1 AND batch_id = $2 AND state = 'waiting_provider' FOR UPDATE`, [
      result.taskId,
      batchId,
    ]);
    if (!row) return false;
    const task = toTask(row);
    const forDevelopment = Boolean(task.payload.developmentId);
    if (!result.ok) {
      const toReview = result.error.permanent || task.attempts >= task.maxAttempts;
      await q(
        `UPDATE editorial_tasks SET state = $2, batch_id = NULL, error = $3, next_attempt_at = now() + interval '5 minutes', updated_at = now() WHERE id = $1`,
        [task.id, toReview ? "review_required" : "pending", JSON.stringify(result.error)],
      );
      if (toReview && forDevelopment) {
        await failDevelopment(q, String(task.payload.developmentId), `Échec fournisseur : ${result.error.message}`);
      } else if (toReview && task.kind !== "triage") {
        await setSubject(q, String(task.payload.subjectId), { status: "review_required", reason: "resume_non_etaye", draft: { refus: `Échec fournisseur : ${result.error.message}` } });
        await maybeAssemble(q, String(task.payload.recapId));
      }
      return true;
    }
    if (task.kind === "triage") await applyTriage(q, task, result.output);
    else if (task.kind === "draft") await applyDraft(q, task, result.output);
    else if (task.kind === "develop") await applyDevelop(q, task, result.output);
    // Preuve « simulée » d'après l'identité réelle du fournisseur, jamais d'après la sortie d'un modèle.
    else await applyVerify(q, task, result.output, Boolean(deps.provider?.simulated));
    await q(`UPDATE editorial_tasks SET state = 'done', result = $2, updated_at = now() WHERE id = $1`, [task.id, JSON.stringify(result.output)]);
    if (task.kind !== "triage" && !forDevelopment && task.payload.recapId) await maybeAssemble(q, String(task.payload.recapId));
    return true;
  });
}

async function applyTriage(q: Query, task: Task, output: unknown) {
  const recapId = String(task.payload.recapId);
  const parsed = triageSchema.safeParse(output);
  const subjects = await q(`SELECT id FROM editorial_subjects WHERE recap_id = $1 AND status = 'candidate'`, [recapId]);
  const decisions = new Map((parsed.success ? parsed.data.decisions : []).map((d) => [d.subjectId, d]));
  let kept = 0;
  for (const s of subjects) {
    const decision = decisions.get(s.id as string);
    if (!decision || !decision.keep) {
      await setSubject(q, s.id as string, { status: "ignored", reason: parsed.success ? "non_retenu_au_tri" : "tri_invalide" });
      continue;
    }
    kept++;
    await setSubject(q, s.id as string, { status: "drafting", score: decision.score, scientificStatus: decision.scientificStatus });
    const docs = (await subjectDocuments(q, s.id as string)).slice(0, MAX_DOCS_PER_DRAFT);
    const documents: DraftDocument[] = docs.map((d) => ({
      documentId: d.id as string,
      // Adresse propre du document : l'URL canonique ne sert qu'au regroupement, chaque source reste distincte.
      url: (d.final_url as string) || (d.url as string),
      title: d.title as string,
      publishedAt: d.published_at ? new Date(d.published_at as string).toISOString() : null,
      text: String(d.extracted_text || d.summary || "").slice(0, MAX_DOC_CHARS_FOR_DRAFT),
    }));
    await enqueue(q, {
      kind: "draft",
      key: `draft:${recapId}:${s.id}`,
      payload: { recapId, subjectId: s.id, maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS, input: { subjectId: s.id, statusHint: decision.scientificStatus, documents } },
    });
  }
  if (kept === 0) await q(`UPDATE editorial_recaps SET state = 'empty', updated_at = now() WHERE id = $1 AND state = 'planned'`, [recapId]);
  else await q(`UPDATE editorial_recaps SET notes = notes || '{"etape": "redaction"}'::jsonb, updated_at = now() WHERE id = $1`, [recapId]);
}

/** Contrôle structurel seulement : un brouillon valide part en vérification indépendante, il n'est pas encore « prêt » (B003). */
async function applyDraft(q: Query, task: Task, output: unknown) {
  const input = task.payload.input as { documents: DraftDocument[] };
  const subjectId = String(task.payload.subjectId);
  const recapId = String(task.payload.recapId);
  const verdict = validateDraft(output, input.documents);
  if (!verdict.ok) {
    await setSubject(q, subjectId, { status: "review_required", reason: verdict.reason, draft: { refus: verdict.detail } });
    return;
  }
  await setSubject(q, subjectId, { status: "drafting", draft: { ...verdict.draft, etape: "verification" } });
  await enqueue(q, {
    kind: "verify",
    key: `verify:${recapId}:${subjectId}`,
    payload: {
      recapId,
      subjectId,
      draft: verdict.draft,
      maxOutputTokens: VERIFY_MAX_OUTPUT_TOKENS,
      input: { subjectId, statements: statementsFor(verdict.draft), scientificStatus: verdict.draft.scientificStatus, documents: input.documents },
    },
  });
}

// ─────────────── Développement lié (lot d'accélération A10) ───────────────

async function failDevelopment(q: Query, developmentId: string, detail: string, reason = "resume_non_etaye") {
  await q(
    `UPDATE editorial_developments SET state = 'review_required', content = COALESCE(content, '{}'::jsonb) || $2::jsonb, updated_at = now() WHERE id = $1`,
    [developmentId, JSON.stringify({ refus: detail, motif: reason })],
  );
}

/** Article de développement : validation structurelle puis vérification indépendante, comme un brouillon. */
async function applyDevelop(q: Query, task: Task, output: unknown) {
  const developmentId = String(task.payload.developmentId);
  const input = task.payload.input as { subjectId: string; documents: DraftDocument[] };
  const verdict = validateDevelopment(output, input.documents);
  if (!verdict.ok) return failDevelopment(q, developmentId, verdict.detail, verdict.reason);
  await q(`UPDATE editorial_developments SET content = $2, updated_at = now() WHERE id = $1`, [
    developmentId,
    JSON.stringify({ ...verdict.draft, etape: "verification" }),
  ]);
  await enqueue(q, {
    kind: "verify",
    key: `verify-dev:${developmentId}`,
    payload: {
      developmentId,
      draft: verdict.draft,
      maxOutputTokens: VERIFY_MAX_OUTPUT_TOKENS,
      input: { subjectId: input.subjectId, statements: statementsFor(verdict.draft), scientificStatus: verdict.draft.scientificStatus, documents: input.documents },
    },
  });
}

async function applyDevelopVerify(q: Query, task: Task, output: unknown, simulated: boolean) {
  const developmentId = String(task.payload.developmentId);
  const draft = task.payload.draft as ValidatedDraft;
  const documents = (task.payload.input as { documents: DraftDocument[] }).documents;
  const verdict = checkVerification(output, draft, documents, { simulated });
  if (verdict.ok) {
    await q(`UPDATE editorial_developments SET state = 'ready', content = $2, updated_at = now() WHERE id = $1`, [
      developmentId,
      JSON.stringify({ ...draft, verification: verdict.evidence }),
    ]);
  } else {
    await q(`UPDATE editorial_developments SET state = 'review_required', content = $2, updated_at = now() WHERE id = $1`, [
      developmentId,
      JSON.stringify({ ...draft, refus: verdict.detail, motif: verdict.reason, verificationSimulee: verdict.simulated }),
    ]);
  }
}

/** Verdict indépendant + garde-fous serveur : seule voie vers « ready ». */
async function applyVerify(q: Query, task: Task, output: unknown, simulated: boolean) {
  if (task.payload.developmentId) return applyDevelopVerify(q, task, output, simulated);
  const subjectId = String(task.payload.subjectId);
  const draft = task.payload.draft as ValidatedDraft;
  const documents = (task.payload.input as { documents: DraftDocument[] }).documents;
  const verdict = checkVerification(output, draft, documents, { simulated });
  if (verdict.ok) {
    await setSubject(q, subjectId, { status: "ready", draft: { ...draft, verification: verdict.evidence }, scientificStatus: draft.scientificStatus });
  } else {
    await setSubject(q, subjectId, {
      status: "review_required",
      reason: verdict.reason,
      draft: { ...draft, refus: verdict.detail, verificationSimulee: verdict.simulated },
    });
  }
}

/**
 * Assemblage quand plus aucune rédaction ni vérification n'est en cours pour ce récapitulatif.
 * Fraîcheur et doublons humains sont revérifiés ici (règle conservatrice du contrat §5) ;
 * la taille maximale est un plafond, jamais un objectif.
 */
async function maybeAssemble(q: Query, recapId: string) {
  const [recap] = await q(`SELECT * FROM editorial_recaps WHERE id = $1 FOR UPDATE`, [recapId]);
  if (!recap || recap.state !== "planned") return;
  const [{ n }] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM editorial_subjects WHERE recap_id = $1 AND status = 'drafting'`, [recapId]);
  if (n > 0) return;
  const config = await loadConfig(q);
  const maxItems = config.policy?.maxItems ?? 0;
  const slotAt = new Date(recap.slot_at as string);
  const ready = await q(`SELECT * FROM editorial_subjects WHERE recap_id = $1 AND status = 'ready' ORDER BY triage_score DESC, created_at`, [recapId]);
  let position = 0;
  let freshnessDropped = 0;
  for (const subject of ready) {
    const sdocs = await subjectDocuments(q, subject.id as string);
    if (!isFresh(sdocs, slotAt)) {
      freshnessDropped++;
      await setSubject(q, subject.id as string, { status: "ignored", reason: "perime" });
      continue;
    }
    const dup = await memberDuplicate(q, sdocs.flatMap(documentUrls));
    if (dup) {
      await setSubject(q, subject.id as string, { status: "duplicate", duplicatePostId: dup });
      continue;
    }
    if (position >= maxItems) {
      await setSubject(q, subject.id as string, { status: "ignored", reason: "non_retenu_plafond" });
      continue;
    }
    const draft = subject.draft as ValidatedDraft & { verification: { statements: unknown[]; simulated: boolean } };
    position++;
    await q(
      `INSERT INTO editorial_recap_items (recap_id, subject_id, position, title, summary, scientific_status, sources, claims)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (recap_id, subject_id) DO NOTHING`,
      [
        recapId,
        subject.id,
        position,
        draft.title,
        draft.summary,
        draft.scientificStatus,
        JSON.stringify(draft.sources),
        // Preuves de la vérification indépendante (énoncé → passage), avec l'indication « simulée » le cas échéant.
        JSON.stringify({ statements: draft.verification.statements, simulated: draft.verification.simulated }),
      ],
    );
  }
  await q(`UPDATE editorial_recaps SET state = $2, freshness_dropped = freshness_dropped + $3, updated_at = now() WHERE id = $1`, [
    recapId,
    position > 0 ? "ready" : "empty",
    freshnessDropped,
  ]);
  await logRevision(q, {
    entity: "recap",
    entityId: recapId,
    after: { items: position, freshnessDropped },
    reason: position > 0 ? "Brouillon assemblé après vérification" : "Aucune nouvelle retenue",
    actorLabel: "worker",
  });
}

// ───────────────────────────── Cycle du worker ─────────────────────────────

/** Un cycle complet et borné. Appelé par scripts/worker.ts (jamais pendant une requête web). */
export async function runCycle(deps: Deps, { maxTasks = 200 } = {}) {
  const planned = await plan(deps);
  const local1 = await runLocalTasks(deps, maxTasks);
  const submitted = await submitPending(deps);
  const polled = await pollBatches(deps);
  const local2 = await runLocalTasks(deps, maxTasks);
  return {
    planned,
    local: { done: local1.done + local2.done, retried: local1.retried + local2.retried, review: local1.review + local2.review, leaseLost: local1.leaseLost + local2.leaseLost },
    submitted,
    polled,
  };
}
