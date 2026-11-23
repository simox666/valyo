// RGPD (audit du 18 novembre 2026) : la suppression du compte efface réellement
// tout ce que la page Confidentialité promet — y compris l'e-mail des jetons de
// connexion et les messages privés — sans toucher aux données des autres membres.
import assert from "node:assert/strict";
import { test } from "node:test";
import { eraseAccount } from "../lib/social/account.ts";
import { createTestDb } from "./editorial-helpers.ts";

test("suppression de compte : effacement complet (e-mail partout, messages privés, traces), sans toucher aux autres", async () => {
  const { db } = await createTestDb();
  const user = async (h: string) =>
    (await db.query<{ id: string }>(
      `INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ($1, $2, $2, now()) RETURNING id`,
      [`${h}@exemple.fr`, h],
    ))[0].id;
  const [ana, ben] = [await user("ana"), await user("ben")];

  // Traces de connexion (e-mail en clair, avec casse différente), session ouverte.
  await db.query(`INSERT INTO login_tokens (token_hash, email, expires_at) VALUES ('t-ana', 'ANA@exemple.fr', now()), ('t-ben', 'ben@exemple.fr', now())`);
  await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('s-ana', $1, now() + interval '1 day')`, [ana]);
  // Vie sociale : messages privés, abonnement, blocage, notification, présence, contestation, retour.
  const [conv] = await db.query<{ id: string }>(
    `INSERT INTO conversations (user_a, user_b) VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid)) RETURNING id`,
    [ana, ben],
  );
  await db.query(`INSERT INTO direct_messages (conversation_id, sender_id, body) VALUES ($1, $2, 'coucou'), ($1, $3, 're')`, [conv.id, ana, ben]);
  await db.query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2)`, [ana, ben]);
  await db.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [ben, ana]);
  await db.query(`INSERT INTO notifications (user_id, kind, actor_id) VALUES ($1, 'reply', $2), ($2, 'reply', $1)`, [ana, ben]);
  await db.query(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, current_date)`, [ana]);
  await db.query(`INSERT INTO appeal_tokens (user_id, token_hash, expires_at) VALUES ($1, 'a-ana', now())`, [ana]);
  const [fb] = await db.query<{ id: string }>(`INSERT INTO feedback (user_id, kind, body) VALUES ($1, 'idee', 'super idée') RETURNING id`, [ana]);

  const result = await db.transaction((q) => eraseAccount(q, ana));
  assert.deepEqual(result, { ok: true });

  const count = async (sql: string, params: unknown[] = []) => (await db.query<{ n: number }>(sql, params))[0].n;
  // L'e-mail a disparu partout ; celui de ben est intact.
  assert.equal(await count(`SELECT count(*)::int AS n FROM login_tokens WHERE lower(email) = 'ana@exemple.fr'`), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM login_tokens WHERE email = 'ben@exemple.fr'`), 1);
  // Messages privés effacés (ils seraient invisibles de toute façon), sessions fermées, liens sociaux purgés.
  assert.equal(await count(`SELECT count(*)::int AS n FROM conversations`), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM direct_messages`), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM sessions WHERE user_id = $1`, [ana]), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM member_follows`), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_blocks`), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM appeal_tokens WHERE user_id = $1`, [ana]), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_activity_days WHERE user_id = $1`, [ana]), 0);
  // Ses notifications disparaissent ; celles de ben restent (l'acteur est anonymisé avec le profil).
  assert.equal(await count(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1`, [ana]), 0);
  assert.equal(await count(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1`, [ben]), 1);
  // Le retour reste, détaché de la personne ; le compte est anonymisé.
  const [feedback] = await db.query<{ user_id: string | null }>(`SELECT user_id FROM feedback WHERE id = $1`, [fb.id]);
  assert.equal(feedback.user_id, null);
  const [gone] = await db.query<{ email: string | null; handle: string | null; status: string }>(`SELECT email, handle, status FROM users WHERE id = $1`, [ana]);
  assert.deepEqual(gone, { email: null, handle: null, status: "deleted" });
});

test("suppression de compte : refusée tant qu'un salon actif est possédé", async () => {
  const { db } = await createTestDb();
  const [owner] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ('o@exemple.fr', 'proprio', 'proprio', now()) RETURNING id`,
  );
  const [room] = await db.query<{ id: string }>(`INSERT INTO rooms (name, owner_id, visibility) VALUES ('Labo', $1, 'public') RETURNING id`, [owner.id]);
  await db.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner')`, [room.id, owner.id]);
  const result = await db.transaction((q) => eraseAccount(q, owner.id));
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.rooms.map((r) => r.name), ["Labo"]);
});
