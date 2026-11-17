// Contre-recette de la reprise C010 non transmise dans le journal.
// Attendus métier : certains tests doivent rester rouges tant que les corrections
// applicatives ne sont pas terminées. PGlite en mémoire, aucun fournisseur externe.
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createTestDb } from "../editorial-helpers.ts";
import type { Db } from "../../lib/editorial/types.ts";
import { runLimited } from "../../lib/limits.ts";
import { answerTransfer, createRoom, joinRoom, proposeTransfer } from "../../lib/rooms/service.ts";
import { chatSnapshot, deleteMessage, eventsSince, latestEventSeq, purgeRoomEvents, purgedSeq, sendMessage, streamAccessAllowed } from "../../lib/rooms/chat.ts";
import { appealSanction, applyEffectiveStatus, createAppealToken, decideAppeal, moderate } from "../../lib/social/moderation.ts";
import { listNotifications } from "../../lib/social/notifications.ts";

async function user(db: Db, handle: string, role = "member") {
  const [row] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, role, rules_accepted_at)
     VALUES ($1, $2, $2, $3, now()) RETURNING id`, [`${handle}@example.test`, handle, role],
  );
  return { id: row.id, status: "active", onboarded: true };
}

const roomInput = { name: "Salon de contre-recette", description: "", themeId: null, visibility: "public" as const, format: "chat" as const, postId: null };

async function setup(t: TestContext) {
  const { db, lite } = await createTestDb();
  t.after(() => lite.close());
  const owner = await user(db, "owner");
  const member = await user(db, "member");
  const created = await db.transaction((q) => createRoom(q, owner, roomInput));
  assert.ok(created.ok);
  assert.ok((await joinRoom(db, member, created.roomId)).ok);
  return { db, owner, member, roomId: created.roomId };
}

test("ACC01 — la révocation de la session ferme l'accès même si l'adhésion subsiste", async (t) => {
  const { db, member, roomId } = await setup(t);
  await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('recette', $1, now() + interval '1 hour')`, [member.id]);
  assert.equal(await streamAccessAllowed(db, member, roomId, { sessionTokenHash: "recette" }), true);
  await db.query(`DELETE FROM sessions WHERE token_hash = 'recette'`);
  assert.equal(await streamAccessAllowed(db, member, roomId, { sessionTokenHash: "recette" }), false);
});

test("ACC02 — l'expiration d'une suspension préserve celle dont l'échéance reste future", async (t) => {
  const { db, member } = await setup(t);
  const admin = await user(db, "admin", "admin");
  const old = await moderate(db, { moderatorId: admin.id, targetUserId: member.id, kind: "suspend", durationDays: 7, reason: "Première suspension" });
  assert.ok(old.ok);
  await db.query(`UPDATE moderation_actions SET created_at = now() - interval '8 days' WHERE id = $1`, [old.actionId]);
  assert.ok((await moderate(db, { moderatorId: admin.id, targetUserId: member.id, kind: "suspend", durationDays: 30, reason: "Seconde suspension indépendante" })).ok);
  assert.equal(await db.transaction((q) => applyEffectiveStatus(q, member.id)), "suspended");
  const [row] = await db.query(`SELECT suspended_until > now() + interval '29 days' AS future FROM users WHERE id = $1`, [member.id]);
  assert.equal(row.future, true);
});

test("ACC03 — la création d'un salon refuse une identité authentifiée avant suspension", async (t) => {
  const { db, member } = await setup(t);
  await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [member.id]);
  const result = await db.transaction((q) => createRoom(q, member, roomInput));
  assert.equal(result.ok, false, "la création doit relire le compte dans sa transaction");
  assert.equal((await db.query(`SELECT id FROM rooms WHERE owner_id = $1`, [member.id])).length, 0);
});

test("ACC03 — une suspension entre authentification et suppression interdit la mutation du message", async (t) => {
  const { db, member, roomId } = await setup(t);
  const sent = await db.transaction((q) => sendMessage(q, member, roomId, { clientId: "own", body: "Message avant suspension" }));
  assert.ok(sent.ok);
  await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [member.id]);
  const result = await db.transaction((q) => deleteMessage(q, member, roomId, sent.message.id));
  assert.equal(result.ok, false, "l'auteur suspendu ne doit pas contourner le contrôle d'écriture");
  const [row] = await db.query(`SELECT deleted_at FROM room_messages WHERE id = $1`, [sent.message.id]);
  assert.equal(row.deleted_at, null);
});

test("ACC03 — le destinataire suspendu n'accepte pas un transfert avec une identité périmée", async (t) => {
  const { db, owner, member, roomId } = await setup(t);
  const transfer = await proposeTransfer(db, owner, roomId, member.id);
  assert.ok(transfer.ok);
  await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [member.id]);
  assert.equal((await answerTransfer(db, member, transfer.transferId, "accept")).ok, false);
  const [room] = await db.query(`SELECT owner_id FROM rooms WHERE id = $1`, [roomId]);
  assert.equal(room.owner_id, owner.id);
});

