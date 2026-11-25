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
  /** Pour aller plus loin après la réponse (quiz de la semaine : l'article d'où vient la question). */
  link?: { href: string; label: string };
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
/** Un quiz de thème : 3 questions à choix et 2 vrai ou faux, tirés dans la banque du thème. */
export const QUIZ_MCQ = 3;
export const QUIZ_VF = 2;
export const FRISE_EVENTS = 4;
export const VF_ROUND = 8;
export const DUEL_ROUND = 8;
export const FRISE_ROUND = 3;

/** Thème fictif du quiz libre « tous les thèmes ». */
export const ALL_THEMES = "tous";

// « vf » et « duel » n'ont plus de carte sur la page Jeux (leurs questions vivent dans les quiz et le défi du jour),
// mais le serveur sait toujours les noter.
export const GAMES = ["defi", "quiz", "vf", "duel", "frise", "hebdo", "echelle", "courbe"] as const;
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

/** Quiz d'un thème : quelques QCM et vrai/faux tirés dans sa banque, différents d'une partie à l'autre. */
export function themeRound(theme: string, rnd: Random | null): PlayableQuestion[] {
  const within = (t: string) => theme === ALL_THEMES || t === theme;
  const mcq = mix(QUIZ_QUESTIONS.filter((q) => within(q.theme)), rnd).slice(0, QUIZ_MCQ).map((q) => fromQuiz(q, rnd));
  const vf = mix(TRUE_FALSE_STATEMENTS.filter((s) => within(s.theme)), rnd).slice(0, QUIZ_VF).map(fromStatement);
  return mix([...mcq, ...vf], rnd);
}

/** Vrai ou faux express : des affirmations de tous les thèmes. */
export function trueFalseRound(count: number, rnd: Random): PlayableQuestion[] {
  return shuffle(TRUE_FALSE_STATEMENTS, rnd).slice(0, count).map(fromStatement);
}

const frNumber = (n: number, digits: number) => new Intl.NumberFormat("fr-FR", { maximumSignificantDigits: digits }).format(n);

/** « environ 3 fois plus », « un écart de 8 % »… : ce que les deux valeurs d'un duel donnent une fois comparées. */
export function ratioNote(small: number, big: number): string {
  if (!(small > 0) || !(big > small)) return "";
  const r = big / small;
  if (r < 1.5) return `un écart de ${Math.round((r - 1) * 100)} % seulement`;
  if (r >= 1e9) return "des milliards de fois plus";
  if (r >= 1e6) return "des millions de fois plus";
  return `environ ${frNumber(r, r < 10 ? 2 : r < 100 ? 2 : 1)} fois plus`;
}

// Un duel oppose deux éléments voisins dans leur série (rangs consécutifs, ou séparés d'un seul) :
// comparer un guépard à la lumière n'apprend rien, un TGV à un avion fait hésiter.
function duelFrom(set: RankedSet, rnd: Random): PlayableQuestion {
  const gap = set.items.length > 2 && rnd() < 0.35 ? 2 : 1;
  const low = Math.floor(rnd() * (set.items.length - gap));
  const pair = [set.items[low], set.items[low + gap]];
  const [first, second] = rnd() < 0.5 ? pair : [pair[1], pair[0]];
  const note = set.noRatio ? "" : ratioNote(pair[0].n, pair[1].n);
  return {
    prompt: set.question,
    choices: [first.label, second.label],
    answer: first.n > second.n ? 0 : 1,
    explain: `${first.label} : ${first.display} · ${second.label} : ${second.display}${note ? ` — ${note}` : ""}.`,
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

/** Numéro d'un jour AAAA-MM-JJ (jours écoulés depuis le 1ᵉʳ janvier 2026). */
function dayNumber(day: string): number {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse("2026-01-01T12:00:00Z")) / 86_400_000);
}

/**
 * Les `perDay` éléments du jour, sans répétition : la banque est mélangée une fois par cycle
 * puis servie par tranches, si bien qu'une question ne revient qu'une fois la banque épuisée.
 */
export function scheduled<T>(pool: readonly T[], perDay: number, day: string, salt: string): T[] {
  const cycleDays = Math.max(1, Math.floor(pool.length / perDay));
  const n = dayNumber(day);
  const cycle = Math.floor(n / cycleDays);
  const position = n - cycle * cycleDays;
  return shuffle(pool, seededRandom(`${salt}-${cycle}`)).slice(position * perDay, (position + 1) * perDay);
}

/** Le défi du jour : identique pour tous à une date donnée (AAAA-MM-JJ, heure de Paris). */
export function dailyChallenge(day: string): PlayableQuestion[] {
  const rnd = seededRandom(`valyo-defi-${day}`);
  const mcq = scheduled(QUIZ_QUESTIONS, 3, day, "defi-qcm").map((q) => fromQuiz(q, rnd));
  const vf = scheduled(TRUE_FALSE_STATEMENTS, 2, day, "defi-vf").map(fromStatement);
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
export function questionRound(game: "defi" | "quiz" | "vf" | "duel", opts: { seed: string; theme?: string; day: string }): PlayableQuestion[] {
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
