// Gamification : niveaux par thème (reconnaissance reçue, pas volume), découvertes, série hebdomadaire, toasts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeProgress, levelFor, markSeen, syncProgress, weekOf, weekStreak } from "../lib/social/progress.ts";
import { createTestDb } from "./editorial-helpers.ts";

test("série : semaines consécutives, la semaine en cours vide ne casse pas la série", () => {
  const today = new Date("2026-11-18T10:00:00Z"); // mercredi
  assert.equal(weekOf(today), "2026-11-16");
  assert.equal(weekOf(new Date("2026-11-15T23:30:00Z")), "2026-11-16", "dimanche 23h30 UTC = lundi 0h30 à Bruxelles");
  assert.deepEqual(weekStreak(["2026-11-16", "2026-11-09", "2026-11-02"], today), { current: 3, best: 3, activeThisWeek: true });
  assert.deepEqual(weekStreak(["2026-11-09", "2026-11-02"], today), { current: 2, best: 2, activeThisWeek: false });
  assert.deepEqual(weekStreak(["2026-10-26", "2026-10-19", "2026-10-12", "2026-10-05", "2026-11-16"], today), { current: 1, best: 4, activeThisWeek: true });
  assert.deepEqual(weekStreak([], today), { current: 0, best: 0, activeThisWeek: false });
});

test("niveaux : découvert à la première contribution, puis selon les points reçus", () => {
  assert.equal(levelFor(0, 0), 0);
  assert.equal(levelFor(12, 0), 1, "publier beaucoup ne fait pas monter de niveau");
  assert.equal(levelFor(1, 5), 2);
  assert.equal(levelFor(1, 20), 3);
});

test("progression : la reconnaissance des autres compte, la sienne non ; paliers acquis ; toasts sans avalanche", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const [ana, ...others] = [await user("ana"), await user("b1"), await user("b2"), await user("b3"), await user("b4"), await user("b5")];
  const theme = async (slug: string) => (await db.query<{ id: string }>(`SELECT id FROM themes WHERE slug = $1`, [slug]))[0].id;
  const [espace, ia] = [await theme("espace"), await theme("ia")];
  const post = async (author: string, kind: string, t: string) => {
    const [p] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, $2, 'Titre', 'x') RETURNING id`, [author, kind]);
    await db.query(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [p.id, t]);
    return p.id;
  };

  // Premier calcul : rien à montrer, ana n'a encore rien fait.
  let sync = await syncProgress(db.query, ana);
  assert.equal(sync.unseen.length, 0);
  assert.equal(sync.progress.themes.every((t) => t.level === 0), true);

  const p = await post(ana, "news", espace);
  await db.query(`INSERT INTO post_reactions (post_id, user_id, kind) VALUES ($1, $2, 'appris')`, [p, ana]); // sa propre réaction : 0
  sync = await syncProgress(db.query, ana);
  assert.deepEqual(sync.unseen.map((u) => u.key).sort(), ["badge:premier_pas", "niveau:espace:1"]);
  assert.equal(sync.progress.themes.find((t) => t.slug === "espace")!.points, 0);
  await markSeen(db.query, ana, sync.unseen.map((u) => u.key));

  // 5 membres veulent creuser + 2 « J'ai appris » (double) : 5 + 4 = 9 points → Initié ; Pionnier.
  for (const o of others) await db.query(`INSERT INTO post_reactions (post_id, user_id, kind) VALUES ($1, $2, 'a_creuser')`, [p, o]);
  await db.query(`INSERT INTO post_reactions (post_id, user_id, kind) VALUES ($1, $2, 'appris'), ($1, $3, 'appris')`, [p, others[0], others[1]]);
  // Une réponse à la question d'un autre en IA : élément découvert, 1 point.
  const q = await post(others[0], "question", ia);
  await db.query(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'réponse'), ($1, $2, 'précision')`, [q, ana]);

  sync = await syncProgress(db.query, ana);
  const espaceP = sync.progress.themes.find((t) => t.slug === "espace")!;
  assert.deepEqual([espaceP.points, espaceP.level, espaceP.toNext], [9, 2, 11]);
  assert.deepEqual([sync.progress.themes.find((t) => t.slug === "ia")!.points, sync.progress.themes.find((t) => t.slug === "ia")!.level], [1, 1], "une seule fois par question");
  assert.deepEqual(sync.unseen.map((u) => u.key).sort(), ["badge:pionnier", "niveau:espace:2", "niveau:ia:1"]);
  assert.equal(sync.unseen.find((u) => u.key === "niveau:espace:2")!.title, "Initié en Espace");
  assert.equal(sync.progress.badges.find((b) => b.key === "fidele")!.value, 1, "série d'une semaine");

  // Les réactions disparaissent : le niveau et la découverte restent acquis.
  await db.query(`DELETE FROM post_reactions WHERE post_id = $1`, [p]);
  const after = await computeProgress(db.query, ana);
  assert.equal(after.themes.find((t) => t.slug === "espace")!.level, 2);
  assert.equal(after.badges.find((b) => b.key === "pionnier")!.unlocked, true);
});

test("progression : premier calcul d'un membre déjà actif, ses paliers sont enregistrés sans toast", async () => {
  const { db } = await createTestDb();
  const [{ id: ana }] = await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ('ana', 'ana', now()) RETURNING id`);
  await db.query(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', 'Titre', 'x')`, [ana]);
  const sync = await syncProgress(db.query, ana);
  assert.equal(sync.unseen.length, 0);
  const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM user_achievements WHERE user_id = $1 AND seen_at IS NOT NULL`, [ana]);
  assert.equal(n, 1, "Premier pas acquis, déjà marqué vu");
});
