// Recette de concurrence multi-connexions sur un VRAI PostgreSQL (lot d'accélération E37).
//
//   DATABASE_URL_TEST=postgres://... npm run recette:concurrence
//
// EXIGE une base DÉDIÉE et vierge (variable distincte DATABASE_URL_TEST : jamais la
// production, jamais la base de développement). Le script refuse de démarrer sans elle,
// applique les migrations, exécute les scénarios ci-dessous avec un vrai pool de
// connexions (chaque opération concurrente a SA connexion), puis AFFICHE un rapport.
//
// Scénarios couverts (verrous à éprouver hors PGlite mono-processus) :
//   1. réservations de budget simultanées près du plafond (pg_advisory_xact_lock) ;
//   2. réclamations de tâches simultanées (FOR UPDATE SKIP LOCKED) : une seule gagnante par tâche ;
//   3. acceptations simultanées d'une même invitation : un seul usage ;
//   4. publications simultanées près de la limite D6 : seules les places restantes passent ;
//   5. envois simultanés du même identifiant client : un seul message ; limite 20/min atomique ;
//   6. allocation/commit de deux messages sous barrière explicite, reprise sans omission ;
//   7–8. suspension et archivage contre une écriture déjà authentifiée, bloquée puis refusée.
//
// État : OUTILLAGE LIVRÉ, EXÉCUTION MANQUANTE tant qu'aucune instance PostgreSQL de
// test n'est disponible (aucune ne l'était sur le poste de développement).

import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL_TEST;
if (!url) {
  console.error(
    "DATABASE_URL_TEST est obligatoire (base PostgreSQL DÉDIÉE et vierge).\n" +
      "Refus volontaire d'utiliser DATABASE_URL : cette recette écrit et efface des données.",
  );
  process.exit(1);
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
  console.error("DATABASE_URL_TEST ne doit pas être la base applicative (DATABASE_URL). Arrêt.");
  process.exit(1);
}

const { default: pg } = await import("pg");
const { MIGRATIONS } = await import("../lib/migrations.ts");
const { reserve, budgetSummary } = await import("../lib/editorial/budget.ts");
const { utcPeriod } = await import("../lib/editorial/time.ts");
const { enqueue, claim } = await import("../lib/editorial/tasks.ts");
const { createRoom, createInvitation, acceptInvitation } = await import("../lib/rooms/service.ts");
const { sendMessage } = await import("../lib/rooms/chat.ts");
const { runLimited } = await import("../lib/limits.ts");
import type { Db, Query } from "../lib/editorial/types.ts";

const pool = new pg.Pool({ connectionString: url, max: 24 });

/** Une transaction = UNE connexion du pool : la concurrence est réelle, pas simulée. */
const db: Db = {
  query: async (text, params) => (await pool.query(text, params)).rows as never,
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const q: Query = async (text, params) => (await client.query(text, params)).rows as never;
      const result = await fn(q);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  },
};

const report: { scenario: string; attendu: string; obtenu: string; ok: boolean }[] = [];
const check = (scenario: string, attendu: string, obtenu: string, ok: boolean) => {
  report.push({ scenario, attendu, obtenu, ok });
  console.log(`${ok ? "✔" : "✘"} ${scenario} — attendu : ${attendu} ; obtenu : ${obtenu}`);
};

// Base vierge exigée.
const [{ n: userCount }] = await db.query<{ n: string }>(`SELECT count(*) AS n FROM pg_tables WHERE schemaname = 'public'`);
if (Number(userCount) === 0) {
  for (const m of MIGRATIONS) for (const s of m.statements) await db.query(s);
} else {
  const [{ n }] = await db.query<{ n: string }>(
    `SELECT (SELECT count(*) FROM users WHERE role <> 'agent') + (SELECT count(*) FROM posts) AS n`,
  ).catch(() => [{ n: "1" }]);
  if (Number(n) > 0) {
    console.error("La base DATABASE_URL_TEST n'est pas vierge : arrêt sans écriture.");
    process.exit(1);
  }
}

const addUser = async (handle: string) =>
  (
    await db.query<{ id: string }>(
      `INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ($1, $2, $2, now()) RETURNING id`,
      [`${handle}@recette.test`, handle],
    )
  )[0].id;

