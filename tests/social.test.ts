// Notifications et blocage (lot d'accélération D29-D31). PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import { sendMessage } from "../lib/rooms/chat.ts";
import type { RoomViewer } from "../lib/rooms/permissions.ts";
import { acceptInvitation, createInvitation, createRoom, joinRoom, leaveRoom, sanctionMember, setFollowing } from "../lib/rooms/service.ts";
import { setBlock } from "../lib/social/blocks.ts";
import {
  listNotifications,
  markNotificationsRead,
  notifyReply,
  notifyRoomMessage,
  unreadNotificationCount,
} from "../lib/social/notifications.ts";
import type { Db } from "../lib/editorial/types.ts";
import { createTestDb } from "./editorial-helpers.ts";

let seq = 0;

async function addUser(db: Db): Promise<RoomViewer> {
  const n = ++seq;
  const [u] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, status, rules_accepted_at) VALUES ($1, $2, $3, 'active', now()) RETURNING id`,
    [`social-${n}@example.test`, `social_${n}`, `Membre ${n}`],
  );
  return { id: u.id, status: "active", onboarded: true };
}

test("notification de réponse : jamais à soi-même, jamais vers qui a bloqué l'auteur", async () => {
  const { db } = await createTestDb();
  const author = await addUser(db);
  const replier = await addUser(db);
  const [post] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', 'Titre de test', 'Corps.') RETURNING id`, [author.id]);
  const [comment] = await db.query<{ id: string }>(`INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, 'Réponse') RETURNING id`, [post.id, replier.id]);

  assert.equal(await notifyReply(db.query, { recipientId: author.id, actorId: author.id, postId: post.id, commentId: comment.id }), false, "pas d'auto-notification");
  assert.ok(await notifyReply(db.query, { recipientId: author.id, actorId: replier.id, postId: post.id, commentId: comment.id }));
  assert.equal(await unreadNotificationCount(db.query, author.id), 1);

  await db.transaction((q) => setBlock(q, author.id, replier.id, true));
  assert.equal(await notifyReply(db.query, { recipientId: author.id, actorId: replier.id, postId: post.id, commentId: comment.id }), false, "un membre bloqué ne notifie plus");
  assert.equal(await unreadNotificationCount(db.query, author.id), 1);
});

test("messages de salon : seuls les suiveurs sont notifiés, regroupés avec compteur ; lu puis nouveau = nouvelle notification", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db); // suit son salon par défaut
  const follower = await addUser(db);
  const memberOnly = await addUser(db);
  const created = await createRoom(db.query, owner, { name: "Salon notifications", description: "", themeId: null, visibility: "public", format: "chat", postId: null });
  const roomId = created.ok ? created.roomId : "";
  for (const u of [follower, memberOnly]) assert.ok((await joinRoom(db, u, roomId)).ok);
  assert.ok((await setFollowing(db, follower, roomId, true)).ok);

  await db.transaction((q) => sendMessage(q, memberOnly, roomId, { clientId: "n-1", body: "Un" }));
  await db.transaction((q) => sendMessage(q, memberOnly, roomId, { clientId: "n-2", body: "Deux" }));

  assert.equal(await unreadNotificationCount(db.query, memberOnly.id), 0, "jamais d'auto-notification");
  assert.equal(await unreadNotificationCount(db.query, follower.id), 1, "regroupement : une notification par salon");
  const [grouped] = await listNotifications(db.query, follower.id);
  assert.deepEqual([grouped.kind, grouped.count], ["room_message", 2]);
  assert.equal(await unreadNotificationCount(db.query, owner.id), 1, "le créateur suit par défaut");

  await db.transaction((q) => markNotificationsRead(q, follower.id, "all"));
  await db.transaction((q) => sendMessage(q, memberOnly, roomId, { clientId: "n-3", body: "Trois" }));
  const after = await listNotifications(db.query, follower.id);
  assert.equal(after.filter((n) => !n.read).length, 1, "une nouvelle notification après lecture");
  assert.equal(after.filter((n) => !n.read)[0].count, 1);
});

test("perte d'accès (départ ou sanction) : les notifications du salon disparaissent (D30)", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const follower = await addUser(db);
  const created = await createRoom(db.query, owner, { name: "Salon privé notif", description: "", themeId: null, visibility: "private", format: "chat", postId: null });
  const roomId = created.ok ? created.roomId : "";
  await db.query(`INSERT INTO room_members (room_id, user_id, following) VALUES ($1, $2, true)`, [roomId, follower.id]);
  await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: "p-1", body: "Privé" }));
  assert.equal(await unreadNotificationCount(db.query, follower.id), 1);

  await leaveRoom(db, follower, roomId);
  assert.equal((await listNotifications(db.query, follower.id)).length, 0, "plus aucune référence au salon privé");

  // Même chose après une sanction.
  await db.query(`INSERT INTO room_members (room_id, user_id, following) VALUES ($1, $2, true)`, [roomId, follower.id]);
  await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: "p-2", body: "Encore" }));
  assert.equal(await unreadNotificationCount(db.query, follower.id), 1);
  assert.ok((await sanctionMember(db, owner, roomId, follower.id, { kind: "ban", days: 7 }, "test")).ok);
  assert.equal((await listNotifications(db.query, follower.id)).length, 0);
});

test("blocage : pas de soi-même ni de l'agent ; une invitation d'un membre bloqué est refusée", async () => {
  const { db } = await createTestDb();
  const blocker = await addUser(db);
  const other = await addUser(db);
  const [agent] = await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'agent'`);

  assert.equal((await db.transaction((q) => setBlock(q, blocker.id, blocker.id, true))).ok, false);
  assert.equal((await db.transaction((q) => setBlock(q, blocker.id, agent.id, true))).ok, false, "l'agent se signale, ne se bloque pas");
  assert.ok((await db.transaction((q) => setBlock(q, blocker.id, other.id, true))).ok);

  const created = await createRoom(db.query, other, { name: "Salon du bloqué", description: "", themeId: null, visibility: "private", format: "chat", postId: null });
  const roomId = created.ok ? created.roomId : "";
  const invitation = await createInvitation(db.query, other, roomId);
  assert.ok(invitation.ok);
  const refused = await acceptInvitation(db, blocker, invitation.ok ? invitation.token : "");
  assert.deepEqual([refused.ok, (refused as { code: string }).code], [false, "bloque"]);
  // L'invitation n'a PAS été consommée par le refus.
  const [inv] = await db.query(`SELECT used_at FROM room_invitations`);
  assert.equal(inv.used_at, null);

  // Déblocage : l'invitation fonctionne.
  assert.ok((await db.transaction((q) => setBlock(q, blocker.id, other.id, false))).ok);
  assert.ok((await acceptInvitation(db, blocker, invitation.ok ? invitation.token : "")).ok);
});

test("notification directe de salon : un suiveur qui a bloqué l'auteur n'est pas notifié", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const follower = await addUser(db);
  const created = await createRoom(db.query, owner, { name: "Salon blocage", description: "", themeId: null, visibility: "public", format: "chat", postId: null });
  const roomId = created.ok ? created.roomId : "";
  assert.ok((await joinRoom(db, follower, roomId)).ok);
  assert.ok((await setFollowing(db, follower, roomId, true)).ok);
  await db.transaction((q) => setBlock(q, follower.id, owner.id, true));
  const notified = await db.transaction((q) => notifyRoomMessage(q, roomId, owner.id));
  assert.equal(notified, 0);
});
