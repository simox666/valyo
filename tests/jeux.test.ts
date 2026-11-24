// Jeux des thèmes : la banque de questions reste cohérente (un quiz de thème
// a toujours 5 questions, les index de réponse sont valides, les slugs existent).
import assert from "node:assert/strict";
import { test } from "node:test";
import { RANKED_SETS, DATE_SETS, SIZE_SETS } from "../lib/jeux/classements.ts";
import { QUIZ_QUESTIONS, TRUE_FALSE_STATEMENTS, themesWithGames } from "../lib/jeux/questions.ts";
import { DAILY_SIZE, FRISE_EVENTS, dailyChallenge, duelRound, friseRound, friseScore, previousDay, ratioNote, seededRandom, themeRound } from "../lib/jeux/tirage.ts";

// Les slugs semés par les migrations (001, 017 et 018).
const SEEDED_SLUGS = new Set([
  "ia", "robotique", "espace", "sciences", "tech",
  "sante", "climat", "energie", "physique", "biologie", "cyber",
]);

test("chaque question renvoie à un thème semé en base", () => {
  for (const q of QUIZ_QUESTIONS) assert.ok(SEEDED_SLUGS.has(q.theme), `slug inconnu : ${q.theme}`);
  for (const s of TRUE_FALSE_STATEMENTS) assert.ok(SEEDED_SLUGS.has(s.theme), `slug inconnu : ${s.theme}`);
});

test("chaque thème a une banque assez large pour que le quiz change d'une partie à l'autre", () => {
  for (const slug of themesWithGames()) {
    const mcq = QUIZ_QUESTIONS.filter((q) => q.theme === slug).length;
    const vf = TRUE_FALSE_STATEMENTS.filter((s) => s.theme === slug).length;
    assert.ok(mcq >= 20 && vf >= 10, `${slug} : ${mcq} QCM + ${vf} vrai/faux`);
    const a = themeRound(slug, seededRandom("a"));
    assert.equal(a.length, 5, slug);
    assert.equal(a.filter((q) => q.choices.length === 2).length, 2, `${slug} : 2 vrai/faux par quiz`);
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) for (const q of themeRound(slug, seededRandom(`p${i}`))) seen.add(q.prompt);
    assert.ok(seen.size >= 15, `${slug} : seulement ${seen.size} questions vues en 12 parties`);
  }
  assert.equal(new Set(QUIZ_QUESTIONS.map((q) => q.question)).size, QUIZ_QUESTIONS.length, "question en double");
  assert.equal(new Set(TRUE_FALSE_STATEMENTS.map((s) => s.statement)).size, TRUE_FALSE_STATEMENTS.length, "affirmation en double");
});

test("aucun indice involontaire : la bonne réponse n'est ni plus longue que les autres, ni toujours à la même place", () => {
  const multi = QUIZ_QUESTIONS.filter((q) => q.choices.length === 4);
  const longest = multi.filter((q) => q.choices.every((c, i) => i === q.answer || c.length < q.choices[q.answer].length));
  // Au hasard, la bonne réponse serait la plus longue une fois sur quatre.
  assert.ok(longest.length / multi.length < 0.34, `bonne réponse la plus longue dans ${longest.length} questions sur ${multi.length}`);
  const vrais = TRUE_FALSE_STATEMENTS.filter((s) => s.isTrue).length / TRUE_FALSE_STATEMENTS.length;
  assert.ok(vrais > 0.4 && vrais < 0.6, `part de « vrai » : ${vrais}`);
  // Une fois tirées, les bonnes réponses se répartissent sur les quatre positions.
  const places = [0, 0, 0, 0];
  for (const slug of themesWithGames()) for (let i = 0; i < 20; i++) for (const q of themeRound(slug, seededRandom(`${slug}${i}`))) if (q.choices.length === 4) places[q.answer]++;
  const total = places.reduce((x, y) => x + y, 0);
  for (const n of places) assert.ok(n / total > 0.18 && n / total < 0.32, `positions : ${places}`);
});

test("le défi du jour ne repose une question à choix qu'une fois la banque épuisée", () => {
  const seen = new Map<string, string>();
  let day = "2027-03-31";
  for (let i = 0; i < 90; i++) {
    for (const q of dailyChallenge(day)) {
      if (q.choices.length !== 4) continue;
      assert.ok(!seen.has(q.prompt), `« ${q.prompt} » posée le ${day} et le ${seen.get(q.prompt)}`);
      seen.set(q.prompt, day);
    }
    day = previousDay(day);
  }
  assert.equal(seen.size, 270);
});

