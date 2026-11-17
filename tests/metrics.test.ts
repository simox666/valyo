// Vérifie l'indicateur « reliés et revenus » sur une vraie base PostgreSQL
// embarquée, avec des dates contrôlées.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS } from "../lib/migrations.ts";
import { CONNECTION_COHORTS_SQL, ACTIVITY_SPLIT_SQL } from "../lib/metrics-sql.ts";

test("indicateur de liens : agent exclu, fenêtres de 7 et 14 jours respectées", async () => {
  const db = new PGlite();
  for (const m of MIGRATIONS) for (const s of m.statements) await db.query(s);

  // Inscriptions il y a 25 jours : cohorte complète quel que soit le jour de la semaine (semaine + 21 jours écoulés).
  const joined = "now() - interval '25 days'";
  const day = (n: number) => `now() - interval '25 days' + interval '${n} days'`;
  const user = async (handle: string) =>
    (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, ${joined}) RETURNING id`, [handle])).rows[0].id;
  const agent = (await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'agent'`)).rows[0].id;

  const ana = await user("ana"); // échange humain + retour → compte
  const ben = await user("ben"); // échange humain, pas de retour
  const cleo = await user("cleo"); // commente seulement l'agent, revient → revenu mais pas relié
  const dan = await user("dan"); // échange humain trop tard (jour 9) → pas relié

  const post = async (author: string, at: string) =>
    (await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body, created_at) VALUES ($1, 'question', 'Titre', 'x', ${at}) RETURNING id`, [author])).rows[0].id;
  const comment = async (postId: string, author: string, at: string, parent: string | null = null) =>
    (await db.query<{ id: string }>(`INSERT INTO comments (post_id, author_id, parent_id, body, created_at) VALUES ($1, $2, $3, 'x', ${at}) RETURNING id`, [postId, author, parent])).rows[0].id;

  const anaPost = await post(ana, day(1));
  await comment(anaPost, ben, day(2)); // ben commente la publication d'ana : relie ana et ben
  const agentPost = await post(agent, day(1));
  await comment(agentPost, cleo, day(2)); // avec l'agent : ne relie personne
  const danPost = await post(dan, day(1));
  await comment(danPost, ana, day(9)); // trop tard pour dan

  await db.query(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, (${day(9)})::date), ($2, (${day(10)})::date)`, [ana, cleo]);

  const rows = (await db.query<{ new_members: number; linked: number; returned: number; linked_and_returned: number; complete: boolean }>(CONNECTION_COHORTS_SQL, [8])).rows;
  const total = rows.reduce(
    (acc, r) => ({ n: acc.n + r.new_members, l: acc.l + r.linked, r: acc.r + r.returned, lr: acc.lr + r.linked_and_returned }),
    { n: 0, l: 0, r: 0, lr: 0 },
  );
  assert.equal(total.n, 4, "l'agent n'est pas compté comme nouveau membre");
  assert.equal(total.l, 2, "ana et ben reliés ; cleo (agent) et dan (trop tard) non");
  // ana revient (activité j9 + commentaire j9) ; cleo revient (activité j10). dan est actif au jour 1 seulement.
  assert.equal(total.r, 2);
  assert.equal(total.lr, 1, "seule ana est reliée et revenue");
  assert.ok(rows.every((r) => r.complete));

  const split = (await db.query<{ agent_posts: number; human_posts: number }>(ACTIVITY_SPLIT_SQL)).rows[0];
  assert.equal(split.agent_posts, 0, "publications de plus de 7 jours exclues");
  await db.close();
});

