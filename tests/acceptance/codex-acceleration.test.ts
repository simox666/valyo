// Recette indépendante Codex : régressions hors de la suite de développement.
// Exécuter : node --test tests/acceptance/codex-acceleration.test.ts
// Base PGlite en mémoire exclusivement ; aucun appel externe.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTestDb } from "../editorial-helpers.ts";
import type { Db } from "../../lib/editorial/types.ts";
import { createRoom, joinRoom, leaveRoom } from "../../lib/rooms/service.ts";
import { eventsSince, latestEventSeq, sendMessage } from "../../lib/rooms/chat.ts";
import { appealSanction, decideAppeal, moderate } from "../../lib/social/moderation.ts";
import { publishRecap } from "../../lib/editorial/publish.ts";
import { reviseRecapItem } from "../../lib/editorial/revision.ts";

async function user(db: Db, handle: string, role = "member") {
  const [row] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, role, rules_accepted_at)
     VALUES ($1, $2, $2, $3, now()) RETURNING id`,
    [`${handle}@example.test`, handle, role],
  );
  return { id: row.id, status: "active", onboarded: true };
}

test("ACC01 — quitter un salon privé révoque aussi les flux déjà ouverts", async () => {
  const { db, lite } = await createTestDb();
  try {
    const owner = await user(db, "owner");
    const member = await user(db, "member");
    const room = await createRoom(db.query, owner, { name: "Salon privé", description: "", themeId: null, visibility: "private", format: "chat", postId: null });
    assert.ok(room.ok);
    await db.query(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)`, [room.roomId, member.id]);
    const cursor = await latestEventSeq(db.query, room.roomId);
    assert.ok((await leaveRoom(db, member, room.roomId)).ok);
    await db.transaction((q) => sendMessage(q, owner, room.roomId, { clientId: "after-leave", body: "Message privé après le départ" }));
    const events = await eventsSince(db.query, room.roomId, cursor);
    const revokeIndex = events.findIndex((e) => e.kind === "revoke" && e.targetUserId === member.id);
    const messageIndex = events.findIndex((e) => e.kind === "message");
    assert.ok(revokeIndex >= 0 && revokeIndex < messageIndex, "le flux doit être révoqué avant les nouveaux messages privés");
  } finally { await lite.close(); }
});

test("ACC02 — accepter une contestation ancienne ne lève pas un bannissement ultérieur", async () => {
  const { db, lite } = await createTestDb();
  try {
    const admin = await user(db, "admin1", "admin");
    const reviewer = await user(db, "admin2", "admin");
    const member = await user(db, "member");
    const suspension = await moderate(db, { moderatorId: admin.id, targetUserId: member.id, kind: "suspend", durationDays: 7, reason: "Première sanction" });
    assert.ok(suspension.ok);
    const appeal = await appealSanction(db.query, { actionId: suspension.actionId, userId: member.id, body: "Contestation de la première sanction" });
    assert.ok(appeal.ok);
    assert.ok((await moderate(db, { moderatorId: admin.id, targetUserId: member.id, kind: "ban", reason: "Nouvelle sanction indépendante" })).ok);
    assert.ok((await decideAppeal(db, { appealId: appeal.appealId, moderatorId: reviewer.id, decision: "levee", reason: "Première sanction annulée" })).ok);
    const [row] = await db.query(`SELECT status FROM users WHERE id = $1`, [member.id]);
    assert.equal(row.status, "banned", "le bannissement ultérieur reste applicable");
  } finally { await lite.close(); }
});

test("ACC03 — compte suspendu entre authentification et transaction : écriture refusée", async () => {
  const { db, lite } = await createTestDb();
  try {
    const owner = await user(db, "owner");
    const member = await user(db, "member");
    const room = await createRoom(db.query, owner, { name: "Salon public", description: "", themeId: null, visibility: "public", format: "chat", postId: null });
    assert.ok(room.ok);
    assert.ok((await joinRoom(db, member, room.roomId)).ok);
    // member représente le résultat d'authentification acquis avant la suspension.
    await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [member.id]);
    const result = await db.transaction((q) => sendMessage(q, member, room.roomId, { clientId: "stale-auth", body: "Écriture avec statut périmé" }));
    assert.equal(result.ok, false, "la transaction revérifie le statut persistant du compte");
    assert.equal((await db.query(`SELECT id FROM room_messages`)).length, 0);
  } finally { await lite.close(); }
});

test("ACC04 — bannir un propriétaire archive son salon si aucun modérateur ne reprend", async () => {
  const { db, lite } = await createTestDb();
  try {
    const admin = await user(db, "admin", "admin");
    const owner = await user(db, "owner");
    const room = await createRoom(db.query, owner, { name: "Salon sans relève", description: "", themeId: null, visibility: "public", format: "chat", postId: null });
    assert.ok(room.ok);
    assert.ok((await moderate(db, { moderatorId: admin.id, targetUserId: owner.id, kind: "ban", reason: "Bannissement du propriétaire" })).ok);
    const [row] = await db.query(`SELECT archived_at FROM rooms WHERE id = $1`, [room.roomId]);
    assert.ok(row.archived_at, "D5 §4.1 : archivage automatique en absence de modérateur");
  } finally { await lite.close(); }
});

test("ACC05 — une révision invalidant la vérification bloque la publication du brouillon", async () => {
  const { db, lite } = await createTestDb();
  try {
    const at = new Date();
    await db.query(`UPDATE editorial_config SET mode = 'public', paused = false WHERE id = 1`);
    const [source] = await db.query<{ id: string }>(`INSERT INTO editorial_sources (name, feed_url, source_type, priority, active, authorization_checked_at, authorization_reference) VALUES ('Source test', 'https://example.test/feed', 'primary', 1, true, now(), 'Fixture de recette') RETURNING id`);
    const [recap] = await db.query<{ id: string }>(`INSERT INTO editorial_recaps (slot_key, slot_at, state) VALUES ('acceptance', now(), 'ready') RETURNING id`);
    const [subject] = await db.query<{ id: string }>(`INSERT INTO editorial_subjects (group_key, title, status, recap_id) VALUES ('acceptance', 'Titre original', 'ready', $1) RETURNING id`, [recap.id]);
    await db.query(`INSERT INTO editorial_documents (source_id, url, normalized_url, title, summary, published_at, content_hash, status, extracted_text, subject_id) VALUES ($1, 'https://example.test/news', 'example.test/news', 'Titre original', 'Résumé', now(), 'test', 'grouped', 'Document original', $2)`, [source.id, subject.id]);
    const [item] = await db.query<{ id: string }>(`INSERT INTO editorial_recap_items (recap_id, subject_id, position, title, summary, scientific_status, sources, claims) VALUES ($1, $2, 1, 'Titre original', 'Résumé original du document', 'announcement', '[{"url":"https://example.test/news","title":"Source"}]', '{"statements":[],"simulated":true}') RETURNING id`, [recap.id, subject.id]);
    assert.ok((await db.transaction((q) => reviseRecapItem(q, { itemId: item.id, title: "Titre modifié non vérifié", summary: "Nouveau résumé sans vérification indépendante", motif: "Correction à vérifier", actorId: null, actorLabel: "test" }))).ok);
    const result = await publishRecap(db, { recapId: recap.id, expectedVersion: 1, now: at, actorId: null, actorLabel: "test" });
    assert.equal(result.ok, false, "aucune publication avec vérification invalidée");
    assert.equal((await db.query(`SELECT id FROM posts`)).length, 0);
  } finally { await lite.close(); }
});
