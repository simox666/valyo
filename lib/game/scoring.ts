export interface ScoreResult {
  points: number; // 0-100
  withinRange: boolean;
}

// There's no single "true" price to compare a guess against — our own
// pipeline's estimated range IS the answer key (see lib/game/items.ts,
// scripts/generate-game-data.cjs). A guess inside that range scores full
// points; the further outside it lands, relative to the range's midpoint,
// the more points decay. This is a defensible heuristic, not a claim of
// precision — matches the product principle of honest ranges over false
// exactness.
export function scoreGuess(guess: number, low: number, high: number): ScoreResult {
  if (guess >= low && guess <= high) {
    return { points: 100, withinRange: true };
  }
  const mid = (low + high) / 2;
  const distanceOutside = guess < low ? low - guess : guess - high;
  const relativeError = mid > 0 ? distanceOutside / mid : 1;
  const points = Math.round(Math.max(0, 100 - relativeError * 150));
  return { points, withinRange: false };
}