// ── 1. Budget : 8 réservations simultanées de 3 unités sous un plafond de 10. ──
{
  const cap = 10_000_000n;
  const outcomes = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      db.transaction(async (q) => {
        const [batch] = await q<{ id: string }>(
          `INSERT INTO editorial_batches (provider, state, task_ids) VALUES ('test', 'submitting', '{}') RETURNING id`,
        );
        return reserve(q, { batchId: batch.id, estimateMicros: 3_000_000n, capMicros: cap, currency: "USD", now: new Date() });
      }),
    ),
  );
  const accepted = outcomes.filter(Boolean).length;
  const summary = await budgetSummary(db.query, utcPeriod(new Date()), cap, "USD");
  check(
    "réservations de budget simultanées",
    "3 acceptées (3 × 3 ≤ 10 < 4 × 3) et réservé ≤ plafond",
    `${accepted} acceptées, réservé ${summary.reservedMicros}`,
    accepted === 3 && summary.reservedMicros <= cap,
  );
}

// ── 2. Tâches : 12 workers réclament 6 tâches : chaque tâche n'a qu'un gagnant. ──
{
  for (let i = 0; i < 6; i++) await enqueue(db.query, { kind: "collect_source", key: `concurrence:${i}`, payload: {} });
  const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => claim(db, `worker-${i}`, ["collect_source"])));
  const got = claims.filter((c) => c !== null);
  const distinct = new Set(got.map((c) => c!.id));
  check("réclamations de tâches simultanées", "6 tâches, 6 gagnants distincts", `${got.length} réclamées, ${distinct.size} distinctes`, got.length === 6 && distinct.size === 6);
}

// ── 3. Invitations : 6 acceptations simultanées du même jeton : un seul usage. ──
{
  const owner = { id: await addUser("prop-conc"), status: "active", onboarded: true };
  const created = await createRoom(db.query, owner, { name: "Salon concurrence", description: "", themeId: null, visibility: "private", format: "chat", postId: null });
  if (!created.ok) throw new Error("création du salon impossible");
  const invitation = await db.transaction((q) => createInvitation(q, owner, created.roomId));
  if (!invitation.ok) throw new Error("invitation impossible");
  const guests = await Promise.all(Array.from({ length: 6 }, (_, i) => addUser(`invite-${i}`)));
  const outcomes = await Promise.all(
    guests.map((id) => acceptInvitation(db, { id, status: "active", onboarded: true }, invitation.token)),
  );
  const accepted = outcomes.filter((o) => o.ok).length;
  const [{ n: members }] = await db.query<{ n: string }>(`SELECT count(*) AS n FROM room_members WHERE room_id = $1`, [created.roomId]);
  check("acceptations simultanées d'une invitation", "1 acceptée, 2 membres (propriétaire + 1)", `${accepted} acceptées, ${members} membres`, accepted === 1 && Number(members) === 2);
}

// ── 4. Limite de publications : 8 écritures simultanées pour 10/h, 7 déjà faites. ──
{
  const author = await addUser("auteur-conc");
  for (let i = 0; i < 7; i++) {
    await db.query(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', $2, 'x')`, [author, `Préalable ${i}`]);
  }
  const outcomes = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      runLimited(db.transaction, "post", author, async (q) => {
        await q(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', $2, 'x')`, [author, `Rafale ${i}`]);
        return true;
      }),
    ),
  );
  const accepted = outcomes.filter((o) => o.ok).length;
  check("publications simultanées près de la limite", "3 acceptées (10/h, 7 déjà faites)", `${accepted} acceptées`, accepted === 3);
}

// ── 5. Chat : même identifiant client en parallèle, puis limite 20/min atomique. ──
{
  const owner = { id: await addUser("chat-conc"), status: "active", onboarded: true };
  const created = await createRoom(db.query, owner, { name: "Salon chat concurrence", description: "", themeId: null, visibility: "public", format: "chat", postId: null });
  if (!created.ok) throw new Error("création du salon impossible");
  const clientId = randomUUID().replace(/-/g, "").slice(0, 24);
  const same = await Promise.all(
    Array.from({ length: 5 }, () => db.transaction((q) => sendMessage(q, owner, created.roomId, { clientId, body: "idempotent" }))),
  );
  const inserted = same.filter((o) => o.ok && !o.duplicate).length;
  const [{ n: rows }] = await db.query<{ n: string }>(`SELECT count(*) AS n FROM room_messages WHERE room_id = $1`, [created.roomId]);
  const burst = await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      runLimited(db.transaction, "roomMessage", `${created.roomId}:${owner.id}`, (q) =>
        sendMessage(q, owner, created.roomId, { clientId: `b-${i}`, body: "x" }),
      ),
    ),
  );
  const sent = burst.filter((o) => o.ok).length;
  check(
    "messages simultanés (idempotence puis limite 20/min)",
    "1 insertion pour 5 relances ; au plus 19 envois de plus (20/min, 1 déjà envoyé)",
    `${inserted} insertion(s), ${rows} ligne(s) ; ${sent} envois acceptés`,
    inserted === 1 && Number(rows) === 1 && sent === 19,
  );
}

