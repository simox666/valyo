// Réactions, profil public et page thème : droits et confidentialité. PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import { publicActivity } from "../lib/social/profile.ts";
import { reactionSummaries, toggleReaction } from "../lib/social/reactions.ts";
import { themeOverview } from "../lib/social/theme-page.ts";
import type { Db } from "../lib/editorial/types.ts";
import { createTestDb } from "./editorial-helpers.ts";

let seq = 0;
async function user(db: Db, status = "active") {
  const n = ++seq;
  const [u] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, status, rules_accepted_at) VALUES ($1, $2, $3, $4, now()) RETURNING id`,
    [`f-${n}@example.test`, `f_${n}`, `Membre ${n}`, status],
  );
  return u.id;
}
const post = async (db: Db, authorId: string, status = "published", themeId: string | null = null) => {
  const [p] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body, status) VALUES ($1, 'question', 'Titre', 'x', $2) RETURNING id`, [authorId, status]);
  if (themeId) await db.query(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [p.id, themeId]);
  return p.id;
};

test("réactions : bascule, comptes réels, une par sorte ; refusées à un suspendu et sur une publication retirée", async () => {
  const { db } = await createTestDb();
  const author = await user(db);
  const a = await user(db);
  const b = await user(db);
  const suspended = await user(db, "suspended");
  const p = await post(db, author);

  for (const u of [a, b]) assert.ok((await db.transaction((q) => toggleReaction(q, { userId: u, postId: p, kind: "appris", on: true }))).ok);
  const again = await db.transaction((q) => toggleReaction(q, { userId: a, postId: p, kind: "appris", on: true }));
  assert.ok(again.ok && again.summary.counts.appris === 2, "pas de double réaction");
  assert.deepEqual(again.ok && again.summary.mine, ["appris"]);
  const off = await db.transaction((q) => toggleReaction(q, { userId: a, postId: p, kind: "appris", on: false }));
  assert.ok(off.ok && off.summary.counts.appris === 1 && off.summary.mine.length === 0);

  const refused = await db.transaction((q) => toggleReaction(q, { userId: suspended, postId: p, kind: "interessant", on: true }));
  assert.deepEqual([refused.ok, !refused.ok && refused.status], [false, 403]);
  const removed = await post(db, author, "removed");
  const gone = await db.transaction((q) => toggleReaction(q, { userId: b, postId: removed, kind: "interessant", on: true }));
  assert.deepEqual([gone.ok, !gone.ok && gone.status], [false, 404]);

  const map = await reactionSummaries(db.query, [p, removed], b);
  assert.equal(map.get(p)!.counts.appris, 1);
  assert.deepEqual(map.get(p)!.mine, ["appris"]);
  assert.equal(map.get(removed)!.counts.interessant, 0);
});

test("profil public : comptes publiés seulement, salons PUBLICS non archivés uniquement", async () => {
  const { db } = await createTestDb();
  const m = await user(db);
  const p = await post(db, m);
  await post(db, m, "deleted");
  await db.query(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'ok'), ($1, $2, 'ok2')`, [p, m]);
  await db.query(`INSERT INTO comments (post_id, author_id, body, status) VALUES ($1, $2, 'supprimé', 'deleted')`, [p, m]);
  for (const [name, vis, archived] of [["Public", "public", false], ["Privé", "private", false], ["Archivé", "public", true]] as const) {
    const [r] = await db.query<{ id: string }>(`INSERT INTO rooms (name, owner_id, visibility, archived_at) VALUES ($1, $2, $3, $4) RETURNING id`, [name, m, vis, archived ? new Date().toISOString() : null]);
    await db.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner')`, [r.id, m]);
  }
  const activity = await publicActivity(db.query, m);
  assert.deepEqual([activity.posts, activity.comments], [1, 2]);
  assert.deepEqual(activity.rooms.map((r) => r.name), ["Public"], "jamais un salon privé ni archivé sur un profil");
});

test("page thème : suiveurs actifs, salons publics, membres actifs sans l'agent ni les blocages", async () => {
  const { db } = await createTestDb();
  const [{ id: espace }] = await db.query<{ id: string }>(`SELECT id FROM themes WHERE slug = 'espace'`);
  const [agent] = await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'agent'`);
  const viewer = await user(db);
  const active = await user(db);
  const blocked = await user(db);
  const suspended = await user(db, "suspended");
  for (const u of [viewer, active, suspended]) await db.query(`INSERT INTO theme_follows (user_id, theme_id) VALUES ($1, $2)`, [u, espace]);
  await post(db, active, "published", espace);
  await post(db, active, "published", espace);
  await post(db, blocked, "published", espace);
  await post(db, agent.id, "published", espace);
  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [viewer, blocked]);
  await db.query(`INSERT INTO rooms (name, owner_id, visibility, theme_id) VALUES ('Public espace', $1, 'public', $2), ('Privé espace', $1, 'private', $2)`, [active, espace]);

  const o = await themeOverview(db.query, espace, viewer);
  assert.equal(o.followers, 2, "les comptes suspendus ne comptent pas");
  assert.equal(o.postsLast30, 4);
  assert.deepEqual(o.rooms.map((r) => r.name), ["Public espace"]);
  const handles = o.members.map((m) => m.handle);
  assert.equal(o.members[0].contributions, 2);
  assert.ok(!handles.some((h) => h === "agent-editorial"), "l'agent n'est pas un membre actif");
  assert.equal(handles.length, 1, "le membre bloqué n'est pas mis en avant");
  const visitorView = await themeOverview(db.query, espace, null);
  assert.equal(visitorView.members.length, 2, "un visiteur voit les deux contributeurs humains");
});
