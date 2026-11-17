import "server-only";
import { MIGRATIONS } from "./migrations";

// Deux moteurs, une seule interface :
// - DATABASE_URL défini : PostgreSQL réel via `pg` (production, préproduction).
// - sinon : PGlite, un PostgreSQL embarqué stocké dans .data/pglite, pour le
//   développement local sans rien installer. Même dialecte SQL dans les deux cas.

type Row = Record<string, unknown>;
export type QueryFn = <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;

interface Engine {
  query: QueryFn;
  /** Exécute `fn` dans une transaction sur une connexion unique. */
  transaction<R>(fn: (q: QueryFn) => Promise<R>): Promise<R>;
}

declare global {
  // eslint-disable-next-line no-var
  var __valyoDb: Promise<Engine> | undefined;
  // eslint-disable-next-line no-var
  var __valyoMigratedTo: string | undefined;
}

async function createPgEngine(url: string): Promise<Engine> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  const engine: Engine = {
    query: async <T extends Row>(text: string, params?: unknown[]) =>
      (await pool.query(text, params as unknown[])).rows as T[],
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(async <T extends Row>(text: string, params?: unknown[]) =>
          (await client.query(text, params as unknown[])).rows as T[],
        );
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
  // Verrou consultatif : plusieurs instances qui démarrent ensemble n'appliquent pas deux fois une migration.
  await engine.transaction(async (q) => {
    await q("SELECT pg_advisory_xact_lock(424242)");
    await migrate(q);
  });
  return engine;
}

async function createLiteEngine(): Promise<Engine> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync, readFileSync, writeFileSync, rmSync } = await import("fs");
  const dir = process.env.PGLITE_DIR || ".data/pglite";
  mkdirSync(dir, { recursive: true });
  // PGlite n'accepte qu'un seul processus par dossier : deux processus (serveur
  // de développement et worker) corrompraient la base. Verrou par fichier.
  const lockPath = `${dir}.lock`;
  try {
    const owner = Number.parseInt(readFileSync(lockPath, "utf8"), 10);
    if (owner && owner !== process.pid) {
      let alive = true;
      try {
        process.kill(owner, 0);
      } catch {
        alive = false;
      }
      if (alive) {
        throw new Error(
          `La base locale ${dir} est déjà ouverte par le processus ${owner} (serveur de développement ou worker). Arrêtez-le avant d'en lancer un autre.`,
        );
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  writeFileSync(lockPath, String(process.pid));
  process.once("exit", () => {
    try {
      if (readFileSync(lockPath, "utf8") === String(process.pid)) rmSync(lockPath);
    } catch {}
  });
  const lite = new PGlite(dir);
  await lite.waitReady;
  const engine: Engine = {
    query: async <T extends Row>(text: string, params?: unknown[]) => (await lite.query<T>(text, params)).rows,
    transaction: (fn) =>
      lite.transaction((tx) => fn(async <T extends Row>(text: string, params?: unknown[]) => (await tx.query<T>(text, params)).rows)),
  };
  await engine.transaction(migrate);
  return engine;
}

async function migrate(q: QueryFn) {
  await q("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const applied = new Set((await q<{ id: string }>("SELECT id FROM schema_migrations")).map((r) => r.id));
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    for (const statement of migration.statements) await q(statement);
    await q("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
  }
}

function getEngine(): Promise<Engine> {
  // Singleton global : le rechargement à chaud de `next dev` réévalue les
  // modules, et deux instances PGlite sur le même dossier se corrompraient.
  if (!globalThis.__valyoDb) {
    const url = process.env.DATABASE_URL;
    if (!url && process.env.NODE_ENV === "production") {
      return Promise.reject(new Error("DATABASE_URL est obligatoire en production."));
    }
    globalThis.__valyoDb = (url ? createPgEngine(url) : createLiteEngine()).catch((error) => {
      globalThis.__valyoDb = undefined;
      throw error;
    });
  }
  return globalThis.__valyoDb;
}

/**
 * Moteur prêt, migrations à jour. Le moteur est un singleton de processus, migré à sa
 * création ; or le rechargement à chaud de `next dev` peut apporter de NOUVELLES
 * migrations à un serveur déjà lancé (cas réel du 14 novembre : tables absentes et
 * « Une erreur est survenue » jusqu'au redémarrage). On revérifie donc à chaque accès,
 * à coût nul tant que la dernière migration connue du code est déjà appliquée.
 */
async function readyEngine(): Promise<Engine> {
  const engine = await getEngine();
  const latest = MIGRATIONS[MIGRATIONS.length - 1]?.id;
  if (globalThis.__valyoMigratedTo !== latest) {
    await engine.transaction(async (q) => {
      // Même verrou qu'au démarrage (sans effet sur PGlite, qui sérialise déjà les transactions).
      if (process.env.DATABASE_URL) await q("SELECT pg_advisory_xact_lock(424242)");
      await migrate(q);
    });
    globalThis.__valyoMigratedTo = latest;
  }
  return engine;
}

export const query: QueryFn = async (text, params = []) => (await readyEngine()).query(text, params);

export async function queryOne<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

export async function transaction<R>(fn: (q: QueryFn) => Promise<R>): Promise<R> {
  return (await readyEngine()).transaction(fn);
}

/** Accès injecté dans les modules testables sans Next.js (lib/editorial). */
export const db = { query, transaction };