// ── 6–8. Barrières explicites : prouver les ordres, pas espérer une course. ──
{
  const { joinRoom, updateRoom } = await import("../lib/rooms/service.ts");
  const { eventsSince } = await import("../lib/rooms/chat.ts");
  const { moderate } = await import("../lib/social/moderation.ts");
  const admin = { id: await addUser("admin-barrier"), status: "active", onboarded: true };
  await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [admin.id]);
  async function blockedBy(pid: number, blocker: number) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const [row] = await db.query<{ blocked: boolean }>(`SELECT $2::int = ANY(pg_blocking_pids($1::int)) AS blocked`, [pid, blocker]);
      if (row.blocked) return true;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return false;
  }
  for (const scenario of ["sequence", "suspension", "archivage"] as const) {
    const owner = { id: await addUser(`owner-${scenario}`), status: "active", onboarded: true };
    const member = { id: await addUser(`member-${scenario}`), status: "active", onboarded: true };
    const room = await db.transaction((q) => createRoom(q, owner, { name: `Barrière ${scenario}`, description: "", themeId: null, visibility: "public", format: "chat", postId: null }));
    if (!room.ok) throw new Error("Création impossible");
    await joinRoom(db, member, room.roomId);
    const a = await pool.connect(); const b = await pool.connect();
    const qa: Query = async (sql, params) => (await a.query(sql, params)).rows as never;
    const qb: Query = async (sql, params) => (await b.query(sql, params)).rows as never;
    const held: Db = { query: qa, transaction: (fn) => fn(qa) };
    let pending: Promise<Awaited<ReturnType<typeof sendMessage>>> | undefined;
    try {
      await a.query("BEGIN"); await b.query("BEGIN");
      await a.query("SET LOCAL statement_timeout = '8s'"); await b.query("SET LOCAL statement_timeout = '8s'");
      const [{ pid: pidA }] = await qa<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      const [{ pid: pidB }] = await qb<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      if (scenario === "sequence") {
        const result = await sendMessage(qa, owner, room.roomId, { clientId: "allocation-a", body: "A attend avant commit" });
        if (!result.ok) throw new Error("Écriture A refusée");
      } else if (scenario === "suspension") {
        const result = await moderate(held, { moderatorId: admin.id, targetUserId: member.id, kind: "suspend", durationDays: 7, reason: "Suspension sous barrière de recette" });
        if (!result.ok) throw new Error("Suspension refusée");
      } else {
        const result = await updateRoom(held, owner, room.roomId, { archive: true });
        if (!result.ok) throw new Error("Archivage refusé");
      }
      pending = sendMessage(qb, member, room.roomId, { clientId: "allocation-b", body: "B tente de passer avant A" });
      // Éviter un rejet non observé pendant l'inspection pg_blocking_pids.
      void pending.catch(() => {});
      const blocked = await blockedBy(pidB, pidA);
      const visibleBefore = await eventsSince(db.query, room.roomId, 0);
      await a.query("COMMIT");
      const resultB = await pending;
      const visibleA = await eventsSince(db.query, room.roomId, 0);
      const cursorA = visibleA.at(-1)?.seq ?? 0;
      await b.query("COMMIT");
      const resumed = await eventsSince(db.query, room.roomId, cursorA);
      if (scenario === "sequence") {
        const history = await db.query<{ body: string }>(`SELECT body FROM room_messages WHERE room_id = $1 ORDER BY seq`, [room.roomId]);
        check("ACC08 : allocation/commit de deux auteurs, puis reprise", "B bloquée jusqu'au commit A ; A puis B, aucun événement omis",
          `bloquée=${blocked}, avant=${visibleBefore.length}, A=${visibleA.length}, reprise=${resumed.length}`,
          blocked && visibleBefore.length === 0 && visibleA.length === 1 && resultB.ok && resumed.length === 1 &&
          history[0]?.body === "A attend avant commit" && history[1]?.body === "B tente de passer avant A");
      } else {
        check(`ACC03 : ${scenario} contre écriture déjà authentifiée`, "écriture bloquée puis refusée après commit de la décision",
          `bloquée=${blocked}, acceptée=${resultB.ok}`, blocked && !resultB.ok && resumed.length === 0);
      }
    } finally {
      await a.query("ROLLBACK").catch(() => {});
      if (pending) await pending.catch(() => {});
      await b.query("ROLLBACK").catch(() => {});
      a.release(); b.release();
    }
  }
}

await pool.end();
const failed = report.filter((r) => !r.ok);
console.log(`\n${report.length - failed.length}/${report.length} scénarios de concurrence réussis sur PostgreSQL réel.`);
process.exit(failed.length ? 1 : 0);
