// Modération de plateforme (lot d'accélération D32-D35). PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import { sendMessage } from "../lib/rooms/chat.ts";
import type { RoomViewer } from "../lib/rooms/permissions.ts";
import { createRoom, joinRoom } from "../lib/rooms/service.ts";
import {
  appealSanction,
  createReport,
  decideAppeal,
  dismissReport,
  listOpenReports,
  moderate,
  reportContext,
} from "../lib/social/moderation.ts";
import type { Db } from "../lib/editorial/types.ts";
import { createTestDb } from "./editorial-helpers.ts";

let seq = 0;

async function addUser(db: Db, role = "member"): Promise<RoomViewer & { id: string }> {
  const n = ++seq;
  const [u] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, role, status, rules_accepted_at) VALUES ($1, $2, $3, $4, 'active', now()) RETURNING id`,
    [`mod-${n}@example.test`, `mod_${n}`, `Membre ${n}`, role],
  );
  return { id: u.id, status: "active", onboarded: true };
}

test("signalement d'un message privé : réservé aux membres du salon ; contexte borné et consultations journalisées", async () => {
  const { db } = await createTestDb();
  const moderator = await addUser(db, "admin");
  const owner = await addUser(db);
  const member = await addUser(db);
  const outsider = await addUser(db);
  const created = await createRoom(db.query, owner, { name: "Salon privé signalé", description: "", themeId: null, visibility: "private", format: "chat", postId: null });
  const roomId = created.ok ? created.roomId : "";
  await db.query(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)`, [roomId, member.id]);

  // 25 messages étalés : le contexte doit rester borné à ±10.
  let reportedId = "";
  for (let i = 1; i <= 25; i++) {
    const sent = await db.transaction((q) => sendMessage(q, owner, roomId, { clientId: `ctx-${i}`, body: `Message ${i}` }));
    if (i === 13 && sent.ok) reportedId = sent.message.id;
  }

  const refused = await db.transaction((q) =>
    createReport(q, { reporterId: outsider.id, targetKind: "message", targetId: reportedId, reason: "harcelement", details: "" }),
  );
  assert.equal(refused.ok, false, "un non-membre ne signale pas un message privé qu'il ne peut pas lire");

  const report = await db.transaction((q) =>
    createReport(q, { reporterId: member.id, targetKind: "message", targetId: reportedId, reason: "harcelement", details: "Voir le ton." }),
  );
  assert.ok(report.ok);
  const context = await reportContext(db, { reportId: report.ok ? report.reportId : "", moderatorId: moderator.id });
  assert.ok(context.ok);
  const messages = context.ok ? context.messages : [];
  assert.equal(messages.length, 21, "le message signalé, 10 avant, 10 après — pas plus");
  assert.equal(messages.filter((m) => m.signale).length, 1);
  const views = await db.query(`SELECT moderator_id FROM report_views WHERE report_id = $1`, [report.ok ? report.reportId : ""]);
  assert.deepEqual(views.map((v) => v.moderator_id), [moderator.id], "chaque consultation est journalisée");
});

