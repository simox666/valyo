// Sortes de réactions rapides : module pur, partagé entre serveur et navigateur.
export const REACTIONS = [
  { kind: "interessant", emoji: "👍", label: "Intéressant" },
  { kind: "appris", emoji: "💡", label: "J'ai appris" },
  { kind: "a_creuser", emoji: "🔎", label: "À creuser" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];
export const REACTION_KINDS = REACTIONS.map((r) => r.kind) as [ReactionKind, ...ReactionKind[]];

export interface ReactionSummary {
  counts: Record<ReactionKind, number>;
  mine: ReactionKind[];
}
