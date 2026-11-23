// Types partagés de l'agent éditorial. Aucun import serveur : ces modules sont
// testés directement avec Node (tests/editorial-*.test.ts) et appelés par le
// worker (scripts/worker.ts) comme par les pages d'administration.

export type Row = Record<string, unknown>;
export type Query = <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;

export interface Db {
  query: Query;
  transaction<R>(fn: (q: Query) => Promise<R>): Promise<R>;
}

/** Codes de motifs « À examiner » (decisions.md §3.4). */
export const REVIEW_REASONS = [
  "origine_absente",
  "source_inaccessible",
  "date_manquante",
  "resume_non_etaye",
  "contradiction",
  "statut_incertain",
  "doublon_incertain",
  "instructions_suspectes",
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  origine_absente: "Pas d'URL ou d'émetteur identifiable",
  source_inaccessible: "Document inaccessible",
  date_manquante: "Date absente ou incohérente",
  resume_non_etaye: "Résumé ou source non étayés par le document consulté",
  contradiction: "Sources contradictoires sur un point clé",
  statut_incertain: "Statut (annonce, prépublication, résultat publié, analyse) incertain",
  doublon_incertain: "Regroupement douteux avec une publication existante",
  instructions_suspectes: "Le document contient des instructions destinées à un agent",
};

export type ScientificStatus = "announcement" | "preprint" | "published" | "unknown" | "analysis";

export const SCIENTIFIC_STATUS_LABELS: Record<ScientificStatus, string> = {
  announcement: "Annonce",
  preprint: "Prépublication non relue",
  published: "Résultat publié",
  unknown: "Statut inconnu",
  analysis: "Analyse",
};

export type SourceType = "primary" | "scientific" | "press";

export function iso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return new Date(v as string).toISOString();
}

/** Les entiers 64 bits arrivent en chaîne (pg) ou en BigInt (PGlite). */
export function toBigInt(v: unknown): bigint {
  if (v === null || v === undefined) return 0n;
  return BigInt(typeof v === "bigint" ? v : String(v));
}
