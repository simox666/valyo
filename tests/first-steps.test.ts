// « Premiers pas » des nouveaux membres : suggestions réelles, thèmes choisis en tête,
// exclusions (soi, agent, blocages, privé, archivé, sanction, déjà rejoint/suivi/répondu).
import assert from "node:assert/strict";
import { test } from "node:test";
import { firstSteps, isNewcomer, suggestedMembers, suggestedQuestions, suggestedRooms } from "../lib/social/suggestions.ts";
import type { Db } from "../lib/editorial/types.ts";
import { createTestDb } from "./editorial-helpers.ts";

let seq = 0;
async function user(db: Db, opts: { status?: string; role?: string; joinedDaysAgo?: number } = {}) {
  const n = ++seq;
  const [u] = await db.query<{ id: string; handle: string }>(
    `INSERT INTO users (email, handle, display_name, status, role, rules_accepted_at)
     VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6)) RETURNING id, handle`,
    [`fs-${n}@example.test`, `fs_${n}`, `Membre ${n}`, opts.status ?? "active", opts.role ?? "member", opts.joinedDaysAgo ?? 0],
  );
  return u;
}
const theme = async (db: Db, slug: string) => (await db.query<{ id: string }>(`SELECT id FROM themes WHERE slug = $1`, [slug]))[0].id;
const follow = (db: Db, userId: string, themeId: string) => db.query(`INSERT INTO theme_follows (user_id, theme_id) VALUES ($1, $2)`, [userId, themeId]);

async function room(db: Db, ownerId: string, name: string, opts: { themeId?: string; visibility?: string; archived?: boolean; messages?: number; daysAgo?: number } = {}) {
  const [r] = await db.query<{ id: string }>(
    `INSERT INTO rooms (name, owner_id, visibility, theme_id, archived_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, ownerId, opts.visibility ?? "public", opts.themeId ?? null, opts.archived ? new Date().toISOString() : null],
  );
  await db.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner')`, [r.id, ownerId]);
  for (let i = 0; i < (opts.messages ?? 1); i++) {
    await db.query(
      `INSERT INTO room_messages (room_id, author_id, client_id, body, created_at) VALUES ($1, $2, $3, 'x', now() - make_interval(days => $4))`,
      [r.id, ownerId, `m${i}`, opts.daysAgo ?? 0],
    );
  }
  return r.id;
}

async function question(db: Db, authorId: string, title: string, opts: { themeId?: string; replies?: number; daysAgo?: number } = {}) {
  const [p] = await db.query<{ id: string }>(
    `INSERT INTO posts (author_id, kind, title, body, created_at) VALUES ($1, 'question', $2, 'x', now() - make_interval(days => $3)) RETURNING id`,
    [authorId, title, opts.daysAgo ?? 0],
  );
  if (opts.themeId) await db.query(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [p.id, opts.themeId]);
  for (let i = 0; i < (opts.replies ?? 0); i++) {
    const other = await user(db);
    await db.query(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'réponse')`, [p.id, other.id]);
  }
  return p.id;
}

test("salons suggérés : actifs et publics, thème choisi en tête ; jamais privé, archivé, silencieux, déjà rejoint ou sanctionné", async () => {
  const { db } = await createTestDb();
  const me = await user(db);
  const owner = await user(db);
  const espace = await theme(db, "espace");
  await follow(db, me.id, espace);

  const busy = await room(db, owner.id, "Très actif hors thème", { messages: 5 });
  const matching = await room(db, owner.id, "Espace, moins actif", { themeId: espace, messages: 1 });
  await room(db, owner.id, "Privé", { visibility: "private", messages: 9 });
  await room(db, owner.id, "Archivé", { archived: true, messages: 9 });
  await room(db, owner.id, "Silencieux depuis un mois", { messages: 3, daysAgo: 30 });
  const joined = await room(db, owner.id, "Déjà rejoint", { messages: 9 });
  await db.query(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)`, [joined, me.id]);
  const banned = await room(db, owner.id, "Banni", { messages: 9 });
  await db.query(`INSERT INTO room_sanctions (room_id, user_id, kind, created_by) VALUES ($1, $2, 'ban', $3)`, [banned, me.id, owner.id]);

  const rooms = await suggestedRooms(db.query, me.id);
  assert.deepEqual(rooms.map((r) => r.id), [matching, busy], "thème choisi d'abord, puis activité ; le reste exclu");
  assert.equal(rooms[0].matchesTheme, true);
});

