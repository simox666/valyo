// Outils communs aux tests de l'agent éditorial : base PGlite en mémoire,
// migrations, sources de fixture et politique explicite de test.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS } from "../lib/migrations.ts";
import type { Db, Query } from "../lib/editorial/types.ts";

export const FIXTURES = path.resolve("tests/fixtures/editorial/web");
/** Lundi 16 novembre 2026, 6 h à Bruxelles : une heure avant le créneau de test (7 h). */
export const NOW = new Date("2026-11-16T05:00:00Z");

export async function createTestDb(): Promise<{ db: Db; lite: PGlite }> {
  const lite = new PGlite();
  for (const m of MIGRATIONS) for (const s of m.statements) await lite.query(s);
  const query: Query = async (text, params) => (await lite.query(text, params)).rows as never;
  const db: Db = {
    query,
    transaction: (fn) => lite.transaction((tx) => fn(async (text, params) => (await tx.query(text, params)).rows as never)),
  };
  return { db, lite };
}

/** Politique de FIXTURE, explicite : elle ne vaut pas validation des propositions D8. */
export const FIXTURE_POLICY = { slots: [{ weekday: 1, time: "07:00" }], maxItems: 6, prepLeadHours: 24 };

export async function configureForTests(db: Db, overrides: Record<string, unknown> = {}) {
  const values = {
    paused: false,
    provider: "test",
    prices: { inputPerMTokMicros: 4_000_000, outputPerMTokMicros: 20_000_000 },
    currency: "USD",
    budget_cap_micros: "5000000",
    timezone: "Europe/Brussels",
    policy: FIXTURE_POLICY,
    ...overrides,
  };
  await db.query(
    `UPDATE editorial_config SET paused = $1, provider = $2, prices = $3, currency = $4, budget_cap_micros = $5, timezone = $6, policy = $7,
       updated_at = '2026-11-15T00:00:00Z' WHERE id = 1`,
    [values.paused, values.provider, JSON.stringify(values.prices), values.currency, values.budget_cap_micros, values.timezone, values.policy === null ? null : JSON.stringify(values.policy)],
  );
}

export async function addFixtureSources(db: Db) {
  const [{ id: ia }] = await db.query<{ id: string }>(`SELECT id FROM themes WHERE slug = 'ia'`);
  const sources = [
    ["Laboratoire Exemple", "https://labo.example/flux.xml", "primary", 1],
    ["Agence Exemple", "https://agence.example/flux.atom", "press", 3],
    ["Revue Exemple", "https://revue.example/flux.xml", "scientific", 2],
  ] as const;
  for (const [name, url, type, priority] of sources) {
    await db.query(
      `INSERT INTO editorial_sources (name, feed_url, source_type, priority, theme_ids, active, authorization_checked_at, authorization_reference)
       VALUES ($1, $2, $3, $4, $5, true, '2026-11-12T00:00:00Z', 'Fixture de test : aucune source réelle')`,
      [name, url, type, priority, [ia]],
    );
  }
}

/** Publication d'un membre citant déjà une page du flux (cas R07). */
export async function addMemberPost(db: Db, url = "https://labo.example/articles/deja-partage") {
  const [user] = await db.query<{ id: string }>(
    `INSERT INTO users (email, handle, display_name, rules_accepted_at) VALUES ('membre@example.test', 'membre', 'Membre', now()) RETURNING id`,
  );
  const [post] = await db.query<{ id: string }>(
    `INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', 'Texte du membre', 'Texte original du membre, à ne jamais modifier.') RETURNING id`,
    [user.id],
  );
  await db.query(`INSERT INTO post_sources (post_id, position, url, normalized_url) VALUES ($1, 0, $2, 'labo.example/articles/deja-partage')`, [post.id, url]);
  return { userId: user.id, postId: post.id };
}
