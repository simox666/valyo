// Lot social 2 : relais avec avis, rendez-vous de salon, nouveaux à accueillir.
import assert from "node:assert/strict";
import { test } from "node:test";
import { followedRelays, relaySummaries, toggleRelay } from "../lib/social/relays.ts";
import { cancelMeetup, createMeetup, listMeetups } from "../lib/rooms/meetups.ts";
import { newcomersToWelcome } from "../lib/social/suggestions.ts";
import { computeProgress } from "../lib/social/progress.ts";
import { createTestDb } from "./editorial-helpers.ts";

const makeUser = (db: Awaited<ReturnType<typeof createTestDb>>["db"]) => async (h: string) =>
  (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;

test("relais : avis gardé, auteur notifié une seule fois, retrait, bandeau des membres suivis, 2 points", async () => {
  const { db } = await createTestDb();
  const user = makeUser(db);
  const [ana, ben, moi] = [await user("ana"), await user("ben"), await user("moi")];
  const [theme] = await db.query<{ id: string }>(`SELECT id FROM themes WHERE slug = 'espace'`);
  const [post] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', 'Titre', 'x') RETURNING id`, [ana]);
  await db.query(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [post.id, theme.id]);

  const on = await toggleRelay(db.query, { userId: ben, postId: post.id, on: true, note: "À lire absolument." });
  assert.deepEqual(on.ok && [on.summary.count, on.summary.mine, on.summary.myNote], [1, true, "À lire absolument."]);
  // Mise à jour de l'avis : pas de seconde notification.
  await toggleRelay(db.query, { userId: ben, postId: post.id, on: true, note: "Avis retouché." });
  const notifs = await db.query<{ user_id: string; kind: string }>(`SELECT user_id, kind FROM notifications`);
  assert.deepEqual(notifs.map((n) => [n.user_id, n.kind]), [[ana, "relay"]]);

  // 2 points de reconnaissance pour l'auteur relayé.
  assert.equal((await computeProgress(db.query, ana)).themes.find((t) => t.slug === "espace")!.points, 2);

  // Bandeau : moi suit ben → son relais apparaît, avec son avis.
  await db.query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2)`, [moi, ben]);
  const banner = (await followedRelays(db.query, [post.id], moi)).get(post.id)!;
  assert.deepEqual([banner.name, banner.note, banner.total], ["ben", "Avis retouché.", 1]);
  assert.equal((await followedRelays(db.query, [post.id], ana)).get(post.id), undefined, "ana ne suit personne");

  const off = await toggleRelay(db.query, { userId: ben, postId: post.id, on: false, note: "" });
  assert.deepEqual(off.ok && [off.summary.count, off.summary.mine], [0, false]);
  assert.equal((await relaySummaries(db.query, [post.id], ben)).get(post.id)!.count, 0);
});

test("rendez-vous : modération seulement, annonce dans la discussion, date passée refusée, annulation", async () => {
  const { db } = await createTestDb();
  const user = makeUser(db);
  const [ana, ben] = [await user("ana"), await user("ben")];
  const [room] = await db.query<{ id: string }>(`INSERT INTO rooms (name, owner_id, visibility) VALUES ('Club lecture', $1, 'public') RETURNING id`, [ana]);
  await db.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [room.id, ana, ben]);
  const viewer = (id: string) => ({ id, status: "active", onboarded: true });

  const future = new Date(Date.now() + 3 * 86400000).toISOString();
  const refused = await createMeetup(db.query, viewer(ben), room.id, { title: "Journal club", details: "", startsAt: future });
  assert.deepEqual([refused.ok, !refused.ok && refused.status], [false, 403], "un simple membre ne crée pas de rendez-vous");

  const past = await createMeetup(db.query, viewer(ana), room.id, { title: "Hier", details: "", startsAt: new Date(Date.now() - 3600000).toISOString() });
  assert.deepEqual([past.ok, !past.ok && past.status], [false, 400]);

  const created = await createMeetup(db.query, viewer(ana), room.id, { title: "Journal club : exoplanètes", details: "Lire l’étude avant.", startsAt: future });
  assert.equal(created.ok, true);
  const list = await listMeetups(db.query, room.id);
  assert.deepEqual([list.length, list[0].title, list[0].creatorName], [1, "Journal club : exoplanètes", "ana"]);
  const [msg] = await db.query<{ body: string }>(`SELECT body FROM room_messages WHERE room_id = $1`, [room.id]);
  assert.match(msg.body, /^📅 Rendez-vous : Journal club : exoplanètes — /);
  assert.match(msg.body, /Lire l’étude avant\./);

  const canceled = await cancelMeetup(db.query, viewer(ana), room.id, list[0].id);
  assert.equal(canceled.ok, true);
  assert.equal((await listMeetups(db.query, room.id)).length, 0);
});

test("accueil : nouveaux de moins de 7 jours, thèmes communs en tête, jamais soi-même ni un bloqué", async () => {
  const { db } = await createTestDb();
  const user = makeUser(db);
  const [moi, neuf, affine, bloque] = [await user("moi"), await user("neuf"), await user("affine"), await user("bloque")];
  await db.query(`UPDATE users SET rules_accepted_at = now() - interval '30 days' WHERE id = $1`, [moi]);
  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [moi, bloque]);
  const [espace] = await db.query<{ id: string }>(`SELECT id FROM themes WHERE slug = 'espace'`);
  await db.query(`INSERT INTO theme_follows (user_id, theme_id) VALUES ($1, $2), ($3, $2)`, [moi, espace.id, affine]);

  const list = await newcomersToWelcome(db.query, moi);
  assert.deepEqual(list.map((n) => n.handle), ["affine", "neuf"], "thème commun d'abord, le bloqué jamais");
  assert.deepEqual(list[0].sharedThemes, ["Espace"]);
});
