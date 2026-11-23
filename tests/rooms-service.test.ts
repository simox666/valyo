// Salons et droits (lot d'accélération B11 à B20) : matrice de permissions,
// adhésions, invitations à usage unique, sanctions, transferts, garde de
// suppression de compte. PGlite en mémoire.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canDiscoverRoom,
  canJoinRoom,
  canManageRoom,
  canModerateRoom,
  canReadRoom,
  canWriteRoom,
  loadAccess,
  type RoomViewer,
} from "../lib/rooms/permissions.ts";
import {
  acceptInvitation,
  answerTransfer,
  cleanupRoomsForDeletedAccount,
  createInvitation,
  createRoom,
  deleteRoom,
  joinRoom,
  leaveRoom,
  liftBan,
  ownedActiveRooms,
  proposeTransfer,
  revokeInvitation,
  sanctionMember,
  setFollowing,
  setMemberRole,
  updateRoom,
} from "../lib/rooms/service.ts";
import type { Db } from "../lib/editorial/types.ts";
import { createTestDb } from "./editorial-helpers.ts";

let seq = 0;

async function addUser(db: Db, status = "active"): Promise<RoomViewer> {
  const n = ++seq;
  const [u] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, status, rules_accepted_at) VALUES ($1, $2, $3, $4, now()) RETURNING id`,
    [`membre-${n}@example.test`, `membre_${n}`, `Membre ${n}`, status],
  );
  return { id: u.id, status, onboarded: true };
}

async function makeRoom(db: Db, owner: RoomViewer, visibility: "public" | "private" = "public") {
  const out = await createRoom(db.query, owner, { name: `Salon ${++seq}`, description: "", themeId: null, visibility, format: "chat", postId: null });
  assert.ok(out.ok);
  return out.ok ? out.roomId : "";
}

test("matrice des droits : visiteur, non-membre, membre, modérateur, propriétaire, suspendu, banni", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const moderator = await addUser(db);
  const member = await addUser(db);
  const outsider = await addUser(db);
  const suspended = await addUser(db, "suspended");
  const banned = await addUser(db);

  const roomId = await makeRoom(db, owner, "public");
  for (const u of [moderator, member, banned]) assert.ok((await joinRoom(db, u, roomId)).ok);
  assert.ok((await setMemberRole(db, owner, roomId, moderator.id, "moderator")).ok);
  assert.ok((await sanctionMember(db, owner, roomId, banned.id, { kind: "ban", days: null }, "test")).ok);

  const expect = async (viewer: RoomViewer | null, flags: [boolean, boolean, boolean, boolean, boolean, boolean]) => {
    const a = await loadAccess(db.query, roomId, viewer);
    assert.deepEqual(
      [canDiscoverRoom(a), canReadRoom(a), canJoinRoom(a), canWriteRoom(a), canModerateRoom(a), canManageRoom(a)],
      flags,
      `droits pour ${viewer?.id ?? "visiteur"}`,
    );
  };
  //                     découvrir, lire, rejoindre, écrire, modérer, gérer
  await expect(null, [true, false, false, false, false, false]);
  await expect(outsider, [true, false, true, false, false, false]);
  await expect(member, [true, true, false, true, false, false]);
  await expect(moderator, [true, true, false, true, true, false]);
  await expect(owner, [true, true, false, true, true, true]);
  await expect(suspended, [true, false, false, false, false, false]);
  await expect(banned, [true, false, false, false, false, false]);

  // Salon privé : invisible aux non-membres, lisible par ses membres.
  const privateId = await makeRoom(db, owner, "private");
  const aOutsider = await loadAccess(db.query, privateId, outsider);
  assert.deepEqual([canDiscoverRoom(aOutsider), canReadRoom(aOutsider), canJoinRoom(aOutsider)], [false, false, false]);
  const aOwner = await loadAccess(db.query, privateId, owner);
  assert.deepEqual([canDiscoverRoom(aOwner), canReadRoom(aOwner)], [true, true]);
});

test("création depuis une publication : association réciproque, créateur propriétaire et suiveur", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const [post] = await db.query<{ id: string }>(
    `INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', 'Publication d''origine', 'Texte.') RETURNING id`,
    [owner.id],
  );
  const out = await createRoom(db.query, owner, {
    name: "Discussion de la publication",
    description: "Pour aller plus loin",
    themeId: null,
    visibility: "public",
    format: "chat",
    postId: post.id,
  });
  assert.ok(out.ok);
  const roomId = out.ok ? out.roomId : "";
  const links = await db.query(`SELECT * FROM room_posts WHERE post_id = $1 AND room_id = $2`, [post.id, roomId]);
  assert.equal(links.length, 1);
  const [membership] = await db.query(`SELECT role, following FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, owner.id]);
  assert.deepEqual([membership.role, membership.following], ["owner", true]);
});

test("exclusion : retrait immédiat, retour public refusé avant 24 h ; bannissement : aucune invitation ne contourne", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const member = await addUser(db);
  const roomId = await makeRoom(db, owner);
  assert.ok((await joinRoom(db, member, roomId)).ok);

  assert.ok((await sanctionMember(db, owner, roomId, member.id, { kind: "kick" }, "hors sujet répété")).ok);
  assert.equal((await db.query(`SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, member.id])).length, 0);
  const rejoin = await joinRoom(db, member, roomId);
  assert.deepEqual([rejoin.ok, (rejoin as { code: string }).code], [false, "exclu"]);

  // Après l'effet de l'exclusion (plus de 24 h), le retour public redevient possible.
  await db.query(`UPDATE room_sanctions SET created_at = now() - interval '25 hours' WHERE room_id = $1 AND user_id = $2`, [roomId, member.id]);
  assert.ok((await joinRoom(db, member, roomId)).ok);

  // Bannissement : retrait, retour refusé, et l'invitation ne contourne pas.
  assert.ok((await sanctionMember(db, owner, roomId, member.id, { kind: "ban", days: 7 }, "récidive")).ok);
  const again = await joinRoom(db, member, roomId);
  assert.equal((again as { code: string }).code, "banni");
  const invitation = await createInvitation(db.query, owner, roomId);
  assert.ok(invitation.ok);
  const viaInvite = await acceptInvitation(db, member, invitation.ok ? invitation.token : "");
  assert.deepEqual([viaInvite.ok, (viaInvite as { code: string }).code], [false, "banni"]);

  // Levée du bannissement : le retour public redevient possible.
  assert.ok((await liftBan(db, owner, roomId, member.id)).ok);
  assert.ok((await joinRoom(db, member, roomId)).ok);
});

