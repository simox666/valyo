// Points des jeux et classement : le serveur rejoue la partie à partir de sa graine,
// seule la première partie du jour de chaque jeu compte, et la suppression du compte
// efface les scores. PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyResult, dailyStats, grade, leaderboard, playerCount, pointsFor, recordScore, standing, weekStart } from "../lib/jeux/points.ts";
import { dailyChallenge, friseGame, questionRound, DAILY_SIZE, FRISE_EVENTS, FRISE_ROUND } from "../lib/jeux/tirage.ts";
import { eraseAccount } from "../lib/social/account.ts";
import { createTestDb } from "./editorial-helpers.ts";

const TODAY = "2026-11-23"; // un lundi

test("barème : le défi pèse lourd, bonus au sans-faute", () => {
  assert.equal(pointsFor("defi", DAILY_SIZE, DAILY_SIZE), 100);
  assert.equal(pointsFor("defi", 5, DAILY_SIZE), 50);
  // Jeux libres : même maximum pour tous, au prorata des bonnes réponses.
  assert.equal(pointsFor("vf", 8, 8), 5);
  assert.equal(pointsFor("frise", 12, 12), 5);
  assert.equal(pointsFor("quiz", 5, 5), 5);
  assert.equal(pointsFor("quiz", 3, 5), 3);
  assert.equal(pointsFor("duel", 0, 8), 0);
  assert.equal(weekStart("2026-11-23"), "2026-11-23");
  assert.equal(weekStart("2026-11-29"), "2026-11-23");
  assert.equal(weekStart("2026-12-01"), "2026-11-30");
});

test("le serveur rejoue la manche : bonnes réponses, erreurs, parties invalides", () => {
  const round = dailyChallenge(TODAY);
  const perfect = grade({ game: "defi", seed: "", picks: round.map((q) => q.answer) }, TODAY);
  assert.ok(perfect.ok && perfect.marks.every(Boolean) && perfect.day === TODAY);
  const wrong = grade({ game: "defi", seed: "", picks: round.map((q) => (q.answer + 1) % q.choices.length) }, TODAY);
  assert.ok(wrong.ok && wrong.marks.every((m) => !m));
  assert.equal(grade({ game: "defi", seed: "", picks: [0, 1] }, TODAY).ok, false, "longueur fausse");

  // Un défi commencé avant minuit reste valable le lendemain, pas au-delà.
  const late = grade({ game: "defi", seed: "", day: "2026-11-22", picks: dailyChallenge("2026-11-22").map((q) => q.answer) }, TODAY);
  assert.ok(late.ok && late.day === "2026-11-22" && late.marks.every(Boolean));
  assert.equal(grade({ game: "defi", seed: "", day: "2026-11-20", picks: round.map((q) => q.answer) }, TODAY).ok, false);

  // Jeux libres : la graine suffit à retrouver la manche.
  for (const game of ["vf", "duel"] as const) {
    const r = questionRound(game, { seed: "abc123", day: TODAY });
    const g = grade({ game, seed: "abc123", picks: r.map((q) => q.answer) }, TODAY);
    assert.ok(g.ok && g.marks.length === 8 && g.marks.every(Boolean), game);
    const other = grade({ game, seed: "zzz", picks: r.map((q) => q.answer) }, TODAY);
    assert.ok(other.ok && !other.marks.every(Boolean), `${game} : une autre graine donne une autre manche`);
  }
  const quiz = questionRound("quiz", { seed: "s1", theme: "espace", day: TODAY });
  const gq = grade({ game: "quiz", seed: "s1", theme: "espace", picks: quiz.map((q) => q.answer) }, TODAY);
  assert.ok(gq.ok && gq.marks.length === 5 && gq.marks.every(Boolean));
  assert.equal(grade({ game: "quiz", seed: "s1", theme: "inconnu", picks: [0] }, TODAY).ok, false);

  // Frise : chaque proposition doit être une permutation des événements.
  const frises = friseGame("f1");
  const right = frises.map((f) => f.solution.map((e) => f.events.indexOf(e)));
  const gf = grade({ game: "frise", seed: "f1", picks: right }, TODAY);
  assert.ok(gf.ok && gf.marks.length === FRISE_ROUND * FRISE_EVENTS && gf.marks.every(Boolean));
  assert.equal(grade({ game: "frise", seed: "f1", picks: right.map(() => [0, 0, 0, 0]) }, TODAY).ok, false);
  assert.equal(grade({ game: "frise", seed: "f1", picks: right.slice(1) }, TODAY).ok, false);
});