test("les QCM ont des choix distincts, une bonne réponse valide et une explication", () => {
  for (const q of QUIZ_QUESTIONS) {
    assert.ok(q.choices.length >= 2, q.question);
    assert.equal(new Set(q.choices).size, q.choices.length, `choix en double : ${q.question}`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, `réponse hors limites : ${q.question}`);
    assert.ok(q.explain.trim().length > 0, `explication vide : ${q.question}`);
  }
  for (const s of TRUE_FALSE_STATEMENTS) {
    assert.ok(s.explain.trim().length > 0, `explication vide : ${s.statement}`);
  }
});

test("les séries ordonnées sont rattachées à un thème semé et strictement croissantes", () => {
  for (const set of RANKED_SETS) {
    assert.ok(SEEDED_SLUGS.has(set.theme), `slug inconnu : ${set.theme}`);
    assert.ok(set.items.length >= FRISE_EVENTS, `série trop courte : ${set.title}`);
    assert.equal(new Set(set.items.map((i) => i.label)).size, set.items.length, `libellé en double : ${set.title}`);
    for (let i = 1; i < set.items.length; i++) {
      assert.ok(set.items[i].n > set.items[i - 1].n, `${set.title} : « ${set.items[i].label} » mal rangé`);
    }
    if (set.kind === "grandeurs") assert.ok(set.question.endsWith("?"), `question manquante : ${set.title}`);
  }
  assert.ok(DATE_SETS.length >= 3 && SIZE_SETS.length >= 2);
});

test("le défi du jour est identique pour une même date et change d'un jour à l'autre", () => {
  const a = dailyChallenge("2026-11-23");
  assert.deepEqual(a, dailyChallenge("2026-11-23"));
  assert.equal(a.length, DAILY_SIZE);
  assert.notDeepEqual(a.map((q) => q.prompt), dailyChallenge("2026-11-24").map((q) => q.prompt));
  // Sur un an : toujours complet, réponses valides, aucun doublon dans une même journée.
  let day = "2027-01-01";
  for (let i = 0; i < 365; i++) {
    const round = dailyChallenge(day);
    assert.equal(round.length, DAILY_SIZE, day);
    assert.equal(new Set(round.map((q) => q.prompt + q.choices.join())).size, DAILY_SIZE, `doublon le ${day}`);
    for (const q of round) assert.ok(q.answer >= 0 && q.answer < q.choices.length && q.explain.length > 0, day);
    day = previousDay(day);
  }
});

test("un duel désigne bien le plus grand des deux éléments", () => {
  const byLabel = new Map(SIZE_SETS.flatMap((s) => s.items.map((i) => [`${s.question}|${i.label}`, i.n] as const)));
  const rank = new Map(SIZE_SETS.flatMap((s) => s.items.map((i, k) => [`${s.question}|${i.label}`, k] as const)));
  const duels = duelRound(40, seededRandom("duels"));
  assert.equal(duels.length, 40);
  for (const d of duels) {
    const [a, b] = d.choices.map((label) => byLabel.get(`${d.prompt}|${label}`)!);
    assert.equal(d.answer, a > b ? 0 : 1, d.choices.join(" / "));
    // Duels serrés : deux éléments voisins dans leur série, jamais les deux extrêmes.
    const [ra, rb] = d.choices.map((label) => rank.get(`${d.prompt}|${label}`)!);
    assert.ok(Math.abs(ra - rb) <= 2, d.choices.join(" / "));
  }
});

test("l'explication d'un duel compare les deux valeurs", () => {
  assert.equal(ratioNote(320, 900), "environ 2,8 fois plus");
  assert.equal(ratioNote(12104, 12742), "un écart de 5 % seulement");
  assert.equal(ratioNote(900, 28000), "environ 31 fois plus");
  assert.equal(ratioNote(206, 86e9), "des millions de fois plus");
  assert.equal(ratioNote(0, 100), "");
});

test("la frise propose des événements d'une même série et note chaque place juste", () => {
  const frises = friseRound(3, seededRandom("frises"));
  assert.equal(frises.length, 3);
  for (const f of frises) {
    assert.equal(f.events.length, FRISE_EVENTS);
    assert.deepEqual([...f.solution].sort((x, y) => x.n - y.n), f.solution);
    assert.equal(friseScore(f, f.solution), FRISE_EVENTS);
    assert.equal(friseScore(f, [...f.solution].reverse()), 0);
  }
});

test("la veille se calcule à travers les mois et les années", () => {
  assert.equal(previousDay("2026-11-23"), "2026-11-22");
  assert.equal(previousDay("2026-03-01"), "2026-02-28");
  assert.equal(previousDay("2027-01-01"), "2026-12-31");
});
