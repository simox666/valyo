// Limites de fréquence atomiques (anomalie A002) sur une base PostgreSQL embarquée.
// Limite connue : PGlite n'a qu'une connexion, donc ce test ne prouve pas à lui
// seul le comportement sous PostgreSQL multi-connexions, qui repose sur le
// verrou consultatif. Il vérifie le décompte, la configuration et que le verrou
// est accepté par le moteur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS } from "../lib/migrations.ts";
import { limitRule, runLimited, type Query, type Transaction } from "../lib/limits.ts";

async function setup() {
  const db = new PGlite();
  for (const m of MIGRATIONS) for (const s of m.statements) await db.query(s);
  const transaction: Transaction = (fn) =>
    db.transaction((tx) => {
      const q: Query = async <T extends Record<string, unknown>>(text: string, params?: unknown[]) => (await tx.query<T>(text, params)).rows;
      return fn(q);
    });
  const user = (await db.query<{ id: string }>(`INSERT INTO users (handle, display_name, rules_accepted_at) VALUES ('ana', 'Ana', now()) RETURNING id`)).rows[0].id;
  return { db, transaction, user };
}

test("requêtes simultanées près de la limite : seules les places restantes passent", async () => {
  const { db, transaction, user } = await setup();
  const insert = (q: Query) =>
    q(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'question', 'Titre', 'x') RETURNING id`, [user]);
  // 7 publications déjà faites, limite 10 : 3 places pour 8 requêtes simultanées.
  for (let i = 0; i < 7; i++) await runLimited(transaction, "post", user, insert);
  const results = await Promise.all(Array.from({ length: 8 }, () => runLimited(transaction, "post", user, insert)));
  assert.equal(results.filter((r) => r.ok).length, 3);
  assert.equal(results.filter((r) => !r.ok).length, 5);
  const count = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM posts WHERE author_id = $1`, [user])).rows[0].n;
  assert.equal(count, 10);
  await db.close();
});

test("les limites sont configurables par variable d'environnement", () => {
  assert.equal(limitRule("post").max, 10);
  process.env.LIMIT_POSTS_PER_HOUR = "3";
  assert.equal(limitRule("post").max, 3);
  process.env.LIMIT_POSTS_PER_HOUR = "n'importe quoi";
  assert.equal(limitRule("post").max, 10, "valeur invalide : retour à la valeur par défaut");
  delete process.env.LIMIT_POSTS_PER_HOUR;
});

test("une limite atteinte n'écrit rien", async () => {
  const { db, transaction } = await setup();
  process.env.LIMIT_LOGIN_LINKS_PER_HOUR = "1";
  const write = (q: Query) =>
    q(`INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (gen_random_uuid()::text, 'A@example.test', now() + interval '15 minutes')`);
  assert.equal((await runLimited(transaction, "loginLink", "a@example.test", write)).ok, true);
  assert.equal((await runLimited(transaction, "loginLink", "A@EXAMPLE.TEST", write)).ok, false, "casse ignorée");
  assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM login_tokens`)).rows[0].n, 1);
  delete process.env.LIMIT_LOGIN_LINKS_PER_HOUR;
  await db.close();
});