test("points, classement, rang, série et suppression de compte", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) =>
    (await db.query<{ id: string }>(
      `INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ($1, $2, $3, now()) RETURNING id`,
      [`${h}@exemple.fr`, h, h.toUpperCase()],
    ))[0].id;
  const [ana, ben, cyd] = [await user("ana"), await user("ben"), await user("cyd")];
  const all = (n: number, ok: number) => Array.from({ length: n }, (_, i) => i < ok);

  // Première partie comptée, la seconde du même jeu le même jour ne rapporte rien.
  assert.deepEqual(await recordScore(db.query, ana, "defi", TODAY, all(7, 7)), { counted: true, points: 100, correct: 7, total: 7, streakBonus: 0 });
  assert.deepEqual(await recordScore(db.query, ana, "defi", TODAY, all(7, 1)), { counted: false, points: 0, correct: 1, total: 7, streakBonus: 0 });
  assert.equal((await recordScore(db.query, ana, "vf", TODAY, all(8, 4))).points, 3);
  // Un quiz compte une fois par jour et par thème.
  assert.equal((await recordScore(db.query, ana, "quiz", TODAY, all(5, 5), "espace")).points, 5);
  assert.equal((await recordScore(db.query, ana, "quiz", TODAY, all(5, 5), "espace")).counted, false);
  assert.equal((await recordScore(db.query, ana, "quiz", TODAY, all(5, 0), "ia")).counted, true);
  await recordScore(db.query, ben, "defi", TODAY, all(7, 5)); // 50
  await recordScore(db.query, ben, "defi", "2026-11-20", all(7, 7)); // 100, semaine précédente
  await recordScore(db.query, cyd, "defi", TODAY, all(7, 0)); // 0 point : absent du classement

  const week = await leaderboard(db.query, weekStart(TODAY));
  assert.deepEqual(week.map((r) => [r.rank, r.handle, r.points]), [[1, "ana", 108], [2, "ben", 50]]);
  assert.equal(week[0].displayName, "ANA");
  const allTime = await leaderboard(db.query, null);
  assert.deepEqual(allTime.map((r) => [r.handle, r.points]), [["ben", 150], ["ana", 108]]);
  assert.deepEqual(await standing(db.query, ben, weekStart(TODAY)), { points: 50, rank: 2 });
  assert.deepEqual(await standing(db.query, ben, null), { points: 150, rank: 1 });
  assert.equal(await standing(db.query, cyd, null), null);

  // Défi du jour retrouvé côté serveur, avec la série de jours consécutifs.
  await recordScore(db.query, ana, "defi", "2026-11-22", all(7, 3));
  await recordScore(db.query, ana, "defi", "2026-11-21", all(7, 3));
  await recordScore(db.query, ana, "defi", "2026-11-19", all(7, 3)); // trou le 20 : hors série
  const daily = await dailyResult(db.query, ana, TODAY);
  assert.deepEqual(daily, { day: TODAY, marks: all(7, 7), streak: 3 });
  assert.equal(await dailyResult(db.query, cyd, "2026-11-24"), null);
  assert.equal(await playerCount(db.query), 2, "cyd n'a marqué aucun point");
  assert.deepEqual(await dailyStats(db.query, TODAY), { players: 3, average: 4 });
  assert.equal(await dailyStats(db.query, "2026-01-01"), null);

  // Un membre suspendu disparaît du classement ; un compte supprimé perd ses scores.
  await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [ben]);
  assert.deepEqual((await leaderboard(db.query, null)).map((r) => r.handle), ["ana"]);
  assert.deepEqual(await db.transaction((q) => eraseAccount(q, ana)), { ok: true });
  const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM game_scores WHERE user_id = $1`, [ana]);
  assert.equal(n, 0);
  assert.deepEqual(await leaderboard(db.query, null), []);
});

test("série : le septième défi d'affilée rapporte un bonus, pas les autres", async () => {
  const { db } = await createTestDb();
  const [{ id }] = await db.query<{ id: string }>(`INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ('eve@exemple.fr', 'eve', 'Eve', now()) RETURNING id`);
  const bonuses: number[] = [];
  for (let i = 1; i <= 8; i++) {
    const day = `2026-12-0${i}`;
    bonuses.push((await recordScore(db.query, id, "defi", day, [true, true, false, false, false, false, false])).streakBonus);
  }
  assert.deepEqual(bonuses, [0, 0, 0, 0, 0, 0, 50, 0]);
  assert.deepEqual(await standing(db.query, id, "2026-12-01"), { points: 8 * 20 + 50, rank: 1 });
});