test("invitations : hachées en base, usage unique atomique, révocation et expiration", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const guestA = await addUser(db);
  const guestB = await addUser(db);
  const member = await addUser(db);
  const roomId = await makeRoom(db, owner, "private");

  // Un simple membre ne peut pas inviter.
  await db.query(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)`, [roomId, member.id]);
  const refused = await createInvitation(db.query, member, roomId);
  assert.equal(refused.ok, false);

  const invitation = await createInvitation(db.query, owner, roomId);
  assert.ok(invitation.ok);
  const token = invitation.ok ? invitation.token : "";
  // Jamais de jeton en clair en base.
  const [stored] = await db.query(`SELECT token_hash FROM room_invitations`);
  assert.notEqual(stored.token_hash, token);
  assert.equal((stored.token_hash as string).length, 64);

  // Deux acceptations du même jeton : un seul usage.
  const [first, second] = [await acceptInvitation(db, guestA, token), await acceptInvitation(db, guestB, token)];
  assert.ok(first.ok);
  assert.deepEqual([second.ok, (second as { code: string }).code], [false, "utilisee"]);
  assert.equal((await db.query(`SELECT 1 FROM room_members WHERE room_id = $1`, [roomId])).length, 3);

  // Révocation et expiration.
  const inv2 = await createInvitation(db.query, owner, roomId);
  assert.ok(inv2.ok && (await revokeInvitation(db, owner, roomId, inv2.invitationId)).ok);
  assert.equal(((await acceptInvitation(db, guestB, inv2.ok ? inv2.token : "")) as { code: string }).code, "revoquee");
  const inv3 = await createInvitation(db.query, owner, roomId);
  await db.query(`UPDATE room_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [inv3.ok ? inv3.invitationId : ""]);
  assert.equal(((await acceptInvitation(db, guestB, inv3.ok ? inv3.token : "")) as { code: string }).code, "expiree");
});