test("indicateur identique quel que soit le fuseau de la session (A004)", async () => {
  const db = new PGlite();
  for (const m of MIGRATIONS) for (const s of m.statements) await db.query(s);

  // Un dimanche à 23 h 30 UTC (lundi 0 h 30 à Bruxelles), il y a entre 21 et 27 jours : cohorte complète.
  const joined = new Date(Date.now() - 21 * 86400000);
  joined.setUTCHours(23, 30, 0, 0);
  while (joined.getUTCDay() !== 0 || joined.getTime() > Date.now() - 21 * 86400000) joined.setUTCDate(joined.getUTCDate() - 1);
  const mondayUtc = new Date(joined.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const joinedDayUtc = joined.toISOString().slice(0, 10);

  const [ana, ben] = await Promise.all(
    ["ana", "ben"].map(async (h) =>
      (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, $2) RETURNING id`, [h, joined.toISOString()])).rows[0].id,
    ),
  );
  const post = (await db.query<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body, created_at) VALUES ($1, 'question', 'Titre', 'x', $2) RETURNING id`, [ana, joined.toISOString()])).rows[0].id;
  await db.query(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES ($1, $2, 'x', $3)`, [post, ben, new Date(joined.getTime() + 3600000).toISOString()]);
  // Ana revient au 8e jour UTC exactement (jour d'inscription + 7).
  await db.query(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, ($2::date + 7))`, [ana, joinedDayUtc]);

  const results: unknown[] = [];
  for (const zone of ["UTC", "Europe/Brussels", "Pacific/Kiritimati"]) {
    await db.query(`SET TIME ZONE '${zone}'`);
    const rows = (await db.query(CONNECTION_COHORTS_SQL, [8])).rows;
    results.push(rows);
  }
  assert.deepEqual(results[1], results[0], "Bruxelles = UTC");
  assert.deepEqual(results[2], results[0], "UTC+14 = UTC");
  assert.deepEqual(results[0], [{ week: mondayUtc, new_members: 2, linked: 2, returned: 1, linked_and_returned: 1, complete: true }]);
  await db.close();
});

test("salons et chat (E39) : agrégats seulement, lecture et contribution séparées", async () => {
  const db = new PGlite();
  for (const m of MIGRATIONS) for (const s of m.statements) await db.query(s);
  const user = async (handle: string) =>
    (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ($1, $1, now()) RETURNING id`, [handle])).rows[0].id;
  const owner = await user("prop");
  const reader = await user("lecteur");
  const roomA = (await db.query<{ id: string }>(`INSERT INTO rooms (name, owner_id, visibility) VALUES ('Salon A', $1, 'public') RETURNING id`, [owner])).rows[0].id;
  const roomB = (await db.query<{ id: string }>(`INSERT INTO rooms (name, owner_id, visibility, archived_at) VALUES ('Salon B', $1, 'private', now()) RETURNING id`, [owner])).rows[0].id;
  await db.query(`INSERT INTO room_members (room_id, user_id, role, following) VALUES ($1, $2, 'owner', true), ($1, $3, 'member', false), ($4, $2, 'owner', true)`, [roomA, owner, reader, roomB]);
  await db.query(`INSERT INTO room_messages (room_id, author_id, client_id, body) VALUES ($1, $2, 'm1', 'x'), ($1, $2, 'm2', 'y')`, [roomA, owner]);
  // Un message supprimé ne compte pas.
  await db.query(`INSERT INTO room_messages (room_id, author_id, client_id, body, deleted_at) VALUES ($1, $2, 'm3', 'z', now())`, [roomA, owner]);

  const { ROOMS_ACTIVITY_SQL } = await import("../lib/metrics-sql.ts");
  const [r] = (await db.query<import("../lib/metrics-sql.ts").RoomsActivity>(ROOMS_ACTIVITY_SQL)).rows;
  assert.equal(r.active_rooms, 1, "le salon archivé n'est pas actif");
  assert.equal(r.rooms_created, 2);
  assert.equal(r.rooms_with_activity, 1);
  assert.equal(r.messages, 2, "le message supprimé ne compte pas");
  assert.equal(r.writers, 1, "contribution : un seul membre a écrit");
  assert.equal(r.members, 2, "lecture : deux membres distincts");
  assert.equal(r.followers, 1);
});
