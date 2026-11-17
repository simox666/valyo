import assert from "node:assert/strict";
import { test } from "node:test";
import { createTestDb } from "./editorial-helpers.ts";
import { createRoom, joinRoom, leaveRoom, updateRoom } from "../lib/rooms/service.ts";
import { chatSnapshot, emitRoomBatch, sendMessage, latestEventSeq, purgeRoomEvents } from "../lib/rooms/chat.ts";
import { appealWithToken, createAppealToken, moderate } from "../lib/social/moderation.ts";
import type { Db } from "../lib/editorial/types.ts";

async function user(db: Db, name: string, role = "member") {
  const [u] = await db.query<{ id: string }>(`INSERT INTO users (email, handle, role, rules_accepted_at) VALUES ($1, $2, $3, now()) RETURNING id`, [`${name}@example.test`, name, role]);
  return { id: u.id, status: "active", onboarded: true };
}

test("ACC01/06 — émission privée refusée après révocation de session ou départ, purge reprise sans boucle", async (t) => {
  const { db, lite } = await createTestDb(); t.after(() => lite.close());
  const owner = await user(db, "owner"); const member = await user(db, "member");
  const room = await db.transaction((q) => createRoom(q, owner, { name: "Salon de recette", description: "", themeId: null, visibility: "public", format: "chat", postId: null }));
  assert.ok(room.ok);
  assert.ok((await joinRoom(db, member, room.roomId)).ok);
  await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('s', $1, now() + interval '1 day')`, [member.id]);
  const sent = await db.transaction((q) => sendMessage(q, owner, room.roomId, { clientId: "one", body: "Texte privé" })); assert.ok(sent.ok);
  const events: string[] = [];
  const emit = (kind: string) => { events.push(kind); };
  const batch = await emitRoomBatch(db, member, room.roomId, 0, "s", emit);
  assert.equal(batch.closed, false); assert.ok(events.includes("message"));
  await db.transaction((q) => purgeRoomEvents(q, room.roomId, batch.cursor + 10000));
  const snapshot = await chatSnapshot(db, member, room.roomId); assert.ok(snapshot);
  assert.equal(snapshot.cursor, batch.cursor, "la purge ne réserve pas de séquence future");
  events.length = 0;
  await emitRoomBatch(db, member, room.roomId, snapshot.cursor, "s", emit);
  assert.deepEqual(events, ["battement"]);
  await db.query(`DELETE FROM sessions WHERE token_hash = 's'`);
  events.length = 0;
  assert.equal((await emitRoomBatch(db, member, room.roomId, 0, "s", emit)).closed, true);
  assert.deepEqual(events, ["revoked"]);
  await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('s', $1, now() + interval '1 day')`, [member.id]);
  assert.ok((await leaveRoom(db, member, room.roomId)).ok);
  events.length = 0;
  await emitRoomBatch(db, member, room.roomId, await latestEventSeq(db.query, room.roomId), "s", emit);
  assert.deepEqual(events, ["revoked"]);
});

test("ACC03 — un salon archivé refuse une écriture avec un viewer antérieur", async (t) => {
  const { db, lite } = await createTestDb(); t.after(() => lite.close());
  const owner = await user(db, "owner");
  const room = await db.transaction((q) => createRoom(q, owner, { name: "Salon archivé", description: "", themeId: null, visibility: "public", format: "chat", postId: null })); assert.ok(room.ok);
  assert.ok((await updateRoom(db, owner, room.roomId, { archive: true })).ok);
  assert.equal((await db.transaction((q) => sendMessage(q, owner, room.roomId, { clientId: "late", body: "Interdit" }))).ok, false);
});

test("ACC09 — un seul dépôt concurrent par jeton ; un refus métier ne consomme pas le lien", async (t) => {
  const { db, lite } = await createTestDb(); t.after(() => lite.close());
  const admin = await user(db, "admin", "admin"); const member = await user(db, "member");
  const a = await moderate(db, { moderatorId: admin.id, targetUserId: member.id, kind: "warn", reason: "Avertissement initial" }); assert.ok(a.ok);
  const b = await moderate(db, { moderatorId: admin.id, targetUserId: member.id, kind: "ban", reason: "Bannissement ultérieur" }); assert.ok(b.ok);
  const link = await db.transaction((q) => createAppealToken(q, "member@example.test")); assert.ok(link);
  const invalid = await appealWithToken(db, { token: link.token, actionId: "00000000-0000-0000-0000-000000000000", body: "Demande sans sanction" }); assert.equal(invalid.ok, false);
  const results = await Promise.all([a.actionId, b.actionId].map((actionId) => appealWithToken(db, { token: link.token, actionId, body: "Contestation motivée" })));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => !r.ok && r.code === "jeton").length, 1);
  assert.equal((await db.query(`SELECT id FROM sanction_appeals`)).length, 1);
  assert.equal((await db.query(`SELECT token_hash FROM sessions WHERE user_id = $1`, [member.id])).length, 0);
});
