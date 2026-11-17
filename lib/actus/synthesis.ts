import type { Transport } from "../editorial/fetch.ts";
import type { Db, Query } from "../editorial/types.ts";
import { articleText, isPaywalled } from "./page.ts";

// Synthèse IA d'un article source, générée une seule fois puis montrée à tous :
// - automatiquement à l'import des actus (Haiku, coût minime), plafond quotidien dédié ;
// - sinon à la première demande d'un membre, plafonds quotidiens par membre et global.
// Un article réservé aux abonnés n'est jamais résumé.
//
// Quotas (SEC-03) : chaque TENTATIVE d'appel fournisseur est journalisée dans
// synthesis_attempts, y compris en échec. La réservation (contrôle des plafonds + insertion
// de la tentative + réservation de la publication) se fait dans UNE transaction sous verrou
// consultatif : deux demandes concurrentes ne peuvent pas dépasser le plafond ensemble.
// S'ajoutent une limite de relances par publication, un plafond d'appels simultanés et un
// budget monétaire quotidien alimenté par le coût réel des réponses fournisseur.

export interface Synthesis {
  essentiel: string;
  points: string[];
  contexte: string;
  limites: string;
}

export type SynthesisState =
  | { status: "none" }
  | { status: "pending" }
  | { status: "ready"; content: Synthesis }
  | { status: "failed" | "unavailable"; message: string };

export interface SummarizeInput {
  title: string;
  source: string;
  url: string;
  text: string;
}

/** `readable: false` quand le texte fourni ne contient pas l'article. `costMicros` : coût réel en micro-unités de devise. */
export type Summarizer = (input: SummarizeInput) => Promise<{ readable: boolean; synthesis: Synthesis; model: string; costMicros?: number }>;

/** Échec APRÈS réponse fournisseur : porte le coût réel connu, journalisé malgré l'échec (C020-01). */
export class SummarizeError extends Error {
  costMicros?: number;
  constructor(message: string, costMicros?: number) {
    super(message);
    this.costMicros = costMicros;
  }
}

/**
 * Réservation monétaire par défaut d'une tentative : pire cas du modèle LE PLUS CHER connu
 * (~0,10 ; voir estimatedCostMicros du résumeur Claude). Prudent : l'appelant qui connaît son
 * modèle passe une estimation plus juste via `estimateMicros`.
 */
export const DEFAULT_ESTIMATE_MICROS = 100_000;

export const PER_MEMBER_DAILY = 20;
/** Relances par publication et par jour : un article en échec ne se retente pas sans fin. */
export const PER_POST_DAILY = 3;
/** Appels fournisseur simultanés (tentatives non terminées de moins de 5 minutes). */
export const MAX_CONCURRENT = 3;
const globalDaily = () => Math.max(0, Number(process.env.VALYO_SYNTHESES_PAR_JOUR ?? 150) || 0);
const autoDaily = () => Math.max(0, Number(process.env.VALYO_SYNTHESES_AUTO_PAR_JOUR ?? 300) || 0);
/** Budget quotidien en unités de devise (défaut 2,00) ; toutes synthèses confondues. */
const budgetMicrosDaily = () => Math.round(Math.max(0, Number(process.env.VALYO_SYNTHESES_BUDGET_JOUR ?? 2) || 0) * 1_000_000);
const ARTICLE_CHARS = 14_000;
const STALE_PENDING = "3 minutes";

type Row = { post_id: string; status: string; content: Synthesis | null; error: string | null };

function toState(row: Row | undefined): SynthesisState {
  if (!row) return { status: "none" };
  if (row.status === "ready" && row.content) return { status: "ready", content: row.content };
  if (row.status === "pending") return { status: "pending" };
  return { status: row.status === "unavailable" ? "unavailable" : "failed", message: row.error ?? "Synthèse indisponible." };
}

/** États des synthèses ; uniquement pour des publications encore publiées (SEC-04). */
export async function getSyntheses(q: Query, postIds: string[]): Promise<Map<string, SynthesisState>> {
  const map = new Map<string, SynthesisState>();
  if (!postIds.length) return map;
  const rows = await q<Row>(
    `SELECT s.post_id, s.status, s.content, s.error FROM post_syntheses s
     JOIN posts p ON p.id = s.post_id AND p.status = 'published'
     WHERE s.post_id = ANY($1::uuid[])`,
    [postIds],
  );
  for (const r of rows) map.set(r.post_id, toState(r));
  return map;
}

/** Retrait d'une publication (suppression, modération) : sa synthèse disparaît avec elle. */
export async function purgeSynthesis(q: Query, postId: string): Promise<void> {
  await q(`DELETE FROM post_syntheses WHERE post_id = $1`, [postId]);
}

type Reservation =
  | { kind: "go"; attemptId: string }
  | { kind: "state"; state: SynthesisState }
  | { kind: "refused"; status: number; message: string };

/**
 * Réservation atomique d'une tentative (SEC-03) : plafonds, journal et réservation de la
 * publication dans une transaction sous verrou consultatif. `userId` null = import automatique.
 */
