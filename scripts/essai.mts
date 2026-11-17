// Commande d'essai borné de l'agent éditorial (docs/protocole-premier-essai-claude.md, C008).
//
//   npm run essai -- preparer [options]   prépare l'essai (base dédiée exigée, aucun appel fournisseur)
//   npm run essai -- apercu               aperçu SANS génération : limites, prix, borne réservable
//   npm run essai -- etape                exécute l'essai pas à pas (soumissions bornées, suivi borné)
//   npm run essai -- etat                 état courant
//   npm run essai -- rapport              écrit le rapport exportable (sans clé ni identifiant externe)
//
// Base DÉDIÉE obligatoire :
//   PGLITE_DIR=.data/pglite-essai npm run essai -- preparer
// ou DATABASE_URL avec ESSAI_BASE_DEDIEE=1. La base de développement (.data/pglite) est refusée.
//
// Options de « preparer » :
//   --fournisseur test|claude   (défaut : test, aucun appel réel)
//   --modele <id>               (obligatoire pour claude)
//   --prix-entree <unites>      prix d'entrée par million de jetons (défaut : 2)
//   --prix-sortie <unites>      prix de sortie par million de jetons (défaut : 10)
//   --devise <code>             (défaut : USD)
//   --plafond <unites>          plafond mensuel (défaut : 20)
//   --document <fichier.json>   { "title", "url", "text" } (défaut : document synthétique intégré)
// Options de « etape » : --suivis <n> (défaut 30), --intervalle <secondes> (défaut 10 ; 0 pour test)
// Option de « rapport » : --sortie <fichier.json>

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("--")) ?? "etat";
const option = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

// ── Base dédiée exigée ──
const pgliteDir = process.env.PGLITE_DIR;
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  if (process.env.ESSAI_BASE_DEDIEE !== "1") {
    console.error("DATABASE_URL est défini : l'essai exige une base DÉDIÉE. Confirmer avec ESSAI_BASE_DEDIEE=1 uniquement si cette base est vierge et réservée à l'essai.");
    process.exit(1);
  }
} else if (!pgliteDir || path.resolve(pgliteDir) === path.resolve(".data/pglite")) {
  console.error("Base dédiée exigée : définir PGLITE_DIR (différent de .data/pglite), par exemple PGLITE_DIR=.data/pglite-essai.");
  process.exit(1);
}

const { db } = await import("../lib/db.ts");
const { loadConfig } = await import("../lib/editorial/config.ts");
const { formatMicros } = await import("../lib/editorial/budget.ts");
const { createHttpTransport } = await import("../lib/editorial/fetch.ts");
const { createFixtureTransport } = await import("../lib/editorial/fixture-transport.ts");
const { providerFromConfig } = await import("../lib/editorial/providers/index.ts");
const { SYNTHETIC_TRIAL_DOCUMENT, TrialError, loadTrial, trialInit, trialPreview, trialReport, trialStatus, trialStep } = await import("../lib/editorial/trial.ts");
const { bigintReplacer } = await import("../lib/editorial/config.ts");

async function buildDeps() {
  const config = await loadConfig(db.query);
  const { provider, reason } = providerFromConfig(config, db.query, { anthropicApiKey: process.env.ANTHROPIC_API_KEY });
  if (!provider && reason && command !== "preparer") console.warn(`Fournisseur indisponible : ${reason}.`);
  const transport =
    process.env.EDITORIAL_TRANSPORT === "fixtures" || config.provider === "test"
      ? createFixtureTransport(path.resolve("tests/fixtures/editorial/web"))
      : createHttpTransport();
  return { db, transport, provider, now: () => new Date(), owner: `essai-${process.pid}-${randomUUID().slice(0, 8)}` };
}

function printStatus(s: Awaited<ReturnType<typeof trialStatus>>) {
  console.log(`Phase : ${s.phase}${s.stoppedReason ? ` — arrêt : ${s.stoppedReason}` : ""}`);
  console.log(`Récapitulatif : ${s.recapState} (${s.items} élément(s) assemblé(s))`);
  console.log(`Lots créés : ${s.batchesCreated}/${s.maxBatches} — requêtes soumises : ${s.requestsSubmitted}`);
  console.log(
    `Budget : plafond ${formatMicros(s.budget.capMicros, s.budget.currency)}, rapproché ${formatMicros(s.budget.settledMicros, s.budget.currency)}, réservé ${formatMicros(s.budget.reservedMicros, s.budget.currency)}, incertains ${s.budget.uncertainCount}`,
  );
  for (const t of s.steps) console.log(`  - ${t.kind} : ${t.state} (tentatives ${t.attempts})${t.error ? ` — ${JSON.stringify(t.error)}` : ""}`);
  if (s.subject) console.log(`Sujet : ${s.subject.status}${s.subject.blockReason ? ` (${s.subject.blockReason})` : ""}`);
}

