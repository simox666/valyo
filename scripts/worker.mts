// Worker de l'agent éditorial : exécute UN cycle borné puis s'arrête.
// Le planificateur de l'hébergement le lance à intervalle régulier (contrat §2) :
//   npm run worker
// Variables : celles de l'application (DATABASE_URL, ANTHROPIC_API_KEY…), lues depuis
// l'environnement ou, à défaut, depuis .env.local. Plus :
//   EDITORIAL_TRANSPORT=fixtures  → lit tests/fixtures/editorial/web au lieu du réseau (démonstration locale)
// En développement avec la base embarquée (PGlite), arrêter le serveur `npm run dev`
// avant de lancer le worker : un seul processus peut ouvrir la base locale.
//
// Aucun appel payant n'est possible tant que la configuration n'a pas de modèle,
// de prix vérifiés, de devise et de plafond mensuel (readiness) : le fournisseur
// reste alors inactif, même avec une clé présente.

import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { db } = await import("../lib/db.ts");
const { loadConfig } = await import("../lib/editorial/config.ts");
const { createHttpTransport } = await import("../lib/editorial/fetch.ts");
const { createFixtureTransport } = await import("../lib/editorial/fixture-transport.ts");
const { runCycle } = await import("../lib/editorial/pipeline.ts");
const { providerFromConfig } = await import("../lib/editorial/providers/index.ts");

try {
  const config = await loadConfig(db.query);
  const { provider, reason } = providerFromConfig(config, db.query, { anthropicApiKey: process.env.ANTHROPIC_API_KEY });
  if (!provider && reason) console.warn(`Étapes fournisseur en attente : ${reason}.`);

  const transport =
    process.env.EDITORIAL_TRANSPORT === "fixtures"
      ? createFixtureTransport(path.resolve("tests/fixtures/editorial/web"))
      : createHttpTransport();

  const report = await runCycle({ db, transport, provider, now: () => new Date(), owner: `worker-${process.pid}-${randomUUID().slice(0, 8)}` });
  console.log(JSON.stringify({ at: new Date().toISOString(), provider: provider?.id ?? null, ...report }, null, 2));
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
