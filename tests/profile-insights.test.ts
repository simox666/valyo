// Profil du passionné : réputation, domaines, points communs, libellés de liens.
import assert from "node:assert/strict";
import { test } from "node:test";
import { profileInsights } from "../lib/social/profile.ts";
import { linkLabel } from "../lib/profile-links.ts";
import { createTestDb } from "./editorial-helpers.ts";

test("profil : a fait apprendre, réponses, domaines, suivi par des gens que je suis, thèmes communs", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const [ana, ben, cleo, moi] = [await user("ana"), await user("ben"), await user("cleo"), await user("moi")];
  const theme = async (slug: string) => (await db.query<{ id: string }>(`SELECT id FROM themes WHERE slug = $1`, [slug]))[0].id;
  const [espace, ia] = [await theme("espace"), await theme("ia")];
  const post = async (author: string, kind: string, t: string) => {
    const [p] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, $2, 'Titre', 'x') RETURNING id`, [author, kind]);
    await db.query(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [p.id, t]);
    return p.id;
  };
  const a1 = await post(ana, "news", espace);
  const a2 = await post(ana, "news", espace);
  await db.query(`INSERT INTO post_reactions (post_id, user_id, kind) VALUES ($1, $2, 'appris'), ($1, $3, 'appris'), ($4, $2, 'interessant'), ($1, $5, 'appris')`, [a1, ben, cleo, a2, ana]);
  const q = await post(ben, "question", ia);
  await db.query(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'réponse')`, [q, ana]);
  await db.query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2), ($3, $2), ($4, $1), ($4, $3)`, [ben, ana, cleo, moi]);
  await db.query(`INSERT INTO theme_follows (user_id, theme_id) VALUES ($1, $2), ($3, $2), ($1, $4)`, [ana, espace, moi, ia]);

  const i = await profileInsights(db.query, ana, moi);
  assert.equal(i.taught, 2, "deux « J'ai appris » reçus, sa propre réaction ne compte pas");
  assert.equal(i.interesting, 1);
  assert.equal(i.answers, 1, "une réponse à la question de ben");
  assert.deepEqual(i.elements.map((e) => [e.slug, e.count]), [["espace", 2], ["ia", 1]]);
  assert.equal(i.followedByCount, 2, "ben et cleo, que je suis, suivent ana");
  assert.deepEqual(i.commonThemes, ["Espace"]);
  assert.equal((await profileInsights(db.query, ana, ana)).followedByCount, 0, "rien en commun avec soi-même");

  assert.equal(linkLabel("https://github.com/ana"), "GitHub");
  assert.equal(linkLabel("https://orcid.org/0000-0002-1825-0097"), "ORCID");
  assert.equal(linkLabel("https://scholar.google.com/citations?user=x"), "Google Scholar");
  assert.equal(linkLabel("https://www.monblog.fr/a-propos"), "monblog.fr");
});

test("profil : meilleures contributions et carte d'activité (contributions publiques, heure de Bruxelles)", async () => {
  const { activityCalendar, bestContributions, ACTIVITY_WEEKS } = await import("../lib/social/profile.ts");
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const [ana, ben] = [await user("ana"), await user("ben")];
  const post = async (title: string, at = "now()") => (await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body, created_at) VALUES ($1, 'news', $2, 'x', ${at}) RETURNING id`, [ana, title]))[0].id;
  const [calme, star, epingle] = [await post("Sans écho"), await post("Très discutée"), await post("Épinglée")];
  await db.query(`INSERT INTO post_reactions (post_id, user_id, kind) VALUES ($1, $2, 'appris'), ($3, $2, 'appris')`, [star, ben, epingle]);
  await db.query(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'bravo')`, [star, ben]);
  const [c] = await db.query<{ id: string }>(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'mon avis') RETURNING id`, [calme, ana]);
  await db.query(`INSERT INTO comments (post_id, author_id, parent_id, body) VALUES ($1, $2, $3, 'réponse')`, [calme, ben, c.id]);

  const best = await bestContributions(db.query, ana, epingle);
  assert.deepEqual(best.posts.map((p) => p.title), ["Très discutée", "Sans écho"], "classées par écho (la réponse de ben compte), épinglée exclue");
  assert.deepEqual(best.comments.map((x) => [x.body, x.replies]), [["mon avis", 1]]);

  const days = await activityCalendar(db.query, ana);
  assert.ok(days.length > 7 * (ACTIVITY_WEEKS - 1) && days.length <= 7 * ACTIVITY_WEEKS);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());
  assert.equal(days.at(-1)?.day, today, "la grille se termine aujourd'hui");
  assert.equal(days.at(-1)?.count, 4, "3 publications + 1 commentaire aujourd'hui");
  assert.equal(new Date(`${days[0].day}T12:00:00Z`).getUTCDay(), 1, "chaque semaine commence un lundi");
});