async function reserveAttempt(db: Db, postId: string, userId: string | null, estimateMicros: number): Promise<Reservation> {
  return db.transaction(async (q) => {
    await q(`SELECT pg_advisory_xact_lock(hashtext('valyo-syntheses'))`);
    const current = toState((await q<Row>(`SELECT post_id, status, content, error FROM post_syntheses WHERE post_id = $1`, [postId]))[0]);
    if (current.status === "ready" || current.status === "unavailable") return { kind: "state", state: current };

    const [u] = await q<{ mine: number; members: number; autos: number; post: number; running: number; spent: string }>(
      `SELECT count(*) FILTER (WHERE user_id = $2)::int AS mine,
              count(*) FILTER (WHERE user_id IS NOT NULL)::int AS members,
              count(*) FILTER (WHERE user_id IS NULL)::int AS autos,
              count(*) FILTER (WHERE post_id = $1)::int AS post,
              count(*) FILTER (WHERE finished_at IS NULL AND created_at > now() - interval '5 minutes')::int AS running,
              -- Engagement budgétaire : coût réel des tentatives closes, réservation des tentatives
              -- en cours (jamais les deux pour une même ligne : pas de double compte, C020-01).
              COALESCE(sum(CASE WHEN finished_at IS NULL THEN GREATEST(reserved_micros, cost_micros) ELSE cost_micros END), 0)::text AS spent
       FROM synthesis_attempts WHERE created_at > now() - interval '1 day'`,
      [postId, userId],
    );
    if (userId !== null && Number(u.mine) >= PER_MEMBER_DAILY) {
      return { kind: "refused", status: 429, message: `Vous avez développé ${PER_MEMBER_DAILY} articles aujourd’hui : revenez demain.` };
    }
    if (userId !== null && Number(u.members) >= globalDaily()) return { kind: "refused", status: 429, message: "Le quota de synthèses du jour est atteint : revenez demain." };
    if (userId === null && Number(u.autos) >= autoDaily()) return { kind: "refused", status: 429, message: "Quota quotidien des synthèses automatiques atteint." };
    if (Number(u.post) >= PER_POST_DAILY) return { kind: "refused", status: 429, message: "Cet article a déjà été tenté plusieurs fois aujourd’hui : réessayez demain." };
    if (Number(u.running) >= MAX_CONCURRENT) return { kind: "refused", status: 429, message: "Plusieurs synthèses sont déjà en cours : réessayez dans un instant." };
    // La tentative demandée réserve son estimation : le plafond ne peut pas être dépassé par
    // des appels concurrents dont le coût ne serait connu qu'à la fin.
    if (BigInt(u.spent) + BigInt(Math.max(0, Math.round(estimateMicros))) > BigInt(budgetMicrosDaily())) {
      return { kind: "refused", status: 429, message: "Le budget quotidien des synthèses est atteint : revenez demain." };
    }

    // Réservation de la publication : une seule génération à la fois, relance si échec ou blocage périmé.
    const claimed = await q(
      `INSERT INTO post_syntheses (post_id, status, requested_by) VALUES ($1, 'pending', $2)
       ON CONFLICT (post_id) DO UPDATE SET status = 'pending', requested_by = $2, error = NULL, updated_at = now()
       WHERE post_syntheses.status = 'failed' OR (post_syntheses.status = 'pending' AND post_syntheses.updated_at < now() - interval '${STALE_PENDING}')
       RETURNING post_id`,
      [postId, userId],
    );
    if (!claimed.length) return { kind: "state", state: { status: "pending" } };
    const [attempt] = await q<{ id: string }>(
      `INSERT INTO synthesis_attempts (post_id, user_id, reserved_micros) VALUES ($1, $2, $3) RETURNING id`,
      [postId, userId, Math.max(0, Math.round(estimateMicros))],
    );
    return { kind: "go", attemptId: attempt.id };
  });
}

/**
 * Clôt la tentative : issue et coût. Coût CONNU (y compris réponse inutilisable) : enregistré
 * tel quel ; coût INCONNU (null : échec sans usage lisible) : l'estimation réservée est
 * conservée comme coût, marquée `cost_estimated` (C020-01). 0 = aucun appel fournisseur.
 */
async function finishAttempt(db: Db, attemptId: string, outcome: string, costMicros: number | null): Promise<void> {
  await db.query(
    `UPDATE synthesis_attempts SET finished_at = now(), outcome = $2,
            cost_micros = COALESCE($3::bigint, reserved_micros), cost_estimated = ($3::bigint IS NULL) WHERE id = $1`,
    [attemptId, outcome, costMicros === null ? null : Math.max(0, Math.round(costMicros))],
  );
}

export type DevelopOutcome = { ok: true; state: SynthesisState } | { ok: false; status: number; message: string };

