// Chat réel (lot d'accélération C21 à C27) : envoi idempotent, historique stable,
// événements transactionnels et reprise par curseur, révocation pendant le flux,
// repère de lecture monotone, limite D6 atomique. PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deleteMessage,
  editMessage,
  eventsSince,
  latestEventSeq,
  listMessages,
  markRead,
  sendMessage,
  streamAccessAllowed,
  unreadCount,
} from "../lib/rooms/chat.ts";
import { createRoom, joinRoom, sanctionMember } from "../lib/rooms/service.ts";
import type { RoomViewer } from "../lib/rooms/permissions.ts";
import { runLimited } from "../lib/limits.ts";
import type { Db } from "../lib/editorial/types.ts";
import { createTestDb } from "./editorial-helpers.ts";

let seq = 0;

async function addUser(db: Db, status = "active"): Promise<RoomViewer> {
  const n = ++seq;
  const [u] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, status, rules_accepted_at) VALUES ($1, $2, $3, $4, now()) RETURNING id`,
    [`chat-${n}@example.test`, `chat_${n}`, `Membre ${n}`, status],
  );
  return { id: u.id, status, onboarded: true };
}

async function setup() {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const member = await addUser(db);
  const created = await createRoom(db.query, owner, { name: "Salon de chat", description: "", themeId: null, visibility: "public", format: "chat", postId: null });
  assert.ok(created.ok);
  const roomId = created.ok ? created.roomId : "";
  assert.ok((await joinRoom(db, member, roomId)).ok);
  return { db, owner, member, roomId };
}

test("envoi persistant : accusé, événement transactionnel, relance sans doublon (même identifiant client)", async () => {
  const { db, owner, roomId } = await setup();
  const first = await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: "c-1", body: "Premier message" }));
  assert.ok(first.ok && !first.duplicate);
  const again = await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: "c-1", body: "Premier message" }));
  assert.ok(again.ok && again.duplicate, "la relance renvoie le message existant");
  assert.equal(again.ok && again.message.id, first.ok && first.message.id);
  assert.equal((await db.query(`SELECT id FROM room_messages`)).length, 1, "aucun doublon persistant");
  const events = await eventsSince(db.query, roomId, 0);
  assert.equal(events.filter((e) => e.kind === "message").length, 1, "un seul événement d'envoi");
});

test("historique paginé : ordre stable, chargement vers l'arrière, lecture réservée aux membres", async () => {
  const { db, owner, member, roomId } = await setup();
  const outsider = await addUser(db);
  for (let i = 1; i <= 5; i++) await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: `m-${i}`, body: `Message ${i}` }));

  const refused = await listMessages(db.query, outsider, roomId);
  assert.equal(refused.ok, false, "un non-membre ne lit pas l'historique");

  const page1 = await listMessages(db.query, member, roomId, { limit: 2 });
  assert.ok(page1.ok);
  const bodies1 = page1.ok ? page1.messages.map((m) => m.body) : [];
  assert.deepEqual(bodies1, ["Message 4", "Message 5"]);
  assert.ok(page1.ok && page1.hasMore);
  const before = page1.ok ? page1.messages[0].seq : 0;
  const page2 = await listMessages(db.query, member, roomId, { limit: 2, before });
  assert.deepEqual(page2.ok ? page2.messages.map((m) => m.body) : [], ["Message 2", "Message 3"]);
});

test("modification par l'auteur seulement ; retrait modérateur tracé avec motif", async () => {
  const { db, owner, member, roomId } = await setup();
  const sent = await db.transaction((q) => sendMessage(q, member, roomId, { clientId: "x", body: "À corriger" }));
  const messageId = sent.ok ? sent.message.id : "";

  assert.equal((await db.transaction((q) => editMessage(q, owner, roomId, messageId, "pirate"))).ok, false, "pas de modification du message d'autrui");
  assert.ok((await db.transaction((q) => editMessage(q, member, roomId, messageId, "Corrigé"))).ok);

  const noReason = await db.transaction((q) => deleteMessage(q, owner, roomId, messageId));
  assert.equal(noReason.ok, false, "un retrait de modération exige un motif");
  assert.ok((await db.transaction((q) => deleteMessage(q, owner, roomId, messageId, "propos hors règles"))).ok);
  const [row] = await db.query(`SELECT deleted_by, delete_reason FROM room_messages WHERE id = $1`, [messageId]);
  assert.deepEqual([row.deleted_by, row.delete_reason], [owner.id, "propos hors règles"]);
  const view = await listMessages(db.query, member, roomId);
  assert.ok(view.ok && view.messages[0].deleted && view.messages[0].removedByModeration);
  assert.equal(view.ok && view.messages[0].body, null, "le texte retiré n'est plus servi");
});

test("reprise par curseur : les événements manqués sont rejoués dans l'ordre, sans double application", async () => {
  const { db, owner, member, roomId } = await setup();
  await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: "a", body: "Avant coupure" }));
  const cursor = await latestEventSeq(db.query, roomId);
  // « Coupure » puis activité : un envoi, une modification, une suppression.
  const sent = await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: "b", body: "Pendant la coupure" }));
  const id = sent.ok ? sent.message.id : "";
  await db.transaction((q) => editMessage(q, owner, roomId, id, "Pendant la coupure (edit)"));
  await db.transaction((q) => deleteMessage(q, owner, roomId, id));

  const missed = await eventsSince(db.query, roomId, cursor);
  assert.deepEqual(missed.map((e) => e.kind), ["message", "edit", "delete"]);
  assert.ok(missed.every((e) => e.seq > cursor));
  // Rejouer depuis le même curseur donne exactement la même suite : l'application est idempotente côté client.
  assert.deepEqual(await eventsSince(db.query, roomId, cursor), missed);
  // Un redémarrage complet (nouveau processus, même base) relit les mêmes événements persistés.
  assert.equal((await eventsSince(db.query, roomId, 0)).length, missed.length + 1);
});

test("révocation pendant le flux : l'exclusion émet l'événement dans sa transaction et ferme l'accès", async () => {
  const { db, owner, member, roomId } = await setup();
  assert.equal(await streamAccessAllowed(db, member, roomId), true);
  const cursor = await latestEventSeq(db.query, roomId);
  assert.ok((await sanctionMember(db, owner, roomId, member.id, { kind: "kick" }, "pendant le flux")).ok);
  const events = await eventsSince(db.query, roomId, cursor);
  assert.deepEqual(events.map((e) => [e.kind, e.targetUserId]), [["revoke", member.id]]);
  assert.equal(await streamAccessAllowed(db, member, roomId), false, "la revalidation refuse l'accès");
  // Écriture refusée immédiatement, avant tout commit.
  const refused = await db.transaction((q) => sendMessage(q, member, roomId, { clientId: "z", body: "trop tard" }));
  assert.equal(refused.ok, false);
  // Une suspension de plateforme ferme aussi l'accès au flux.
  await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [owner.id]);
  assert.equal(await streamAccessAllowed(db, owner, roomId), false);
});

test("repère de lecture monotone et non-lus réels", async () => {
  const { db, owner, member, roomId } = await setup();
  for (let i = 1; i <= 3; i++) await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: `r-${i}`, body: `Message ${i}` }));
  const [{ seq: maxSeq }] = await db.query<{ seq: number }>(`SELECT max(seq)::int AS seq FROM room_messages WHERE room_id = $1`, [roomId]);

  assert.equal(await unreadCount(db.query, member, roomId), 3);
  const first = await db.transaction((q) => markRead(q, member, roomId, Number(maxSeq) - 1));
  assert.ok(first.ok);
  assert.equal(await unreadCount(db.query, member, roomId), 1);
  // Le repère ne recule jamais et ne dépasse jamais le dernier message réel.
  const backwards = await db.transaction((q) => markRead(q, member, roomId, 1));
  assert.equal(backwards.ok && backwards.lastReadSeq, Number(maxSeq) - 1);
  const beyond = await db.transaction((q) => markRead(q, member, roomId, 10_000));
  assert.equal(beyond.ok && beyond.lastReadSeq, Number(maxSeq));
});

test("limite D6 atomique : 20 messages par minute, par salon et par membre", async () => {
  const { db, owner, member, roomId } = await setup();
  process.env.LIMIT_ROOM_MESSAGES_PER_MINUTE = "2";
  try {
    const send = (viewer: RoomViewer, clientId: string) =>
      runLimited(db.transaction, "roomMessage", `${roomId}:${viewer.id}`, (q) => sendMessage(q, viewer, roomId, { clientId, body: "x" }));
    assert.ok((await send(owner, "l-1")).ok);
    assert.ok((await send(owner, "l-2")).ok);
    const third = await send(owner, "l-3");
    assert.equal(third.ok, false, "troisième message refusé dans la minute");
    assert.ok((await send(member, "l-4")).ok, "la limite est par membre, pas par salon entier");
  } finally {
    delete process.env.LIMIT_ROOM_MESSAGES_PER_MINUTE;
  }
});
