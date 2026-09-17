import type { ObjectAnalysis } from "@/lib/schema";
import raw from "./items.generated.json";

export interface GameItem {
  id: string;
  file: string;
  credit: string;
  analysis: ObjectAnalysis;
}

const items = raw as unknown as GameItem[];

export interface TargetRange {
  low: number;
  high: number;
}

// Builds the "answer key" range for scoring from whatever our own pipeline
// actually produced for this item — not every item has a full low/high
// second-hand estimate (see project.md, principe 4: no fabricated range).
export function targetRange(item: GameItem): TargetRange {
  const { estimated_value_low, estimated_value_high, retail_price_new } = item.analysis;

  if (estimated_value_low !== null && estimated_value_high !== null) {
    return { low: estimated_value_low, high: estimated_value_high };
  }
  if (estimated_value_low !== null) {
    return { low: estimated_value_low, high: estimated_value_low * 1.3 };
  }
  if (estimated_value_high !== null) {
    return { low: estimated_value_high * 0.7, high: estimated_value_high };
  }
  if (retail_price_new !== null) {
    // Only a point retail price, no second-hand range — a modest tolerance
    // band instead of demanding an exact match.
    return { low: retail_price_new * 0.85, high: retail_price_new * 1.15 };
  }
  throw new Error(`Game item ${item.id} has no usable price — should have been filtered out at generation time`);
}

function shuffled<T>(input: T[]): T[] {
  const pool = [...input];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function pickRounds(count: number): GameItem[] {
  return shuffled(items).slice(0, Math.min(count, items.length));
}

export function allItems(): GameItem[] {
  return items;
}