test("suspension : statut daté, notification motivée, flux révoqués, SESSION CONSERVÉE ; bannissement : sessions fermées", async () => {
  const { db } = await createTestDb();
  const moderator = await addUser(db, "admin");
  const target = await addUser(db);
  const owner = await addUser(db);
  const created = await createRoom(db.query, owner, { name: "Salon du sanctionné", description: "", themeId: null, visibility: "public", format: "chat", postId: null });
  const roomId = created.ok ? created.roomId : "";
  assert.ok((await joinRoom(db, target, roomId)).ok);
  await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('h1', $1, now() + interval '1 day')`, [target.id]);

  const suspended = await moderate(db, { moderatorId: moderator.id, targetUserId: target.id, kind: "suspend", durationDays: 7, reason: "Propos répétés hors règles" });
  assert.ok(suspended.ok);
  const [user] = await db.query(`SELECT status, suspended_until FROM users WHERE id = $1`, [target.id]);
  assert.equal(user.status, "suspended");
  assert.ok(user.suspended_until, "suspension datée");
  assert.equal((await db.query(`SELECT 1 FROM sessions WHERE user_id = $1`, [target.id])).length, 1, "la session reste : lecture publique possible");
  const revokes = await db.query(`SELECT 1 FROM room_events WHERE kind = 'revoke' AND target_user_id = $1`, [target.id]);
  assert.equal(revokes.length, 1, "les flux temps réel du membre sont révoqués");
  const [notif] = await db.query(`SELECT body FROM notifications WHERE user_id = $1 AND kind = 'moderation'`, [target.id]);
  assert.match(notif.body as string, /suspendu.*Propos répétés hors règles/s);

  const banned = await moderate(db, { moderatorId: moderator.id, targetUserId: target.id, kind: "ban", reason: "Récidive" });
  assert.ok(banned.ok);
  const [user2] = await db.query(`SELECT status, suspended_until FROM users WHERE id = $1`, [target.id]);
  assert.deepEqual([user2.status, user2.suspended_until], ["banned", null], "bannissement distinct de la suspension");
  assert.equal((await db.query(`SELECT 1 FROM sessions WHERE user_id = $1`, [target.id])).length, 0, "le bannissement ferme les sessions");
});

test("retrait de contenu tracé et file de signalements traitée", async () => {
  const { db } = await createTestDb();
  const moderator = await addUser(db, "admin");
  const reporter = await addUser(db);
  const author = await addUser(db);
  const [post] = await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', 'À retirer', 'Corps.') RETURNING id`, [author.id]);

  const report = await db.transaction((q) => createReport(q, { reporterId: reporter.id, targetKind: "post", targetId: post.id, reason: "regles", details: "" }));
  assert.ok(report.ok);
  assert.equal((await listOpenReports(db.query)).length, 1);

  const action = await moderate(db, {
    moderatorId: moderator.id,
    targetUserId: author.id,
    reportId: report.ok ? report.reportId : null,
    kind: "remove_content",
    contentKind: "post",
    contentId: post.id,
    reason: "Hors règles de publication",
  });
  assert.ok(action.ok);
  const [p] = await db.query(`SELECT status FROM posts WHERE id = $1`, [post.id]);
  assert.equal(p.status, "removed");
  assert.equal((await listOpenReports(db.query)).length, 0, "le signalement est traité");
  const [r] = await db.query(`SELECT decision FROM reports`);
  assert.match(r.decision as string, /remove_content/);

  // Classement sans suite d'un second signalement.
  const second = await db.transaction((q) => createReport(q, { reporterId: reporter.id, targetKind: "member", targetId: author.id, reason: "autre", details: "" }));
  assert.ok(second.ok && (await db.transaction((q) => dismissReport(q, second.ok ? second.reportId : "", moderator.id, "sans objet"))));
});

test("contestation : 14 jours, une seule, examinateur distinct quand c'est possible, levée effective", async () => {
  const { db } = await createTestDb();
  const modA = await addUser(db, "admin");
  const modB = await addUser(db, "admin");
  const target = await addUser(db);
  const suspended = await moderate(db, { moderatorId: modA.id, targetUserId: target.id, kind: "suspend", durationDays: 30, reason: "Motif initial" });
  const actionId = suspended.ok ? suspended.actionId : "";

  const appeal = await db.transaction((q) => appealSanction(q, { actionId, userId: target.id, body: "Je conteste cette décision motivée." }));
  assert.ok(appeal.ok);
  const again = await db.transaction((q) => appealSanction(q, { actionId, userId: target.id, body: "Deuxième contestation interdite." }));
  assert.deepEqual([again.ok, (again as { code: string }).code], [false, "deja"]);

  // L'auteur de la sanction ne tranche pas sa propre contestation quand un autre admin existe.
  const self = await decideAppeal(db, { appealId: appeal.ok ? appeal.appealId : "", moderatorId: modA.id, decision: "maintenue", reason: "x longue" });
  assert.deepEqual([self.ok, (self as { code: string }).code], [false, "examinateur"]);
  const decided = await decideAppeal(db, { appealId: appeal.ok ? appeal.appealId : "", moderatorId: modB.id, decision: "levee", reason: "Contexte vérifié" });
  assert.ok(decided.ok);
  const [user] = await db.query(`SELECT status FROM users WHERE id = $1`, [target.id]);
  assert.equal(user.status, "active", "la levée réactive le compte");
  const notif = await db.query(`SELECT body FROM notifications WHERE user_id = $1 AND kind = 'moderation' ORDER BY created_at DESC LIMIT 1`, [target.id]);
  assert.match(notif[0].body as string, /acceptée/);

  // Hors délai : refusée.
  const old = await moderate(db, { moderatorId: modA.id, targetUserId: target.id, kind: "warn", reason: "Ancien avertissement" });
  await db.query(`UPDATE moderation_actions SET created_at = now() - interval '15 days' WHERE id = $1`, [old.ok ? old.actionId : ""]);
  const late = await db.transaction((q) => appealSanction(q, { actionId: old.ok ? old.actionId : "", userId: target.id, body: "Trop tard, quinze jours." }));
  assert.deepEqual([late.ok, (late as { code: string }).code], [false, "delai"]);
});
