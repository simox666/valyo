// Jeux visuels : « À l'échelle » et « Dessine la courbe ». Données cohérentes, tirage rejouable
// à partir de la graine, notation par le serveur.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CURVES, COURBE_ROUND, COURBE_TOLERANCE, courbeGame, height, markCourbes, toDraw } from "../lib/jeux/courbes.ts";
import { ECHELLE_BOARDS, ECHELLE_ITEMS, ECHELLE_TOLERANCE, SCALE_SETS, echelleGame, markEchelle, position, ticksOf } from "../lib/jeux/echelle.ts";
import { grade, pointsFor } from "../lib/jeux/points.ts";
import { ALL_THEMES, questionRound } from "../lib/jeux/tirage.ts";

const TODAY = "2026-11-25";

test("à l'échelle : assez de séries, positions croissantes de 0 à 100, graduations dans la règle", () => {
  assert.ok(SCALE_SETS.length >= 10);
  for (const set of SCALE_SETS) {
    const positions = set.items.map((item) => position(set, item.n));
    assert.equal(positions[0], 0, set.title);
    assert.equal(positions[positions.length - 1], 100, set.title);
    for (let i = 1; i < positions.length; i++) assert.ok(positions[i] > positions[i - 1], `${set.title} : positions non croissantes`);
    for (const tick of ticksOf(set)) assert.ok(tick.pos > 0 && tick.pos < 100, `${set.title} : graduation hors règle`);
  }
});

test("à l'échelle : même graine, même partie ; les objets à placer ne sont jamais les repères", () => {
  const game = echelleGame("graine1");
  assert.deepEqual(game, echelleGame("graine1"));
  assert.equal(game.length, ECHELLE_BOARDS);
  for (const board of game) {
    assert.equal(board.items.length, ECHELLE_ITEMS);
    assert.equal(new Set(board.items.map((i) => i.label)).size, ECHELLE_ITEMS);
    for (const [i, item] of board.items.entries()) {
      assert.ok(item.n > board.low.n && item.n < board.high.n);
      assert.ok(board.answers[i] > 0 && board.answers[i] < 100);
    }
  }
});

test("à l'échelle : la tolérance décide, et le serveur note la partie rejouée", () => {
  const game = echelleGame("abc");
  const exact = game.map((b) => b.answers.map((a) => Math.round(a)));
  assert.ok(markEchelle(game, exact).every(Boolean));
  const off = game.map((b) => b.answers.map((a) => (a > 50 ? Math.round(a) - ECHELLE_TOLERANCE - 2 : Math.round(a) + ECHELLE_TOLERANCE + 2)));
  assert.ok(markEchelle(game, off).every((m) => !m));

  const graded = grade({ game: "echelle", seed: "abc", picks: exact }, TODAY);
  assert.ok(graded.ok && graded.marks.length === ECHELLE_BOARDS * ECHELLE_ITEMS && graded.marks.every(Boolean));
  assert.equal(grade({ game: "echelle", seed: "abc", picks: [exact[0]] }, TODAY).ok, false);
  assert.equal(grade({ game: "echelle", seed: "abc", picks: exact.map((r) => r.map(() => 101)) }, TODAY).ok, false);
  assert.equal(grade({ game: "echelle", seed: "abc", picks: [1, 2, 3] }, TODAY).ok, false);
});

test("courbes : séries bien formées (années croissantes, valeurs dans l'axe, source et explication)", () => {
  assert.ok(CURVES.length >= 12);
  assert.equal(new Set(CURVES.map((c) => c.id)).size, CURVES.length);
  for (const curve of CURVES) {
    assert.ok(curve.given >= 1 && toDraw(curve) >= 3, `${curve.id} : pas assez de points à tracer`);
    assert.ok(curve.source.length > 5 && curve.explain.length > 20 && curve.unit.length > 0, curve.id);
    for (const [i, [year, value]] of curve.points.entries()) {
      if (i > 0) assert.ok(year > curve.points[i - 1][0], `${curve.id} : années non croissantes`);
      const h = height(curve, value);
      assert.ok(h >= 0 && h <= 100, `${curve.id} : ${value} sort de l'axe`);
    }
    // L'axe ne doit pas trahir la réponse : la courbe n'en occupe pas toute la hauteur.
    const heights = curve.points.map(([, v]) => height(curve, v));
    assert.ok(Math.max(...heights) <= 96 && (curve.yMin === 0 || Math.min(...heights) >= 4), `${curve.id} : axe trop serré`);
  }
});

test("courbes : même graine, même partie ; le serveur note les points tracés", () => {
  const game = courbeGame("xyz");
  assert.deepEqual(game.map((c) => c.id), courbeGame("xyz").map((c) => c.id));
  assert.equal(game.length, COURBE_ROUND);
  const exact = game.map((c) => c.points.slice(c.given).map(([, v]) => Math.round(height(c, v))));
  assert.ok(markCourbes(game, exact).every(Boolean));
  const shifted = exact.map((row) => row.map((h) => (h > 50 ? h - COURBE_TOLERANCE - 2 : h + COURBE_TOLERANCE + 2)));
  assert.ok(markCourbes(game, shifted).every((m) => !m));

  const graded = grade({ game: "courbe", seed: "xyz", picks: exact }, TODAY);
  assert.ok(graded.ok && graded.marks.length === game.reduce((n, c) => n + toDraw(c), 0) && graded.marks.every(Boolean));
  assert.equal(grade({ game: "courbe", seed: "xyz", picks: exact.map((r) => r.slice(1)) }, TODAY).ok, false);
  assert.equal(pointsFor("courbe", 6, 12), 3);
  assert.equal(pointsFor("echelle", 6, 6), 5);
});

test("quiz libre « tous les thèmes » : cinq questions venues de plusieurs thèmes", () => {
  const themes = new Set<string>();
  for (const seed of ["a", "b", "c", "d"]) {
    const round = questionRound("quiz", { seed, theme: ALL_THEMES, day: TODAY });
    assert.equal(round.length, 5);
    round.forEach((q) => themes.add(q.theme));
  }
  assert.ok(themes.size >= 5);
});
