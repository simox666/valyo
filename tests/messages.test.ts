// Messages privés et listes d'abonnés : envoi, lecture, non-lus, blocage, agent exclu.
import assert from "node:assert/strict";
import { test } from "node:test";
import { findRecipient, listConversations, readThread, sendDirectMessage, unreadConversationCount } from "../lib/social/messages.ts";
import { followList } from "../lib/social/people.ts";
import { createTestDb } from "./editorial-helpers.ts";

test("messages privés : conversation unique, non-lus, blocage, agent exclu", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const ana = await user("ana");
  const ben = await user("ben");
  const toBen = await findRecipient(db.query, ana, "Ben");
  assert.ok(toBen.ok);
  assert.ok((await sendDirectMessage(db.query, ana, toBen.value, "Salut Ben !")).ok);
  assert.ok((await sendDirectMessage(db.query, ana, toBen.value, "Tu as vu l’actu ?")).ok);
  assert.equal((await db.query(`SELECT 1 FROM conversations`)).length, 1, "une seule conversation par paire");

  assert.equal(await unreadConversationCount(db.query, ben), 1);
  assert.equal(await unreadConversationCount(db.query, ana), 0, "ses propres messages ne sont pas non lus");
  const inbox = await listConversations(db.query, ben);
  assert.equal(inbox[0].other.handle, "ana");
  assert.equal(inbox[0].lastBody, "Tu as vu l’actu ?");
  assert.equal(inbox[0].unread, true);

  const thread = await readThread(db.query, ben, ana);
  assert.deepEqual(thread.map((m) => [m.body, m.mine]), [["Salut Ben !", false], ["Tu as vu l’actu ?", false]]);
  assert.equal(await unreadConversationCount(db.query, ben), 0, "lu après ouverture");

  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [ben, ana]);
  const blocked = await sendDirectMessage(db.query, ana, toBen.value, "Encore moi");
  assert.equal(blocked.ok, false, "bloqué : envoi refusé");
  assert.equal((await listConversations(db.query, ben)).length, 0, "conversation masquée pour celui qui bloque");

  const agent = await findRecipient(db.query, ana, "valyo-actus");
  assert.equal(agent.ok, false, "l'agent ne reçoit pas de messages");
  assert.equal((await findRecipient(db.query, ana, "ana")).ok, false, "pas de message à soi-même");
});

test("abonnés et abonnements : listes, suivi réciproque, bloqués masqués", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) => (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [h]))[0].id;
  const [ana, ben, cleo] = [await user("ana"), await user("ben"), await user("cleo")];
  await db.query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2), ($3, $2), ($2, $1)`, [ben, ana, cleo]);
  const followers = await followList(db.query, ana, "followers", ana);
  assert.deepEqual(followers.map((p) => p.handle).sort(), ["ben", "cleo"]);
  assert.equal(followers.find((p) => p.handle === "ben")?.followsViewer, true);
  assert.equal(followers.find((p) => p.handle === "ben")?.followedByViewer, true, "ana suit ben en retour");
  assert.deepEqual((await followList(db.query, ana, "following", null)).map((p) => p.handle), ["ben"]);
  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [ana, cleo]);
  assert.deepEqual((await followList(db.query, ana, "followers", ana)).map((p) => p.handle), ["ben"]);
});
