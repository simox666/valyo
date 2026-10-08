// Scoring against a single real price the challenge creator entered
// themselves — not a range from our own pipeline (that's the old
// lib/game/scoring.ts, for the AI-estimated solo game this replaces).
// Relative error keeps scoring fair whether the object is worth €5 or
// €5000, rather than an absolute euro tolerance that would be meaningless
// at either extreme.
export interface PriceScoreResult {
  points: number;
  withinTolerance: boolean;
}

const PERFECT_TOLERANCE = 0.05; // within 5% of the real price = full points
const ZERO_POINTS_AT = 1.0; // 100%+ off (double the price or more, or free-fall to 0) = no points

export function scoreGuessAgainstPrice(guess: number, truePrice: number): PriceScoreResult {
  if (truePrice <= 0) {
    // Degenerate but real case (project.md, correction du 1er octobre on
    // near-zero-value items): a guess within 1 currency unit of a
    // genuinely worthless object still counts as a hit.
    const withinTolerance = guess <= 1;
    const points = withinTolerance ? 100 : Math.max(0, Math.round(100 - guess * 10));
    return { points, withinTolerance };
  }

  const relativeError = Math.abs(guess - truePrice) / truePrice;
  if (relativeError <= PERFECT_TOLERANCE) return { points: 100, withinTolerance: true };
  if (relativeError >= ZERO_POINTS_AT) return { points: 0, withinTolerance: false };

  const points = Math.round(100 * (1 - (relativeError - PERFECT_TOLERANCE) / (ZERO_POINTS_AT - PERFECT_TOLERANCE)));
  return { points, withinTolerance: false };
}