test("ACC04 — succession au plus ancien modérateur actif et annulation du transfert ouvert", async (t) => {
  const { db, owner, member, roomId } = await setup(t);
  const newer = await user(db, "newer");
  const admin = await user(db, "admin", "admin");
  assert.ok((await joinRoom(db, newer, roomId)).ok);
  await db.query(`UPDATE room_members SET role = 'moderator', joined_at = now() - interval '2 days' WHERE room_id = $1 AND user_id = $2`, [roomId, member.id]);
  await db.query(`UPDATE room_members SET role = 'moderator' WHERE room_id = $1 AND user_id = $2`, [roomId, newer.id]);
  const transfer = await proposeTransfer(db, owner, roomId, newer.id);
  assert.ok(transfer.ok);
  assert.ok((await moderate(db, { moderatorId: admin.id, targetUserId: owner.id, kind: "ban", reason: "Bannissement du propriétaire" })).ok);
  const [room] = await db.query(`SELECT owner_id, archived_at FROM rooms WHERE id = $1`, [roomId]);
  assert.deepEqual([room.owner_id, room.archived_at], [member.id, null]);
  const owners = await db.query(`SELECT user_id FROM room_members WHERE room_id = $1 AND role = 'owner'`, [roomId]);
  assert.deepEqual(owners.map((r) => r.user_id), [member.id]);
  const [proposal] = await db.query(`SELECT cancelled_at FROM room_transfers WHERE id = $1`, [transfer.transferId]);
  assert.ok(proposal.cancelled_at);
});

test("ACC06 — les séquences intercalées de deux salons n'impliquent aucune purge", async (t) => {
  const { db, owner, roomId } = await setup(t);
  const other = await db.transaction((q) => createRoom(q, owner, roomInput));
  assert.ok(other.ok);
  await db.transaction((q) => sendMessage(q, owner, other.roomId, { clientId: "offset", body: "Autre salon" }));
  await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: "after", body: "Salon testé" }));
  assert.equal(await purgedSeq(db.query, roomId), 0);
  assert.equal((await eventsSince(db.query, roomId, 0)).length, 1);
});

test("ACC06 — après purge totale, l'instantané fournit un curseur au moins égal au watermark", async (t) => {
  const { db, owner, member, roomId } = await setup(t);
  await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: "before-purge", body: "Toujours dans l'historique" }));
  const cursor = await latestEventSeq(db.query, roomId);
  await db.transaction((q) => purgeRoomEvents(q, roomId, cursor));
  const snapshot = await chatSnapshot(db, member, roomId);
  assert.ok(snapshot);
  assert.equal(snapshot.messages.length, 1);
  assert.ok(snapshot.cursor >= snapshot.purgedSeq, "le nouveau curseur ne doit pas provoquer une nouvelle resynchronisation immédiate");
});

test("ACC09 — décision motivée servie et autre administrateur résolu par adresse configurée", async (t) => {
  const { db, member } = await setup(t);
  const admin = await user(db, "admin", "admin");
  await user(db, "emailadmin");
  const action = await moderate(db, { moderatorId: admin.id, targetUserId: member.id, kind: "suspend", durationDays: 7, reason: "Motif de recette identifiable" });
  assert.ok(action.ok);
  const notifications = await listNotifications(db.query, member.id);
  assert.ok(notifications.some((n) => n.kind === "moderation" && n.body?.includes("Motif de recette identifiable")));
  const appeal = await appealSanction(db.query, { actionId: action.actionId, userId: member.id, body: "Contestation motivée pour la recette" });
  assert.ok(appeal.ok);
  const decision = await decideAppeal(db, { appealId: appeal.appealId, moderatorId: admin.id, decision: "levee", reason: "Relecture", adminEmails: ["EMAILADMIN@example.test"] });
  assert.equal(decision.ok, false);
  if (!decision.ok) assert.equal(decision.code, "examinateur");
});

test("ACC09 — les demandes de contestation consomment réellement le quota annoncé", async (t) => {
  const { db, member } = await setup(t);
  await db.query(`UPDATE users SET status = 'banned' WHERE id = $1`, [member.id]);
  for (let i = 0; i < 5; i++) {
    const result = await runLimited(db.transaction, "loginLink", "member@example.test", (q) => createAppealToken(q, "member@example.test"));
    assert.ok(result.ok && result.value);
  }
  const overflow = await runLimited(db.transaction, "loginLink", "member@example.test", (q) => createAppealToken(q, "member@example.test"));
  assert.equal(overflow.ok, false, "la sixième demande doit être refusée, même sans demande de connexion préalable");
});
