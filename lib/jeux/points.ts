// Points des jeux et classement entre membres. Le navigateur n'envoie jamais un score :
// il envoie ses réponses et la graine de la partie, le serveur rejoue la manche et note.
// Seule la première partie du jour de chaque jeu rapporte des points (clé primaire de
// game_scores), ce qui borne le total quotidien et rend le rejeu sans intérêt pour tricher.

import type { Query } from "../editorial/types.ts";
import { friseGame, markAnswers, markFrises, previousDay, questionRound, type Game } from "./tirage.ts";

/** Barème : le défi du jour pèse lourd, les jeux libres complètent. */
export const DAILY_POINTS = 10;
export const DAILY_PERFECT_BONUS = 30;
export const FREE_POINTS = 2;

export function pointsFor(game: Game, correct: number, total: number): number {
  if (game === "defi") return correct * DAILY_POINTS + (correct === total ? DAILY_PERFECT_BONUS : 0);
  return correct * FREE_POINTS;
}

/** Date du jour à Paris, AAAA-MM-JJ : le jour de jeu de tout le monde. */
export function parisDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Le lundi de la semaine d'une date AAAA-MM-JJ : début du classement hebdomadaire. */
export function weekStart(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export interface Submission {
  game: Game;
  seed: string;
  theme?: string;
  /** Jour joué (défi du jour) : aujourd'hui, ou la veille si la partie a enjambé minuit. */
  day?: string;
  /** Questions : l'index choisi à chaque question. Frise : pour chaque frise, les index d'événements dans l'ordre proposé. */
  picks: number[] | number[][];
}

export type Graded = { ok: true; day: string; marks: boolean[] } | { ok: false; message: string };

/** Rejoue la partie décrite et note les réponses. Ne touche pas à la base. */
export function grade(submission: Submission, today: string): Graded {
  const invalid = { ok: false as const, message: "Partie invalide." };
  if (submission.game === "frise") {
    const frises = friseGame(submission.seed);
    const picks = submission.picks;
    if (picks.length !== frises.length) return invalid;
    for (const [f, order] of picks.entries()) {
      const size = frises[f].events.length;
      if (!Array.isArray(order) || order.length !== size || new Set(order).size !== size || order.some((k) => !Number.isInteger(k) || k < 0 || k >= size)) return invalid;
    }
    return { ok: true, day: today, marks: markFrises(frises, picks as number[][]) };
  }
  let day = today;
  if (submission.game === "defi" && submission.day && submission.day !== today) {
    if (submission.day !== previousDay(today)) return { ok: false, message: "Ce défi n'est plus ouvert." };
    day = submission.day;
  }
  const round = questionRound(submission.game, { seed: submission.seed, theme: submission.theme, day });
  const picks = submission.picks;
  if (round.length === 0 || picks.length !== round.length || picks.some((p) => !Number.isInteger(p))) return invalid;
  return { ok: true, day, marks: markAnswers(round, picks as number[]) };
}

export interface Recorded {
  /** Faux si une partie de ce jeu avait déjà été comptée ce jour-là. */
  counted: boolean;
  points: number;
  correct: number;
  total: number;
}

export async function recordScore(q: Query, userId: string, game: Game, day: string, marks: boolean[]): Promise<Recorded> {
  const correct = marks.filter(Boolean).length;
  const total = marks.length;
  const points = pointsFor(game, correct, total);
  const inserted = await q(
    `INSERT INTO game_scores (user_id, day, game, correct, total, points, marks)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, day, game) DO NOTHING
     RETURNING points`,
    [userId, day, game, correct, total, points, marks.map((m) => (m ? "1" : "0")).join("")],
  );
  return { counted: inserted.length > 0, points: inserted.length > 0 ? points : 0, correct, total };
}

export interface Ranked {
  rank: number;
  handle: string;
  displayName: string;
  avatarId: string | null;
  points: number;
}

// Seuls les membres actifs et inscrits figurent au classement.
const TOTALS = `
  SELECT s.user_id, sum(s.points)::int AS points, min(s.created_at) AS first_at
  FROM game_scores s JOIN users u ON u.id = s.user_id
  WHERE u.status = 'active' AND u.handle IS NOT NULL AND ($1::date IS NULL OR s.day >= $1::date)
  GROUP BY s.user_id`;

/** Les meilleurs totaux depuis `since` (AAAA-MM-JJ), ou depuis toujours si nul. À égalité, le premier arrivé devance. */
export async function leaderboard(q: Query, since: string | null, limit = 10): Promise<Ranked[]> {
  const rows = await q<{ handle: string; display_name: string | null; avatar_image_id: string | null; points: number }>(
    `WITH totals AS (${TOTALS})
     SELECT u.handle, u.display_name, u.avatar_image_id, t.points
     FROM totals t JOIN users u ON u.id = t.user_id
     WHERE t.points > 0
     ORDER BY t.points DESC, t.first_at ASC
     LIMIT $2`,
    [since, limit],
  );
  return rows.map((r, i) => ({ rank: i + 1, handle: r.handle, displayName: r.display_name || r.handle, avatarId: r.avatar_image_id, points: r.points }));
}

/** Total et rang d'un membre sur la même période ; nul s'il n'a encore rien marqué. */
export async function standing(q: Query, userId: string, since: string | null): Promise<{ points: number; rank: number } | null> {
  const [row] = await q<{ points: number; rank: number }>(
    `WITH totals AS (${TOTALS})
     SELECT t.points,
            (SELECT count(*)::int FROM totals o WHERE o.points > t.points OR (o.points = t.points AND o.first_at < t.first_at)) + 1 AS rank
     FROM totals t WHERE t.user_id = $2 AND t.points > 0`,
    [since, userId],
  );
  return row ?? null;
}

/** Le défi du jour déjà joué par ce membre (détail des réponses et série de jours consécutifs), sinon nul. */
export async function dailyResult(q: Query, userId: string, day: string): Promise<{ day: string; marks: boolean[]; streak: number } | null> {
  const rows = await q<{ day: string; marks: string }>(
    `SELECT day::text AS day, marks FROM game_scores
     WHERE user_id = $1 AND game = 'defi' AND day <= $2::date
     ORDER BY day DESC LIMIT 400`,
    [userId, day],
  );
  if (rows[0]?.day !== day) return null;
  let streak = 0;
  for (let expected = day; rows[streak]?.day === expected; expected = previousDay(expected)) streak++;
  return { day, marks: [...rows[0].marks].map((c) => c === "1"), streak };
}
