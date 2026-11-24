// Quiz de la semaine : matière limitée aux articles de presse, contrôles automatiques avant
// publication (forme, puis relecture), essais bornés, notation par le serveur. PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_ATTEMPTS, RETRY_AFTER_MS, checkDrafts, ensureWeeklyQuiz, loadWeeklyQuiz, weeklyArticles, weeklyResult, weeklyRound, type DraftQuestion, type QuizWriter, type WeeklyArticle } from "../lib/jeux/hebdo.ts";
import { grade, pointsFor, recordScore } from "../lib/jeux/points.ts";
import { createTestDb } from "./editorial-helpers.ts";

const NOW = new Date("2026-11-24T10:00:00Z"); // mardi ; lundi de la semaine : 23 novembre
const DAY = "2026-11-24";
const WEEK = "2026-11-23";
const LONG = "Des chercheurs ont présenté un résultat détaillé, chiffres et méthode à l'appui, dans une revue à comité de lecture. ".repeat(3);

async function setup(articles = 8) {
  const { db } = await createTestDb();
  const [{ id: author }] = await db.query<{ id: string }>(`INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ('a@exemple.fr', 'ana', 'Ana', now()) RETURNING id`);
  const ids: string[] = [];
  for (let i = 0; i < articles; i++) {
    const [{ id }] = await db.query<{ id: string }>(
      `INSERT INTO posts (author_id, kind, title, body, source_name, created_at) VALUES ($1, 'news', $2, $3, 'Revue Test', $4::timestamptz - ($5::int * interval '1 hour')) RETURNING id`,
      [author, `Article ${i}`, LONG, NOW.toISOString(), i + 1],
    );
    ids.push(id);
  }
  // Hors matière : un texte de membre (sans source) et un article trop ancien.
  await db.query(`INSERT INTO posts (author_id, kind, title, body, created_at) VALUES ($1, 'question', 'Question de membre', $2, $3::timestamptz - interval '1 hour')`, [author, LONG, NOW.toISOString()]);
  await db.query(`INSERT INTO posts (author_id, kind, title, body, source_name, created_at) VALUES ($1, 'news', 'Vieil article', $2, 'Revue Test', $3::timestamptz - interval '9 days')`, [author, LONG, NOW.toISOString()]);
  return { db, author, ids };
}

const draft = (postId: string, n: number): DraftQuestion => ({ postId, question: `Quelle est la découverte numéro ${n} annoncée cette semaine ?`, good: `Réponse juste ${n}`, wrong: [`Fausse A${n}`, `Fausse B${n}`, `Fausse C${n}`], explain: `L'article explique que la réponse juste est la numéro ${n}.` });

function fakeWriter(opts: { drafts: (articles: WeeklyArticle[]) => DraftQuestion[]; reject?: number[]; throws?: boolean }): QuizWriter & { calls: number } {
  const w = {
    model: "faux-modele",
    calls: 0,
    async write(articles: WeeklyArticle[]) { w.calls++; if (opts.throws) throw new Error("panne"); return { drafts: opts.drafts(articles), costMicros: 1000 }; },
    async verify(items: unknown[]) { return { confirmed: items.map((_, i) => !(opts.reject ?? []).includes(i)), costMicros: 500 }; },
  };
  return w;
}

test("la matière : seulement les articles de presse des sept derniers jours", async () => {
  const { db } = await setup();
  const articles = await weeklyArticles(db.query, NOW);
  assert.equal(articles.length, 8);
  assert.ok(articles.every((a) => a.source === "Revue Test" && a.title.startsWith("Article ")));
});

test("contrôle de forme : article inconnu, doublon d'article, propositions en double, adresse web", () => {
  const articles = ["a", "b", "c", "d"].map((postId) => ({ postId, source: "S", title: "T", text: LONG }));
  const kept = checkDrafts([
    draft("a", 1),
    draft("a", 2), // second sur le même article
    draft("zzz", 3), // article inconnu
    { ...draft("b", 4), wrong: ["Réponse juste 4", "x", "y"] }, // proposition identique à la bonne
    { ...draft("c", 5), wrong: ["x", "y"] }, // deux mauvaises réponses seulement
    { ...draft("d", 6), explain: "Voir https://exemple.test pour la suite de cette histoire." },
  ], articles);
  assert.deepEqual(kept.map((k) => k.postId), ["a"]);
  assert.equal(kept[0].choices[0], "Réponse juste 1");
});

