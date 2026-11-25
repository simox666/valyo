// « À l'échelle » : placer un objet à sa place sur une règle, entre le plus petit et le plus grand
// de sa série. Les séries sont celles des grandeurs (lib/jeux/classements.ts) ; la règle est
// logarithmique dès que la série couvre plus d'un ordre de grandeur (chaque graduation = dix fois plus),
// linéaire sinon. Tirage pur et à graine : le navigateur joue, le serveur rejoue et note.

import { SIZE_SETS, type RankedItem, type RankedSet } from "./classements.ts";
import { seededRandom, shuffle, type Random } from "./tirage.ts";

export const ECHELLE_BOARDS = 2;
export const ECHELLE_ITEMS = 3;
/** Écart toléré entre la position proposée et la vraie, en centièmes de la règle. */
export const ECHELLE_TOLERANCE = 8;

export interface ScaleTick {
  /** Position sur la règle, de 0 (le plus petit) à 100 (le plus grand). */
  pos: number;
  label: string;
}

export interface ScaleBoard {
  title: string;
  theme: string;
  log: boolean;
  /** Les deux repères donnés : le plus petit et le plus grand de la série. */
  low: RankedItem;
  high: RankedItem;
  /** Les objets à placer, dans l'ordre où ils sont proposés. */
  items: RankedItem[];
  /** Position exacte de chaque objet à placer (0 à 100). */
  answers: number[];
  ticks: ScaleTick[];
}

const range = (set: RankedSet) => ({ min: set.items[0].n, max: set.items[set.items.length - 1].n });

/** Règle logarithmique : valeurs toutes positives et un rapport d'au moins 20 entre les extrêmes. */
export function isLog(set: RankedSet): boolean {
  const { min, max } = range(set);
  return min > 0 && max / min >= 20;
}

/** Une série se joue si elle laisse assez d'objets entre ses deux extrêmes, sur une règle lisible. */
export function playable(set: RankedSet): boolean {
  const { min, max } = range(set);
  if (set.items.length < ECHELLE_ITEMS + 2) return false;
  // Règle linéaire : jouable seulement si le deuxième objet se détache du premier (une série qui va
  // de −196 °C à 15 millions de degrés écraserait tout en bas de la règle).
  return isLog(set) || (set.items[1].n - min) / (max - min) >= 0.02;
}

export const SCALE_SETS = SIZE_SETS.filter(playable);

export function position(set: RankedSet, n: number): number {
  const { min, max } = range(set);
  const p = isLog(set) ? Math.log(n / min) / Math.log(max / min) : (n - min) / (max - min);
  return Math.round(p * 1000) / 10;
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
function timesLabel(k: number): string {
  if (k <= 3) return `×${new Intl.NumberFormat("fr-FR").format(10 ** k)}`;
  if (k === 6) return "×1 million";
  if (k === 9) return "×1 milliard";
  return `×10${[...String(k)].map((d) => SUPERSCRIPT[Number(d)]).join("")}`;
}

/** Graduations : une par puissance de dix au-dessus du plus petit (règle logarithmique), sinon les quarts. */
export function ticksOf(set: RankedSet): ScaleTick[] {
  if (!isLog(set)) return [25, 50, 75].map((pos) => ({ pos, label: "" }));
  const { min, max } = range(set);
  const decades = Math.log10(max / min);
  const step = decades > 9 ? 3 : decades > 5 ? 2 : 1;
  const ticks: ScaleTick[] = [];
  for (let k = step; k < decades - 0.15; k += step) ticks.push({ pos: Math.round((k / decades) * 1000) / 10, label: timesLabel(k) });
  return ticks;
}

function boardFrom(set: RankedSet, rnd: Random): ScaleBoard {
  const inner = set.items.slice(1, -1);
  const items = shuffle(inner, rnd).slice(0, ECHELLE_ITEMS);
  return {
    title: set.title,
    theme: set.theme,
    log: isLog(set),
    low: set.items[0],
    high: set.items[set.items.length - 1],
    items,
    answers: items.map((item) => position(set, item.n)),
    ticks: ticksOf(set),
  };
}

export function echelleGame(seed: string): ScaleBoard[] {
  const rnd = seededRandom(`echelle-${seed}`);
  return shuffle(SCALE_SETS, rnd).slice(0, ECHELLE_BOARDS).map((set) => boardFrom(set, rnd));
}

/** Une case par objet : `picks[b][i]` est la position proposée (0 à 100) pour l'objet i de la règle b. */
export function markEchelle(boards: readonly ScaleBoard[], picks: readonly (readonly number[])[]): boolean[] {
  return boards.flatMap((board, b) => board.answers.map((answer, i) => Math.abs((picks[b]?.[i] ?? -999) - answer) <= ECHELLE_TOLERANCE));
}
