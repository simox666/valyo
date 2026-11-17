import type { Query } from "./types.ts";
import { isValidTimeZone, type SlotRule } from "./time.ts";

// Configuration de l'agent (contrat §1, §7). Toute politique incomplète est
// « non configurée » et désactive l'exécution concernée ; la console affiche
// les paramètres manquants. Les propositions D8 ne sont jamais des valeurs par défaut.

/** Fraîcheur validée (decisions.md §3.2, D4), mesurée à l'instant du créneau visé. */
export const FRESHNESS_HOURS = 72;
export const SCIENTIFIC_FRESHNESS_HOURS = 7 * 24;

export interface Prices {
  /** Prix en micro-unités de la devise par million de jetons. */
  inputPerMTokMicros: number;
  outputPerMTokMicros: number;
}

export interface RecapPolicy {
  slots: SlotRule[];
  maxItems: number;
  /** Heures avant le créneau où la préparation commence (tri par lots compris). */
  prepLeadHours: number;
}

export interface EditorialConfig {
  version: number;
  paused: boolean;
  mode: "draft" | "public";
  provider: "none" | "test" | "claude";
  model: string | null;
  prices: Prices | null;
  currency: string | null;
  budgetCapMicros: bigint | null;
  timezone: string | null;
  policy: RecapPolicy | null;
  estimationBlocked: boolean;
  updatedAt: string;
}

export async function loadConfig(q: Query, { lock = false } = {}): Promise<EditorialConfig> {
  const [row] = await q(`SELECT * FROM editorial_config WHERE id = 1 ${lock ? "FOR UPDATE" : ""}`);
  return {
    version: Number(row.version),
    paused: Boolean(row.paused),
    mode: row.mode as EditorialConfig["mode"],
    provider: row.provider as EditorialConfig["provider"],
    model: (row.model as string) ?? null,
    prices: (row.prices as Prices) ?? null,
    currency: (row.currency as string) ?? null,
    budgetCapMicros: row.budget_cap_micros === null || row.budget_cap_micros === undefined ? null : BigInt(String(row.budget_cap_micros)),
    timezone: (row.timezone as string) ?? null,
    policy: (row.policy as RecapPolicy) ?? null,
    estimationBlocked: Boolean(row.estimation_blocked),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export interface Readiness {
  enabled: boolean;
  missing: string[];
}

export function policyProblems(policy: RecapPolicy | null): string[] {
  if (!policy) return ["politique des récapitulatifs (jours, heures, taille) non définie (D8)"];
  const problems: string[] = [];
  if (!Array.isArray(policy.slots) || policy.slots.length === 0) problems.push("aucun créneau de récapitulatif");
  for (const s of policy.slots ?? []) {
    if (!(s.weekday >= 1 && s.weekday <= 7) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)) problems.push(`créneau invalide ${JSON.stringify(s)}`);
  }
  if (!(policy.maxItems >= 1 && policy.maxItems <= 20)) problems.push("taille maximale du récapitulatif invalide (1 à 20)");
  if (!(policy.prepLeadHours >= 1)) problems.push("délai de préparation avant créneau non défini");
  // Revue C005, point 2 : deux préparations ne doivent jamais se chevaucher (sinon la première
  // réclamerait les sujets de la suivante). Politique non supportée : refusée explicitement.
  const gap = minGapHours(policy.slots ?? []);
  if (gap !== null && policy.prepLeadHours >= gap) {
    problems.push(`délai de préparation (${policy.prepLeadHours} h) supérieur ou égal à l'écart minimal entre deux créneaux (${gap} h) : non supporté`);
  }
  return problems;
}

/** Plus petit écart entre deux créneaux consécutifs de la semaine, en heures (null si moins de deux créneaux valides). */
export function minGapHours(slots: SlotRule[]): number | null {
  const minutes = slots
    .filter((s) => s.weekday >= 1 && s.weekday <= 7 && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))
    .map((s) => (s.weekday - 1) * 1440 + Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)))
    .sort((a, b) => a - b);
  if (minutes.length === 0) return null;
  if (minutes.length === 1) return 7 * 24;
  let min = minutes[0] + 7 * 1440 - minutes[minutes.length - 1];
  for (let i = 1; i < minutes.length; i++) min = Math.min(min, minutes[i] - minutes[i - 1]);
  return min / 60;
}

/** État de chaque capacité de l'agent, avec les paramètres manquants. */
/** `env.claudeKeyPresent` : présence de ANTHROPIC_API_KEY, sans jamais lire ni exposer sa valeur. */
export function readiness(config: EditorialConfig, env: { claudeKeyPresent?: boolean } = {}) {
  const providerMissing: string[] = [];
  if (config.paused) providerMissing.push("agent en pause");
  if (config.estimationBlocked) providerMissing.push("écart d'estimation de coût à rapprocher");
  if (config.provider === "none") providerMissing.push("aucun fournisseur choisi (D3)");
  if (config.provider === "claude" && !env.claudeKeyPresent) providerMissing.push("clé API Claude absente (ANTHROPIC_API_KEY dans .env.local)");
  if (config.provider === "claude" && !config.model) providerMissing.push("modèle non choisi (D3)");
  if (!config.prices) providerMissing.push("prix vérifiés non saisis");
  if (!config.currency) providerMissing.push("devise non définie");
  if (config.budgetCapMicros === null) providerMissing.push("plafond mensuel non défini (D3)");

  const recapMissing = [...policyProblems(config.policy)];
  if (!config.timezone) recapMissing.push("fuseau de planification non confirmé");
  else if (!isValidTimeZone(config.timezone)) recapMissing.push(`fuseau invalide : ${config.timezone}`);

  // La voie de publication existe (publish.ts) mais reste derrière une capacité désactivée :
  // seul le mode « public », décidé par le porteur après la recette D4, l'active.
  const publicationMissing: string[] = [];
  if (config.mode !== "public") publicationMissing.push("mode brouillon : publication désactivée (activation réservée au porteur après la recette D4)");
  if (config.paused) publicationMissing.push("agent en pause");

  return {
    collection: { enabled: true, missing: [] } as Readiness,
    provider: { enabled: providerMissing.length === 0, missing: providerMissing } as Readiness,
    recap: { enabled: recapMissing.length === 0, missing: recapMissing } as Readiness,
    publication: { enabled: publicationMissing.length === 0, missing: publicationMissing } as Readiness,
  };
}

export async function logRevision(
  q: Query,
  entry: { entity: string; entityId: string; before?: unknown; after?: unknown; reason: string; actorId?: string | null; actorLabel: string },
) {
  await q(
    `INSERT INTO editorial_revisions (entity, entity_id, before, after, reason, actor_id, actor_label) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.entity,
      entry.entityId,
      entry.before === undefined ? null : JSON.stringify(entry.before, bigintReplacer),
      entry.after === undefined ? null : JSON.stringify(entry.after, bigintReplacer),
      entry.reason,
      entry.actorId ?? null,
      entry.actorLabel,
    ],
  );
}

export function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}