try {
  if (command === "preparer") {
    const fournisseur = (option("fournisseur") ?? "test") as "test" | "claude";
    if (fournisseur !== "test" && fournisseur !== "claude") throw new TrialError("--fournisseur doit être test ou claude");
    const modele = option("modele") ?? null;
    if (fournisseur === "claude" && !modele) throw new TrialError("--modele est obligatoire avec --fournisseur claude");
    if (fournisseur === "claude" && !process.env.ANTHROPIC_API_KEY) throw new TrialError("ANTHROPIC_API_KEY absent : impossible de préparer un essai Claude");
    const toMicros = (v: string) => Math.round(Number(v) * 1_000_000);
    const docFile = option("document");
    const document = docFile ? JSON.parse(readFileSync(docFile, "utf8")) : SYNTHETIC_TRIAL_DOCUMENT;
    if (!document.title || !document.url || !document.text) throw new TrialError("Le document doit contenir title, url et text.");
    const deps = await buildDeps();
    const { recapId } = await trialInit(deps, {
      config: {
        provider: fournisseur,
        model: modele,
        prices: { inputPerMTokMicros: toMicros(option("prix-entree") ?? "2"), outputPerMTokMicros: toMicros(option("prix-sortie") ?? "10") },
        currency: option("devise") ?? "USD",
        budgetCapMicros: BigInt(toMicros(option("plafond") ?? "20")),
        timezone: "Europe/Brussels",
      },
      document,
      actorLabel: "commande d'essai (npm run essai)",
    });
    console.log(`Essai préparé (récapitulatif ${recapId}). Aucun appel fournisseur effectué.`);
    console.log(`Document : ${document.title}`);
    console.log(`Prochaines commandes : apercu (sans génération), puis etape.`);
  } else if (command === "apercu") {
    const deps = await buildDeps();
    if (deps.provider && !deps.provider.simulated) {
      console.log("Appels réseau GRATUITS pour cet aperçu : liste du modèle (limite d'entrée) et comptage de jetons. Aucune génération.");
    }
    const p = await trialPreview(deps);
    console.log(`Fournisseur : ${p.provider}${p.simulated ? " (simulé, aucun coût réel)" : ""} — modèle : ${p.model ?? "—"}`);
    console.log(`Étapes autorisées : ${p.steps.join(" → ")} — lots maximum : ${p.maxBatches} (une requête par lot)`);
    console.log(`Plafond mensuel : ${formatMicros(p.capMicros, p.currency)} — prix (par Mjeton) : entrée ${formatMicros(p.prices ? BigInt(p.prices.inputPerMTokMicros) : null, p.currency)}, sortie ${formatMicros(p.prices ? BigInt(p.prices.outputPerMTokMicros) : null, p.currency)}`);
    if (p.pending) {
      console.log(`Prochaine requête (${p.pending.kind}) : estimation ${formatMicros(p.pending.estimateMicros, p.currency)}, réservation garantie ${formatMicros(p.pending.boundMicros, p.currency)}`);
      console.log(`Pire cas pour ${p.maxBatches} requêtes : ${formatMicros(p.worstCaseTotalMicros, p.currency)} (réservation, pas une prévision de coût)`);
    } else {
      console.log("Aucune requête en attente (essai terminé ou arrêté).");
    }
    if (p.networkCalls.length) console.log(`Appels réseau effectués (gratuits) : ${p.networkCalls.join(" ; ")}`);
  } else if (command === "etape") {
    const deps = await buildDeps();
    const maxPolls = Number(option("suivis") ?? 30);
    const interval = Number(option("intervalle") ?? (deps.provider?.simulated ? 0 : 10));
    const oneStep = args.includes("--une-etape");
    const before = (await trialStatus(deps)).batchesCreated;
    let status = await trialStep(deps);
    for (let i = 0; i < maxPolls && !status.stoppedReason && status.phase !== "terminee" && status.phase !== "vide"; i++) {
      const waiting = status.steps.some((t) => t.state === "waiting_provider");
      if (oneStep && !waiting && status.batchesCreated > before) break;
      if (waiting && interval > 0) {
        console.log(`Suivi ${i + 1}/${maxPolls} du lot en cours…`);
        await new Promise((r) => setTimeout(r, interval * 1000));
      }
      status = await trialStep(deps);
    }
    printStatus(status);
    if (status.phase === "terminee" || status.phase === "vide") console.log("Essai terminé : agent remis en pause. Générer le rapport avec « rapport ».");
  } else if (command === "etat") {
    const deps = await buildDeps();
    if (!(await loadTrial(db.query))) {
      console.log("Aucun essai dans cette base. Lancer : npm run essai -- preparer");
    } else {
      printStatus(await trialStatus(deps));
    }
  } else if (command === "rapport") {
    const deps = await buildDeps();
    const report = await trialReport(deps);
    const out = option("sortie") ?? path.join("docs", "essais-agent", `essai-${new Date().toISOString().slice(0, 10)}.json`);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, bigintReplacer, 2) + "\n");
    console.log(`Rapport écrit : ${out} (sans clé API ni identifiant externe de lot).`);
  } else {
    console.error(`Commande inconnue : ${command}. Commandes : preparer, apercu, etape, etat, rapport.`);
    process.exit(1);
  }
  process.exit(0);
} catch (error) {
  if (error instanceof TrialError) console.error(`Essai refusé : ${error.message}`);
  else console.error(error);
  process.exit(1);
}
