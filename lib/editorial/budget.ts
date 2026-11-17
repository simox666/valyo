import type { Prices } from "./config.ts";
import { utcPeriod } from "./time.ts";
import { toBigInt, type Query } from "./types.ts";

// Budget (contrat §7). Montants en micro-unités entières (BigInt) : calcul exact.
// - Réservation atomique d'un majorant avant toute soumission, sous verrou.
// - Refus si dépensé + réservé + nouvelle réservation dépasse le plafond du mois UTC.
// - Rapprochement unique avec l'usage réel ; une tentative incertaine garde sa réservation.
// - Un lot reste imputé au mois de sa réservation.

export interface CostRequest {
  inputChars: number;
  maxOutputTokens: number;
}

/** Majorant prudent : 1 jeton pour 2 caractères en entrée, sortie maximale comptée en entier. */
export function estimateMicros(requests: CostRequest[], prices: Prices): bigint {
  let total = 0n;
  for (const r of requests) {
    const inputTokens = BigInt(Math.ceil(r.inputChars / 2) + 200);
    const outputTokens = BigInt(r.maxOutputTokens);
    total += ceilDiv(inputTokens * BigInt(prices.inputPerMTokMicros) + outputTokens * BigInt(prices.outputPerMTokMicros), 1_000_000n);
  }
  return total;
}

export function costMicros(usage: { inputTokens: number; outputTokens: number }, prices: Prices): bigint {
  return ceilDiv(
    BigInt(usage.inputTokens) * BigInt(prices.inputPerMTokMicros) + BigInt(usage.outputTokens) * BigInt(prices.outputPerMTokMicros),
    1_000_000n,
  );
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

export interface BudgetSummary {
  period: string;
  currency: string | null;
  capMicros: bigint | null;
  settledMicros: bigint;
  reservedMicros: bigint;
  uncertainCount: number;
}

export async function budgetSummary(q: Query, period: string, capMicros: bigint | null, currency: string | null): Promise<BudgetSummary> {
  const [row] = await q(
    `SELECT
       COALESCE(SUM(actual_micros) FILTER (WHERE state = 'settled'), 0) AS settled,
       COALESCE(SUM(reserved_micros) FILTER (WHERE state IN ('reserved', 'uncertain')), 0) AS reserved,
       COUNT(*) FILTER (WHERE state = 'uncertain')::int AS uncertain
     FROM editorial_spend WHERE period = $1`,
    [period],
  );
  return {
    period,
    currency,
    capMicros,
    settledMicros: toBigInt(row.settled),
    reservedMicros: toBigInt(row.reserved),
    uncertainCount: Number(row.uncertain),
  };
}

/** À appeler dans une transaction. Renvoie false (sans rien écrire) si le plafond serait dépassé. */
export async function reserve(
  q: Query,
  args: { batchId: string; estimateMicros: bigint; capMicros: bigint; currency: string; now: Date },
): Promise<boolean> {
  await q(`SELECT pg_advisory_xact_lock(hashtext('editorial:budget'))`);
  const period = utcPeriod(args.now);
  const summary = await budgetSummary(q, period, args.capMicros, args.currency);
  if (summary.settledMicros + summary.reservedMicros + args.estimateMicros > args.capMicros) return false;
  await q(
    `INSERT INTO editorial_spend (batch_id, period, currency, reserved_micros, state) VALUES ($1, $2, $3, $4, 'reserved')`,
    [args.batchId, period, args.currency, args.estimateMicros.toString()],
  );
  return true;
}

/**
 * Rapprochement unique avec le coût réel. Renvoie "estimation_exceeded" si le coût réel dépasse
 * la réservation : l'appelant bloque alors les nouvelles soumissions jusqu'à vérification.
 */
export async function settle(q: Query, batchId: string, actualMicros: bigint): Promise<"settled" | "already" | "estimation_exceeded"> {
  const rows = await q<{ reserved_micros: unknown }>(
    `UPDATE editorial_spend SET actual_micros = $2, state = 'settled', settled_at = now()
     WHERE batch_id = $1 AND state IN ('reserved', 'uncertain') RETURNING reserved_micros`,
    [batchId, actualMicros.toString()],
  );
  if (rows.length === 0) return "already";
  return actualMicros > toBigInt(rows[0].reserved_micros) ? "estimation_exceeded" : "settled";
}

/** Libère une réservation uniquement si l'absence d'envoi est confirmée (jamais sur un simple délai dépassé). */
export async function releaseConfirmedUnsent(q: Query, batchId: string) {
  await q(`UPDATE editorial_spend SET state = 'released', settled_at = now() WHERE batch_id = $1 AND state = 'reserved'`, [batchId]);
}

export async function markUncertain(q: Query, batchId: string) {
  await q(`UPDATE editorial_spend SET state = 'uncertain' WHERE batch_id = $1 AND state = 'reserved'`, [batchId]);
}

export function formatMicros(micros: bigint | null, currency: string | null): string {
  if (micros === null) return "—";
  const negative = micros < 0n;
  const abs = negative ? -micros : micros;
  const units = abs / 1_000_000n;
  const cents = (abs % 1_000_000n) / 10_000n;
  return `${negative ? "-" : ""}${units}.${String(cents).padStart(2, "0")} ${currency ?? ""}`.trim();
}