test("questions suggérées : celles qui attendent une réponse, thème choisi en tête ; jamais les siennes, celles de l'agent, d'un bloqué, anciennes ou déjà répondues", async () => {
  const { db } = await createTestDb();
  const me = await user(db);
  const author = await user(db);
  const blocked = await user(db);
  const [agent] = await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'agent'`);
  const ia = await theme(db, "ia");
  await follow(db, me.id, ia);

  const unanswered = await question(db, author.id, "Sans réponse hors thème");
  const answered = await question(db, author.id, "Déjà trois réponses", { replies: 3 });
  const inTheme = await question(db, author.id, "IA, deux réponses", { themeId: ia, replies: 2 });
  await question(db, me.id, "La mienne");
  await question(db, agent.id, "De l'agent");
  await question(db, blocked.id, "D'un membre bloqué");
  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [me.id, blocked.id]);
  await question(db, author.id, "Trop ancienne", { daysAgo: 30 });
  const repliedByMe = await question(db, author.id, "J'y ai déjà répondu");
  await db.query(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'moi')`, [repliedByMe, me.id]);

  const questions = await suggestedQuestions(db.query, me.id, 10);
  assert.deepEqual(questions.map((q) => q.id), [inTheme, unanswered, answered], "thème d'abord, puis le moins de réponses");
  assert.equal(questions[1].replies, 0);
});

test("membres suggérés : actifs récemment, thèmes partagés en tête ; jamais soi, l'agent, un suspendu, un bloqué (dans un sens ou l'autre) ou déjà suivi", async () => {
  const { db } = await createTestDb();
  const me = await user(db);
  const robotique = await theme(db, "robotique");
  await follow(db, me.id, robotique);

  const veryActive = await user(db);
  for (let i = 0; i < 3; i++) await question(db, veryActive.id, `Active ${i}`);
  const sharesTheme = await user(db);
  await follow(db, sharesTheme.id, robotique);
  await question(db, sharesTheme.id, "Une seule contribution");
  const silent = await user(db);
  const suspended = await user(db, { status: "suspended" });
  await question(db, suspended.id, "Suspendu");
  const blocksMe = await user(db);
  await question(db, blocksMe.id, "M'a bloqué");
  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [blocksMe.id, me.id]);
  const followed = await user(db);
  await question(db, followed.id, "Déjà suivi");
  await db.query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2)`, [me.id, followed.id]);
  await question(db, me.id, "Moi-même");

  const members = await suggestedMembers(db.query, me.id, 10);
  const handles = members.map((m) => m.handle);
  assert.equal(handles[0], sharesTheme.handle, "le thème partagé passe devant le volume");
  assert.equal(handles[1], veryActive.handle);
  for (const excluded of [me, silent, suspended, blocksMe, followed]) assert.ok(!handles.includes(excluded.handle), `exclu : ${excluded.handle}`);
  assert.deepEqual(members[0].sharedThemes, ["Robotique"]);
});

test("base vide : aucune suggestion inventée ; progression et statut de nouveau membre réels", async () => {
  const { db } = await createTestDb();
  const me = await user(db);
  const veteran = await user(db, { joinedDaysAgo: 10 });
  const steps = await firstSteps(db.query, me.id);
  assert.deepEqual([steps.rooms.length, steps.questions.length, steps.members.length], [0, 0, 0]);
  assert.deepEqual(steps.progress, { joinedRoom: false, repliedOrPosted: false, followsMember: false });
  assert.equal(await isNewcomer(db.query, me.id), true);
  assert.equal(await isNewcomer(db.query, veteran.id), false);

  await question(db, veteran.id, "Une question");
  const [post] = await db.query<{ id: string }>(`SELECT id FROM posts LIMIT 1`);
  await db.query(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'ma réponse')`, [post.id, me.id]);
  assert.equal((await firstSteps(db.query, me.id)).progress.repliedOrPosted, true);
});

test("carte d'accueil : visible la première semaine tant que les 3 étapes ne sont pas faites", async () => {
  const { db } = await createTestDb();
  const { newcomerProgress } = await import("../lib/social/suggestions.ts");
  const me = await user(db);
  const other = await user(db);
  const veteran = await user(db, { joinedDaysAgo: 8 });
  assert.deepEqual(await newcomerProgress(db.query, me.id), { done: 0, total: 3 });
  assert.equal(await newcomerProgress(db.query, veteran.id), null, "plus de carte après 7 jours");

  const r = await room(db, other.id, "Salon");
  await db.query(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)`, [r, me.id]);
  await db.query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2)`, [me.id, other.id]);
  assert.deepEqual(await newcomerProgress(db.query, me.id), { done: 2, total: 3 });
  await question(db, me.id, "Ma première question");
  assert.equal(await newcomerProgress(db.query, me.id), null, "carte retirée quand tout est fait");
});
