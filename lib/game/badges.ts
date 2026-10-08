// Tiers computed from a running total rather than a stored badge catalog —
// porteur-requested simplicity (project.md, défi entre amis): adjustable by
// editing this list, no database migration needed to add/change a tier.
export interface BadgeTier {
  key: "bronze" | "silver" | "gold" | "platinum";
  threshold: number;
}

export const BADGE_TIERS: readonly BadgeTier[] = [
  { key: "bronze", threshold: 500 },
  { key: "silver", threshold: 2000 },
  { key: "gold", threshold: 5000 },
  { key: "platinum", threshold: 10000 },
];

export function currentBadge(totalPoints: number): BadgeTier | null {
  let current: BadgeTier | null = null;
  for (const tier of BADGE_TIERS) {
    if (totalPoints >= tier.threshold) current = tier;
  }
  return current;
}

export function nextBadge(totalPoints: number): BadgeTier | null {
  return BADGE_TIERS.find((tier) => totalPoints < tier.threshold) ?? null;
}