export async function developPost(deps: { db: Db; transport: Transport; summarize: Summarizer; userId: string; postId: string; estimateMicros?: number }): Promise<DevelopOutcome> {
  const { db, postId, userId } = deps;
  const [post] = await db.query<{ title: string; source_name: string | null; url: string | null }>(
    `SELECT p.title, p.source_name, ps.url FROM posts p
     LEFT JOIN post_sources ps ON ps.post_id = p.id AND ps.position = 0
     WHERE p.id = $1 AND p.status = 'published'`,
    [postId],
  );
  if (!post) return { ok: false, status: 404, message: "Publication indisponible." };
  if (!post.url) return { ok: false, status: 400, message: "Cette publication n'a pas d'article source à développer." };

  const reserved = await reserveAttempt(db, postId, userId, deps.estimateMicros ?? DEFAULT_ESTIMATE_MICROS);
  if (reserved.kind === "refused") return { ok: false, status: reserved.status, message: reserved.message };
  if (reserved.kind === "state") return { ok: true, state: reserved.state };

  // Travail réseau hors transaction ; la tentative est déjà comptée, succès ou non.
  let html: string;
  try {
    html = (await deps.transport.get(post.url, "html")).body;
  } catch {
    await finishAttempt(db, reserved.attemptId, "article-injoignable", 0);
    return { ok: true, state: await finish(db, postId, "failed", { error: "L’article est injoignable pour le moment. Réessayez dans un instant." }) };
  }
  const source = post.source_name ?? new URL(post.url).hostname;
  return { ok: true, state: await summarizeClaimed(db, deps.summarize, reserved.attemptId, postId, { title: post.title, source, url: post.url }, html) };
}

/**
 * Résultat d'une génération. Si la publication a été retirée entre-temps (SEC-04), la synthèse
 * est détruite au lieu d'être enregistrée, et la RÉPONSE au demandeur initial ne contient
 * aucun texte non plus (C020-02) : rien ne survit au retrait, pas même la première réponse.
 */
async function finish(db: Db, postId: string, status: "ready" | "failed" | "unavailable", fields: { content?: Synthesis; error?: string; model?: string }): Promise<SynthesisState> {
  const written = await db.query(
    `UPDATE post_syntheses SET status = $2, content = $3, error = $4, model = $5, updated_at = now()
     WHERE post_id = $1 AND EXISTS (SELECT 1 FROM posts p WHERE p.id = $1 AND p.status = 'published')
     RETURNING post_id`,
    [postId, status, fields.content ? JSON.stringify(fields.content) : null, fields.error ?? null, fields.model ?? null],
  );
  await db.query(`DELETE FROM post_syntheses WHERE post_id = $1 AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.id = $1 AND p.status = 'published')`, [postId]);
  if (!written.length) return { status: "unavailable", message: "Publication indisponible." };
  return status === "ready" ? { status, content: fields.content! } : { status, message: fields.error! };
}

/** Synthèse d'une publication déjà réservée et d'une tentative déjà journalisée. */
async function summarizeClaimed(db: Db, summarize: Summarizer, attemptId: string, postId: string, meta: { title: string; source: string; url: string }, html: string): Promise<SynthesisState> {
  if (isPaywalled(html)) {
    await finishAttempt(db, attemptId, "payant", 0);
    return finish(db, postId, "unavailable", { error: "Article réservé aux abonnés : pas de synthèse possible." });
  }
  const text = articleText(html, ARTICLE_CHARS);
  if (text.length < 400) {
    await finishAttempt(db, attemptId, "illisible", 0);
    return finish(db, postId, "unavailable", { error: "Le texte de l’article n’est pas lisible automatiquement." });
  }
  try {
    const result = await summarize({ ...meta, text });
    await finishAttempt(db, attemptId, result.readable ? "ok" : "illisible", result.costMicros ?? null);
    if (!result.readable) return finish(db, postId, "unavailable", { error: "Le texte de l’article n’est pas lisible automatiquement.", model: result.model });
    return finish(db, postId, "ready", { content: result.synthesis, model: result.model });
  } catch (error) {
    console.error("Synthèse IA en échec :", String(error).slice(0, 300));
    // Usage connu (réponse reçue mais inutilisable) : coût réel ; inconnu : estimation (null).
    const known = error instanceof SummarizeError ? error.costMicros ?? null : null;
    await finishAttempt(db, attemptId, "echec", known);
    return finish(db, postId, "failed", { error: "La synthèse n’a pas pu être générée. Réessayez dans un instant." });
  }
}

export interface AutoSynthesisInput {
  postId: string;
  title: string;
  source: string;
  url: string;
  /** Page de l'article déjà lue à l'import (pas de seconde requête). */
  html: string;
}

/**
 * Synthèses générées à l'import, une par une, sous les mêmes réservations et budgets que les
 * demandes des membres (plafond quotidien dédié). Une synthèse en échec reste réessayable.
 */
export async function autoSynthesize(deps: { db: Db; summarize: Summarizer; items: AutoSynthesisInput[]; estimateMicros?: number }): Promise<number> {
  let ready = 0;
  for (const item of deps.items) {
    const reserved = await reserveAttempt(deps.db, item.postId, null, deps.estimateMicros ?? DEFAULT_ESTIMATE_MICROS);
    if (reserved.kind === "refused") break;
    if (reserved.kind === "state") continue;
    const state = await summarizeClaimed(deps.db, deps.summarize, reserved.attemptId, item.postId, item, item.html);
    if (state.status === "ready") ready++;
  }
  return ready;
}