test("fabrication : relecture qui écarte, quiz prêt, pas de second appel", async () => {
  const { db, ids } = await setup();
  const writer = fakeWriter({ drafts: (a) => a.map((x, i) => draft(x.postId, i)), reject: [0] });
  assert.equal(await ensureWeeklyQuiz({ q: db.query, writer, now: NOW, day: DAY }), "ready");
  const quiz = (await loadWeeklyQuiz(db.query, WEEK))!;
  assert.equal(quiz.length, 7);
  assert.ok(!quiz.some((x) => x.question.includes("numéro 0 ")), "la question refusée à la relecture est écartée");
  assert.equal(await ensureWeeklyQuiz({ q: db.query, writer, now: NOW, day: DAY }), "exists");
  assert.equal(writer.calls, 1);
  const [{ cost_micros, model }] = await db.query<{ cost_micros: string; model: string }>(`SELECT cost_micros, model FROM weekly_quiz`);
  assert.equal(Number(cost_micros), 1500);
  assert.equal(model, "faux-modele");

  // Un article retiré emporte sa question ; trop de retraits, plus de quiz.
  await db.query(`UPDATE posts SET status = 'removed' WHERE id = $1`, [quiz[0].postId]);
  assert.equal((await loadWeeklyQuiz(db.query, WEEK))!.length, 6);
  await db.query(`UPDATE posts SET status = 'removed' WHERE id = ANY($1::uuid[])`, [ids]);
  assert.equal(await loadWeeklyQuiz(db.query, WEEK), null);
  assert.equal(await loadWeeklyQuiz(db.query, "2026-11-16"), null);
});

test("échecs : trop peu d'articles, trop peu de questions, essais bornés et espacés", async () => {
  const few = await setup(3);
  const ok = fakeWriter({ drafts: (a) => a.map((x, i) => draft(x.postId, i)) });
  assert.equal(await ensureWeeklyQuiz({ q: few.db.query, writer: ok, now: NOW, day: DAY }), "too-few-articles");
  assert.equal(ok.calls, 0, "aucun appel payant sans matière suffisante");

  const { db } = await setup();
  const poor = fakeWriter({ drafts: (a) => a.slice(0, 3).map((x, i) => draft(x.postId, i)) });
  assert.equal(await ensureWeeklyQuiz({ q: db.query, writer: poor, now: NOW, day: DAY }), "failed");
  assert.equal(await loadWeeklyQuiz(db.query, WEEK), null);
  assert.equal(await ensureWeeklyQuiz({ q: db.query, writer: poor, now: new Date(NOW.getTime() + 60_000), day: DAY }), "busy", "pas de nouvel essai avant le délai");
  const broken = fakeWriter({ drafts: () => [], throws: true });
  let at = NOW.getTime();
  for (let i = 2; i <= MAX_ATTEMPTS; i++) {
    at += RETRY_AFTER_MS + 1000;
    assert.equal(await ensureWeeklyQuiz({ q: db.query, writer: broken, now: new Date(at), day: DAY }), "failed");
  }
  at += RETRY_AFTER_MS + 1000;
  assert.equal(await ensureWeeklyQuiz({ q: db.query, writer: ok, now: new Date(at), day: DAY }), "exhausted");
  assert.equal(ok.calls, 0);
});

test("partie : le serveur rejoue la manche, le quiz compte une fois par semaine", async () => {
  const { db, author } = await setup();
  await ensureWeeklyQuiz({ q: db.query, writer: fakeWriter({ drafts: (a) => a.map((x, i) => draft(x.postId, i)) }), now: NOW, day: DAY });
  const quiz = (await loadWeeklyQuiz(db.query, WEEK))!;
  const round = weeklyRound(quiz, "abc");
  assert.deepEqual(round, weeklyRound(quiz, "abc"));
  assert.ok(round.every((q, i) => q.choices[q.answer] === quiz[i].choices[0] && q.link?.href === `/p/${quiz[i].postId}`));
  assert.ok(new Set(Array.from({ length: 20 }, (_, i) => weeklyRound(quiz, `s${i}`)[0].answer)).size > 1, "les propositions sont mélangées");

  const perfect = grade({ game: "hebdo", seed: "abc", day: WEEK, weekly: round, picks: round.map((q) => q.answer) }, DAY);
  assert.ok(perfect.ok && perfect.day === WEEK && perfect.marks.every(Boolean));
  assert.equal(grade({ game: "hebdo", seed: "abc", day: WEEK, weekly: round, picks: [0] }, DAY).ok, false);
  assert.equal(grade({ game: "hebdo", seed: "abc", day: "2026-11-09", weekly: round, picks: round.map((q) => q.answer) }, DAY).ok, false, "semaine close");
  assert.equal(grade({ game: "hebdo", seed: "abc", day: WEEK, picks: round.map((q) => q.answer) }, DAY).ok, false, "sans quiz chargé");

  assert.equal(pointsFor("hebdo", 5, 7), 50);
  assert.equal((await recordScore(db.query, author, "hebdo", WEEK, perfect.ok ? perfect.marks : [])).points, 70);
  assert.equal((await recordScore(db.query, author, "hebdo", WEEK, [true])).counted, false);
  assert.deepEqual(await weeklyResult(db.query, author, WEEK), { correct: 7, total: 7 });
});