test("départ : la personne propriétaire doit transférer ou archiver ; quitter un salon privé retire l'historique", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const member = await addUser(db);
  const roomId = await makeRoom(db, owner, "private");
  await db.query(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)`, [roomId, member.id]);

  const blocked = await leaveRoom(db, owner, roomId);
  assert.deepEqual([blocked.ok, (blocked as { code: string }).code], [false, "propriete"]);

  assert.ok((await leaveRoom(db, member, roomId)).ok);
  const after = await loadAccess(db.query, roomId, member);
  assert.equal(canReadRoom(after), false, "l'historique n'est plus accessible");

  // Après archivage, le propriétaire peut partir ; le salon n'accepte plus d'écriture ni d'invitation.
  assert.ok((await updateRoom(db, owner, roomId, { archive: true })).ok);
  const archivedAccess = await loadAccess(db.query, roomId, owner);
  assert.deepEqual([canReadRoom(archivedAccess), canWriteRoom(archivedAccess)], [true, false]);
  assert.equal((await createInvitation(db.query, owner, roomId)).ok, false);
  assert.ok((await leaveRoom(db, owner, roomId)).ok);
});

test("rôles et sanctions hiérarchiques : un modérateur ne sanctionne pas un modérateur, le propriétaire si", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const modA = await addUser(db);
  const modB = await addUser(db);
  const roomId = await makeRoom(db, owner);
  for (const u of [modA, modB]) {
    assert.ok((await joinRoom(db, u, roomId)).ok);
    assert.ok((await setMemberRole(db, owner, roomId, u.id, "moderator")).ok);
  }
  assert.equal((await setMemberRole(db, modA, roomId, modB.id, "member")).ok, false, "les rôles restent au propriétaire");
  const refused = await sanctionMember(db, modA, roomId, modB.id, { kind: "kick" }, "conflit");
  assert.equal(refused.ok, false);
  assert.ok((await sanctionMember(db, owner, roomId, modB.id, { kind: "kick" }, "décision propriétaire")).ok);
  const self = await sanctionMember(db, owner, roomId, owner.id, { kind: "kick" }, "soi-même");
  assert.equal(self.ok, false);
});

test("transfert : proposition vers un membre, effet à l'acceptation, expiration respectée", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const member = await addUser(db);
  const outsider = await addUser(db);
  const roomId = await makeRoom(db, owner);
  assert.ok((await joinRoom(db, member, roomId)).ok);

  assert.equal((await proposeTransfer(db, owner, roomId, outsider.id)).ok, false, "le destinataire doit être membre");
  const t1 = await proposeTransfer(db, owner, roomId, member.id);
  assert.ok(t1.ok);

  // Expiré : refus, la propriété ne bouge pas.
  await db.query(`UPDATE room_transfers SET expires_at = now() - interval '1 minute' WHERE id = $1`, [t1.ok ? t1.transferId : ""]);
  const expired = await answerTransfer(db, member, t1.ok ? t1.transferId : "", "accept");
  assert.deepEqual([expired.ok, (expired as { code: string }).code], [false, "expire"]);

  const t2 = await proposeTransfer(db, owner, roomId, member.id);
  assert.ok(t2.ok);
  assert.ok((await answerTransfer(db, member, t2.ok ? t2.transferId : "", "accept")).ok);
  const [room] = await db.query(`SELECT owner_id FROM rooms WHERE id = $1`, [roomId]);
  assert.equal(room.owner_id, member.id);
  const roles = await db.query(`SELECT user_id, role FROM room_members WHERE room_id = $1 ORDER BY role`, [roomId]);
  assert.deepEqual(
    roles.map((r) => [r.user_id === member.id ? "nouveau" : "ancien", r.role]),
    [["ancien", "member"], ["nouveau", "owner"]],
  );
  // L'ancien propriétaire peut maintenant quitter.
  assert.ok((await leaveRoom(db, owner, roomId)).ok);
});

test("suppression de compte : bloquée tant qu'un salon actif est possédé ; nettoyage ensuite", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const member = await addUser(db);
  const roomId = await makeRoom(db, owner);
  assert.ok((await joinRoom(db, member, roomId)).ok);

  assert.equal((await ownedActiveRooms(db.query, owner.id)).length, 1, "salon actif possédé : suppression à bloquer");
  assert.equal((await ownedActiveRooms(db.query, member.id)).length, 0);

  const t = await proposeTransfer(db, owner, roomId, member.id);
  assert.ok(t.ok);
  const inv = await createInvitation(db.query, owner, roomId);
  assert.ok(inv.ok);

  assert.ok((await updateRoom(db, owner, roomId, { archive: true })).ok);
  assert.equal((await ownedActiveRooms(db.query, owner.id)).length, 0, "salon archivé : suppression possible");

  await db.transaction((q) => cleanupRoomsForDeletedAccount(q, owner.id));
  assert.equal((await db.query(`SELECT 1 FROM room_members WHERE user_id = $1`, [owner.id])).length, 0);
  const [transfer] = await db.query(`SELECT cancelled_at FROM room_transfers WHERE id = $1`, [t.ok ? t.transferId : ""]);
  assert.ok(transfer.cancelled_at, "transfert ouvert annulé");
  const [invitation] = await db.query(`SELECT revoked_at FROM room_invitations WHERE id = $1`, [inv.ok ? inv.invitationId : ""]);
  assert.ok(invitation.revoked_at, "invitation non utilisée révoquée");
});

test("suivre un salon est distinct d'y adhérer", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const member = await addUser(db);
  const outsider = await addUser(db);
  const roomId = await makeRoom(db, owner);
  assert.ok((await joinRoom(db, member, roomId)).ok);
  const [m] = await db.query(`SELECT following FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, member.id]);
  assert.equal(m.following, false, "rejoindre ne suit pas automatiquement (sauf créateur)");
  assert.ok((await setFollowing(db, member, roomId, true)).ok);
  assert.equal((await setFollowing(db, outsider, roomId, true)).ok, false, "suivre exige l'adhésion");
});

