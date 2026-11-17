import assert from "node:assert/strict";
import { test } from "node:test";
import { createTestDb } from "./editorial-helpers.ts";
import { communityRooms, linkedRooms } from "../lib/rooms/discovery.ts";
import { createRoom, joinRoom, leaveRoom, updateRoom } from "../lib/rooms/service.ts";
import { sendMessage, deleteMessage, markRead } from "../lib/rooms/chat.ts";

test("UI1 — accueil : activité réelle, non-lus exacts et confidentialité après départ/suspension", async t => {
  const { db, lite } = await createTestDb(); t.after(() => lite.close());
  const members = [];
  for (const handle of ["camille", "nour", "lou"]) {
    const [row] = await db.query<{ id: string }>(`INSERT INTO users (email,handle,rules_accepted_at) VALUES ($1,$2,now()) RETURNING id`, [`${handle}@example.test`,handle]);
    members.push({ id: row.id, status: "active", onboarded: true });
  }
  const [owner, member, outsider] = members;
  const [post] = await db.query<{ id: string }>(`INSERT INTO posts(author_id,kind,title,body) VALUES ($1,'question','Question de test','Exemple') RETURNING id`, [owner.id]);
  async function room(name: string) {
    const r = await db.transaction(q => createRoom(q, owner, { name, description: "", visibility: "public", format: "chat", themeId: null, postId: post.id }));
    assert.ok(r.ok); return r.roomId;
  }
  const pub = await room("Public actif"), secret = await room("Cercle privé"), archived = await room("Archives actives"), quiet = await room("Sans messages");
  await joinRoom(db, member, secret);
  await db.query(`UPDATE rooms SET visibility = 'private' WHERE id = $1`, [secret]);
  async function send(id: string, author = owner) {
    const out = await db.transaction(q => sendMessage(q, author, id, { clientId: crypto.randomUUID(), body: "Démonstration" })); assert.ok(out.ok); return out.message;
  }
  await send(pub); await send(archived); await updateRoom(db, owner, archived, { archive: true });
  await send(secret, member); const first = await send(secret); const removed = await send(secret);
  await db.transaction(q => deleteMessage(q, owner, secret, removed.id));
  const visitor = await communityRooms(db.query, null);
  assert.deepEqual(visitor.active.map(r => r.id), [pub]);
  assert.deepEqual(visitor.discussions, []);
  assert.deepEqual((await communityRooms(db.query, outsider.id)).discussions, []);
  const mine = (await communityRooms(db.query, member.id)).discussions;
  assert.equal(mine[0].id, secret); assert.equal(mine[0].unread, 1, "ne compter ni ses propres messages ni les supprimés");
  await db.transaction(q => markRead(q, member, secret, first.seq));
  assert.equal((await communityRooms(db.query, member.id)).discussions[0].unread, 0);
  const publicLinks = (await linkedRooms(db.query, [post.id], outsider.id)).get(post.id)!;
  assert.ok(!publicLinks.some(r => r.id === secret)); assert.ok(publicLinks.some(r => r.id === quiet));
  assert.equal((await linkedRooms(db.query, [post.id], member.id)).get(post.id)!.find(r => r.id === secret)?.isMember, true);
  await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [member.id]);
  assert.deepEqual((await communityRooms(db.query, member.id)).discussions, []);
  assert.ok(!(await linkedRooms(db.query, [post.id], member.id)).get(post.id)!.some(r => r.id === secret));
  await db.query(`UPDATE users SET status = 'active' WHERE id = $1`, [member.id]);
  await leaveRoom(db, member, secret);
  assert.deepEqual((await communityRooms(db.query, member.id)).discussions, []);
  assert.ok(!(await linkedRooms(db.query, [post.id], member.id)).get(post.id)!.some(r => r.id === secret));
});
