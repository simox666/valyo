// Tirage des manches de jeu. Tout est pur et paramétré par un générateur aléatoire :
// `Math.random` pour une partie libre, un générateur à graine pour le défi du jour
// (la même date donne les mêmes questions à tout le monde, serveur comme navigateur).

import { DATE_SETS, SIZE_SETS, type RankedItem, type RankedSet } from "./classements.ts";
import { QUIZ_QUESTIONS, TRUE_FALSE_STATEMENTS, type QuizQuestion, type TrueFalseStatement } from "./questions.ts";

export type Random = () => number;

export interface PlayableQuestion {
  prompt: string;
  choices: string[];
  answer: number;
  explain: string;
  /** Slug du thème d'origine. */
  theme: string;
}

export interface Frise {
  title: string;
  theme: string;
  /** Événements dans l'ordre d'affichage (mélangé). */
  events: RankedItem[];
  /** Les mêmes, du plus ancien au plus récent. */
  solution: RankedItem[];
}

export const DAILY_SIZE = 7;
export const FRISE_EVENTS = 4;
export const VF_ROUND = 8;
export const DUEL_ROUND = 8;
export const FRISE_ROUND = 3;

export const GAMES = ["defi", "quiz", "vf", "duel", "frise"] as const;
export type Game = (typeof GAMES)[number];

/** Générateur déterministe (hachage de la graine puis mulberry32). */
export function seededRandom(seed: string): Random {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rnd: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// `rnd` nul = ordre du fichier : sert à la toute première manche rendue côté serveur,
// pour que le navigateur retrouve exactement le même HTML à l'hydratation.
const mix = <T,>(items: readonly T[], rnd: Random | null): T[] => (rnd ? shuffle(items, rnd) : [...items]);

function fromQuiz(q: QuizQuestion, rnd: Random | null): PlayableQuestion {
  const order = mix(q.choices.map((_, i) => i), rnd);
  return { prompt: q.question, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer), explain: q.explain, theme: q.theme };
}

function fromStatement(s: TrueFalseStatement): PlayableQuestion {
  return { prompt: s.statement, choices: ["Vrai", "Faux"], answer: s.isTrue ? 0 : 1, explain: s.explain, theme: s.theme };
}

/** Quiz d'un thème : ses QCM et ses vrai/faux. */
export function themeRound(theme: string, rnd: Random | null): PlayableQuestion[] {
  const mcq = QUIZ_QUESTIONS.filter((q) => q.theme === theme).map((q) => fromQuiz(q, rnd));
  const vf = TRUE_FALSE_STATEMENTS.filter((s) => s.theme === theme).map(fromStatement);
  return mix([...mcq, ...vf], rnd);
}

/** Vrai ou faux express : des affirmations de tous les thèmes. */
export function trueFalseRound(count: number, rnd: Random): PlayableQuestion[] {
  return shuffle(TRUE_FALSE_STATEMENTS, rnd).slice(0, count).map(fromStatement);
}

function duelFrom(set: RankedSet, rnd: Random): PlayableQuestion {
  const [first, second] = shuffle(set.items, rnd);
  const bigger = first.n > second.n ? 0 : 1;
  return {
    prompt: set.question,
    choices: [first.label, second.label],
    answer: bigger,
    explain: `${first.label} : ${first.display} · ${second.label} : ${second.display}.`,
    theme: set.theme,
  };
}

/** Plus ou moins : des duels entre deux éléments d'une même série de grandeurs. */
export function duelRound(count: number, rnd: Random): PlayableQuestion[] {
  const sets = shuffle(SIZE_SETS, rnd);
  const seen = new Set<string>();
  const duels: PlayableQuestion[] = [];
  for (let k = 0; duels.length < count && k < count * 10; k++) {
    const duel = duelFrom(sets[k % sets.length], rnd);
    const key = [...duel.choices].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    duels.push(duel);
  }
  return duels;
}

/** La frise : pour chaque manche, quelques événements d'une série à remettre dans l'ordre. */
export function friseRound(count: number, rnd: Random): Frise[] {
  return shuffle(DATE_SETS, rnd).slice(0, count).map((set) => {
    const events = shuffle(set.items, rnd).slice(0, FRISE_EVENTS);
    return { title: set.title, theme: set.theme, events, solution: [...events].sort((a, b) => a.n - b.n) };
  });
}

/** Combien d'événements sont à la bonne place dans l'ordre proposé. */
export function friseScore(frise: Frise, proposed: readonly RankedItem[]): number {
  return frise.solution.filter((event, i) => proposed[i] === event).length;
}

/** Le défi du jour : identique pour tous à une date donnée (AAAA-MM-JJ, heure de Paris). */
export function dailyChallenge(day: string): PlayableQuestion[] {
  const rnd = seededRandom(`valyo-defi-${day}`);
  const themes = new Set<string>();
  const pickDistinct = <T extends { theme: string }>(pool: readonly T[], count: number): T[] => {
    const picked: T[] = [];
    for (const item of shuffle(pool, rnd)) {
      if (picked.length === count) break;
      if (themes.has(item.theme)) continue;
      themes.add(item.theme);
      picked.push(item);
    }
    return picked;
  };
  const mcq = pickDistinct(QUIZ_QUESTIONS, 3).map((q) => fromQuiz(q, rnd));
  const vf = pickDistinct(TRUE_FALSE_STATEMENTS, 2).map(fromStatement);
  const duels = duelRound(DAILY_SIZE - mcq.length - vf.length, rnd);
  return shuffle([...mcq, ...vf, ...duels], rnd);
}

/** La veille d'une date AAAA-MM-JJ (pour la série de jours consécutifs). */
export function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * La manche de questions d'une partie, reconstruite à l'identique à partir de sa graine :
 * le navigateur la joue, le serveur la rejoue pour noter les réponses. Graine vide pour
 * un quiz = ordre du fichier (première manche rendue côté serveur).
 */
export function questionRound(game: Exclude<Game, "frise">, opts: { seed: string; theme?: string; day: string }): PlayableQuestion[] {
  if (game === "defi") return dailyChallenge(opts.day);
  if (game === "quiz") return themeRound(opts.theme ?? "", opts.seed ? seededRandom(`quiz-${opts.seed}`) : null);
  if (game === "vf") return trueFalseRound(VF_ROUND, seededRandom(`vf-${opts.seed}`));
  return duelRound(DUEL_ROUND, seededRandom(`duel-${opts.seed}`));
}

export function friseGame(seed: string): Frise[] {
  return friseRound(FRISE_ROUND, seededRandom(`frise-${seed}`));
}

/** Une case par question : la réponse choisie est-elle la bonne ? */
export function markAnswers(round: readonly PlayableQuestion[], picks: readonly number[]): boolean[] {
  return round.map((q, i) => picks[i] === q.answer);
}

/** Une case par événement : `picks[f]` donne, pour la frise f, les index d'événements dans l'ordre proposé. */
export function markFrises(frises: readonly Frise[], picks: readonly (readonly number[])[]): boolean[] {
  return frises.flatMap((frise, f) => frise.solution.map((event, i) => frise.events[picks[f]?.[i] ?? -1] === event));
}
