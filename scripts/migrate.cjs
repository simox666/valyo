// Run once after connecting Vercel Postgres, not on every request — plain
// idempotent DDL, no migration framework needed for a schema this small
// (project.md, défi entre amis).
//
// Usage: node scripts/migrate.cjs
const fs = require("fs");

// No dotenv dependency for one script — .env.local is just KEY=VALUE lines.
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const { sql } = require("@vercel/postgres");

async function migrate() {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      total_points INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS challenges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id),
      photo_url TEXT NOT NULL,
      label TEXT,
      true_price NUMERIC NOT NULL,
      currency TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS guesses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      challenge_id UUID NOT NULL REFERENCES challenges(id),
      guesser_id UUID NOT NULL REFERENCES users(id),
      guess_value NUMERIC NOT NULL,
      points INTEGER NOT NULL,
      guessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (challenge_id, guesser_id)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS guesses_challenge_id_idx ON guesses (challenge_id)`;
  await sql`CREATE INDEX IF NOT EXISTS challenges_creator_id_idx ON challenges (creator_id)`;

  console.log("Schema OK: users, challenges, guesses");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
