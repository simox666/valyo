// Jeux des thèmes : la banque de questions reste cohérente (un quiz de thème
// a toujours 5 questions, les index de réponse sont valides, les slugs existent).
import assert from "node:assert/strict";
import { test } from "node:test";
import { QUIZ_QUESTIONS, TRUE_FALSE_STATEMENTS, themesWithGames } from "../lib/jeux/questions.ts";

// Les slugs semés par les migrations (001, 017 et 018).
const SEEDED_SLUGS = new Set([
  "ia", "robotique", "espace", "sciences", "tech",
  "sante", "climat", "energie", "physique", "biologie", "cyber",
]);

test("chaque question renvoie à un thème semé en base", () => {
  for (const q of QUIZ_QUESTIONS) assert.ok(SEEDED_SLUGS.has(q.theme), `slug inconnu : ${q.theme}`);
  for (const s of TRUE_FALSE_STATEMENTS) assert.ok(SEEDED_SLUGS.has(s.theme), `slug inconnu : ${s.theme}`);
});

test("chaque thème joué offre un quiz complet de 5 questions (QCM + vrai/faux)", () => {
  for (const slug of themesWithGames()) {
    const mcq = QUIZ_QUESTIONS.filter((q) => q.theme === slug).length;
    const vf = TRUE_FALSE_STATEMENTS.filter((s) => s.theme === slug).length;
    assert.equal(mcq + vf, 5, `${slug} : ${mcq} QCM + ${vf} vrai/faux`);
  }
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
