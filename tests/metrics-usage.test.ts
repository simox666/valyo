// Tableau de bord d'utilisation : les requêtes tournent sur une vraie base (PGlite), écartent
// l'agent éditorial et respectent les fenêtres de 7 et 30 jours.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS } from "../lib/migrations.ts";
import {
  USAGE_ACTIONS_SQL, USAGE_AI_SQL, USAGE_DAILY_SQL, USAGE_GAMES_SQL, USAGE_OVERVIEW_SQL, USAGE_THEMES_SQL, USAGE_TOP_POSTS_SQL,
  type UsageAction, type UsageDay, type UsageGame, type UsageOverview, type UsageTheme, type UsageTopPost,
} from "../lib/metrics-sql.ts";

test("tableau de bord : membres, actifs, actions, jeux, thèmes, publications en tête", async () => {
  const db = new PGlite();
  for (const m of MIGRATIONS) for (const s of m.statements) await db.query(s);
  const user = async (handle: string, joined: string) =>
    (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, ${joined}) RETURNING id`, [handle])).rows[0].id;
  const agent = (await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'agent'`)).rows[0].id;
  const ana = await user("ana", "now() - interval '40 days'");
  const ben = await user("ben", "now() - interval '3 days'");
  const cleo = await user("cleo", "now() - interval '10 days'");
  await db.query(`INSERT INTO users (email) VALUES ('pas-encore@inscrit.test')`); // sans règles acceptées : pas un membre

  const today = `(now() AT TIME ZONE 'UTC')::date`;
  await db.query(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, ${today}), ($1, ${today} - 2), ($2, ${today} - 1), ($3, ${today} - 9), ($4, ${today})`, [ana, ben, cleo, agent]);

  const post = async (author: string, title: string, at = "now() - interval '1 day'") =>
    (await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body, status, created_at) VALUES ($1, 'question', $2, 'x', 'published', ${at}) RETURNING id`, [author, title])).rows[0].id;
  const p1 = await post(ana, "Publication d'ana");
  const p2 = await post(agent, "Actu de l'agent");
  await post(ana, "Vieille publication", "now() - interval '45 days'");
  await db.query(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'x'), ($3, $2, 'x'), ($3, $4, 'réponse agent')`, [p1, ben, p2, agent]);
  await db.query(`INSERT INTO post_reactions (post_id, user_id, kind) VALUES ($1, $2, 'interessant'), ($1, $3, 'appris'), ($4, $2, 'interessant')`, [p1, ben, cleo, p2]);
  await db.query(`INSERT INTO post_reactions (post_id, user_id, kind, created_at) VALUES ($1, $2, 'a_creuser', now() - interval '20 days')`, [p1, ana]);
  const theme = (await db.query<{ id: string; name: string }>(`SELECT id, name FROM themes ORDER BY name LIMIT 1`)).rows[0];
  await db.query(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [p1, theme.id]);
  await db.query(`INSERT INTO theme_follows (user_id, theme_id) VALUES ($1, $2), ($3, $2)`, [ana, theme.id, ben]);
  await db.query(`INSERT INTO game_scores (user_id, day, game, correct, total, points) VALUES ($1, ${today}, 'defi', 5, 7, 50), ($1, ${today}, 'quiz:espace', 3, 5, 3), ($2, ${today}, 'quiz:ia', 5, 5, 5), ($2, ${today}, 'echelle', 3, 6, 3)`, [ana, ben]);

  const o = (await db.query<UsageOverview>(USAGE_OVERVIEW_SQL)).rows[0];
  assert.equal(o.members, 3, "ni l'agent ni l'inscription inachevée");
  assert.equal(o.new_7d, 1);
  assert.equal(o.new_prev_7d, 1);
  assert.equal(o.active_today, 1, "l'agent n'est pas un membre actif");
  assert.equal(o.active_7d, 2);
  assert.equal(o.active_prev_7d, 1);
  assert.equal(o.active_30d, 3);

  const actions = new Map((await db.query<UsageAction>(USAGE_ACTIONS_SQL)).rows.map((r) => [r.kind, r]));
  assert.deepEqual([actions.get("publications")!.d7, actions.get("publications")!.d30], [1, 1], "agent et publication de 45 jours écartés");
  assert.equal(actions.get("commentaires")!.d7, 2);
  assert.deepEqual([actions.get("reactions")!.d7, actions.get("reactions")!.d30, actions.get("reactions")!.members_30d], [3, 4, 3]);
  assert.equal(actions.get("parties")!.d30, 4);

  const daily = (await db.query<UsageDay>(USAGE_DAILY_SQL, [30])).rows;
  assert.equal(daily.length, 30);
  assert.equal(daily[29].active, 1);
  assert.equal(daily[28].active, 1);
  assert.equal(daily.reduce((n, d) => n + d.signups, 0), 2, "ben et cleo inscrits dans les 30 jours");
  assert.ok(daily.reduce((n, d) => n + d.actions, 0) >= 11);

  const games = new Map((await db.query<UsageGame>(USAGE_GAMES_SQL)).rows.map((r) => [r.game, r]));
  assert.deepEqual([games.get("quiz")!.plays, games.get("quiz")!.players, games.get("quiz")!.success], [2, 2, 80], "les quiz par thème sont regroupés");
  assert.equal(games.get("echelle")!.success, 50);

  const themes = (await db.query<UsageTheme>(USAGE_THEMES_SQL)).rows;
  assert.equal(themes[0].name, theme.name);
  assert.deepEqual([themes[0].followers, themes[0].posts_7d, themes[0].engagement_30d], [2, 1, 4]);

  const top = (await db.query<UsageTopPost>(USAGE_TOP_POSTS_SQL)).rows;
  assert.equal(top[0].id, p1);
  assert.deepEqual([top[0].reactions, top[0].comments], [3, 1]);
  assert.equal(top.find((p) => p.id === p2)!.comments, 1, "le commentaire de l'agent ne compte pas");

  const ai = (await db.query<{ syntheses: number; audio: number }>(USAGE_AI_SQL)).rows[0];
  assert.deepEqual([ai.syntheses, ai.audio], [0, 0]);
});