test("suppression d'un salon : propriétaire seul, nom exact exigé, tout disparaît, signalements détachés", async () => {
  const { db } = await createTestDb();
  const owner = await addUser(db);
  const member = await addUser(db);
  const roomId = await makeRoom(db, owner);
  assert.ok((await joinRoom(db, member, roomId)).ok);
  await db.query(`INSERT INTO room_messages (room_id, author_id, client_id, body) VALUES ($1, $2, 'c1', 'bonjour')`, [roomId, member.id]);
  await db.query(
    `INSERT INTO reports (reporter_id, target_kind, target_id, room_id, reason) VALUES ($1, 'message', $2, $3, 'spam')`,
    [owner.id, roomId, roomId],
  );
  const [room] = await db.query<{ name: string }>(`SELECT name FROM rooms WHERE id = $1`, [roomId]);

  // Refus : membre ordinaire, puis mauvais nom.
  const byMember = await deleteRoom(db, member, roomId, room.name);
  assert.equal(byMember.ok, false);
  if (!byMember.ok) assert.equal(byMember.code, "droit");
  const wrongName = await deleteRoom(db, owner, roomId, "Pas le bon nom");
  assert.equal(wrongName.ok, false);
  if (!wrongName.ok) assert.equal(wrongName.code, "confirmation");

  // Suppression réelle : salon, messages et membres disparaissent ; le signalement reste, détaché.
  assert.deepEqual(await deleteRoom(db, owner, roomId, ` ${room.name} `), { ok: true }, "le nom est comparé sans espaces parasites");
  const count = async (sql: string) => (await db.query<{ n: number }>(sql, [roomId]))[0].n;
  assert.equal(await count(`SELECT count(*)::int AS n FROM rooms WHERE id = $1`), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM room_messages WHERE room_id = $1`), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM room_members WHERE room_id = $1`), 0);
  const [report] = await db.query<{ room_id: string | null }>(`SELECT room_id FROM reports`);
  assert.equal(report.room_id, null, "le signalement survit, détaché du salon supprimé");

  // Un salon archivé reste supprimable par sa personne propriétaire.
  const second = await makeRoom(db, owner);
  assert.ok((await updateRoom(db, owner, second, { archive: true })).ok);
  const [name2] = await db.query<{ name: string }>(`SELECT name FROM rooms WHERE id = $1`, [second]);
  assert.deepEqual(await deleteRoom(db, owner, second, name2.name), { ok: true });
});
