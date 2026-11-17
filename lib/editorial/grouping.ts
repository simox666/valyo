import { overlap, quantities } from "./lexical.ts";

// Regroupement, règle 3 (decisions.md §3.3) : même émetteur, même objet et dates à moins
// de 72 heures d'écart, confirmé par une COMPARAISON DES CONTENUS.
//
// La comparaison est injectable (deps.compare) : le comparateur lexical ci-dessous est un
// garde-fou déterministe, PAS une compréhension sémantique. Il est volontairement
// prudent : le doute produit `doublon_incertain` (examen humain), jamais une fusion.
// Une fusion confirmée n'est pas destructrice : les deux sujets et tous les documents
// sont conservés (statut `merged` + `merged_into_subject_id`), un administrateur peut
// la défaire en base.

export interface GroupingItem {
  subjectId: string;
  title: string;
  /** Contenu comparable : titres et résumés/textes des documents du sujet. */
  text: string;
  publishedAt: Date | null;
}

export interface GroupingEvidence {
  regle: 3;
  recouvrementTitres: number;
  recouvrementTextes: number;
  score: number;
  ecartHeures: number | null;
  quantitesSansEcho: string[];
  detail: string;
}

export type GroupingVerdict = { kind: "merge" | "uncertain" | "distinct"; evidence: GroupingEvidence };

export type GroupingComparator = (a: GroupingItem, b: GroupingItem) => GroupingVerdict;

/** Fenêtre de la règle 3 : dates à moins de 72 heures d'écart. */
export const GROUPING_WINDOW_HOURS = 72;
/** Au-dessus : même annonce confirmée (sans quantité contradictoire). */
export const MERGE_SCORE = 0.75;
/** Entre les deux : regroupement douteux, examen humain. */
export const UNCERTAIN_SCORE = 0.5;

const round = (n: number) => Math.round(n * 100) / 100;

/** Recouvrement symétrique des mots porteurs de sens. */
function symOverlap(a: string, b: string): number {
  return (overlap(a, b) + overlap(b, a)) / 2;
}

/** Quantités citées d'un côté et absentes de l'autre : indice d'actualisations distinctes. */
function unechoedQuantities(a: GroupingItem, b: GroupingItem): string[] {
  const inA = new Set(quantities(`${a.title} ${a.text}`));
  const inB = new Set(quantities(`${b.title} ${b.text}`));
  return [...[...inA].filter((q) => !inB.has(q)), ...[...inB].filter((q) => !inA.has(q))];
}

export const compareForGrouping: GroupingComparator = (a, b) => {
  const ecartHeures =
    a.publishedAt && b.publishedAt ? round(Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime()) / 3_600_000) : null;
  const recouvrementTitres = round(symOverlap(a.title, b.title));
  const recouvrementTextes = round(symOverlap(a.text, b.text));
  // Les titres pèsent double : c'est là que l'objet de l'annonce se concentre.
  const score = round((recouvrementTitres * 2 + recouvrementTextes) / 3);
  const quantitesSansEcho = unechoedQuantities(a, b);
  const base: Omit<GroupingEvidence, "detail"> = { regle: 3, recouvrementTitres, recouvrementTextes, score, ecartHeures, quantitesSansEcho };

  if (ecartHeures === null || ecartHeures > GROUPING_WINDOW_HOURS) {
    return { kind: "distinct", evidence: { ...base, detail: "dates absentes ou écart supérieur à 72 h : hors règle 3" } };
  }
  if (score >= MERGE_SCORE && quantitesSansEcho.length === 0) {
    return { kind: "merge", evidence: { ...base, detail: "même annonce : contenus concordants, aucune quantité sans écho" } };
  }
  if (score >= MERGE_SCORE) {
    return {
      kind: "uncertain",
      evidence: { ...base, detail: "contenus proches mais quantités sans écho : actualisations possiblement distinctes, examen humain" },
    };
  }
  if (score >= UNCERTAIN_SCORE) {
    return { kind: "uncertain", evidence: { ...base, detail: "ressemblance partielle : regroupement douteux, examen humain" } };
  }
  return { kind: "distinct", evidence: { ...base, detail: "contenus différents" } };
};
