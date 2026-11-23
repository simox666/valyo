// Revue B003 : une citation présente ne démontre pas la fidélité. Cas adverses
// titre / résumé / chiffres / statut avec citation réelle sans rapport.
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulatedVerify } from "../lib/editorial/providers/test.ts";
import type { DraftDocument } from "../lib/editorial/providers/types.ts";
import { checkVerification, statementsFor, validateDraft, type ValidatedDraft } from "../lib/editorial/validate.ts";

const QUOTE = "Le laboratoire annonce un prototype de robot destiné à la recherche.";
const docs: DraftDocument[] = [
  { documentId: "d1", url: "https://labo.example/articles/robot", title: "Un prototype de robot", publishedAt: "2026-11-15T09:00:00Z", text: `Un prototype de robot\n${QUOTE}` },
];

const verifyFor = (draft: ValidatedDraft) =>
  simulatedVerify({ subjectId: "s", statements: statementsFor(draft), scientificStatus: draft.scientificStatus, documents: docs });

test("reproduction de la revue : validation structurelle acceptée, vérification indépendante refusée", () => {
  const output = {
    title: "Un robot guérit toutes les maladies",
    summary: "Un million de patients ont déjà été guéris et les essais cliniques sont confirmés.",
    scientificStatus: "published",
    sources: ["https://labo.example/articles/robot"],
    claims: [{ text: "Le robot guérit un million de patients.", documentId: "d1", quote: QUOTE }],
  };
  const structural = validateDraft(output, docs);
  assert.equal(structural.ok, true, "la structure seule ne détecte pas le problème");
  if (!structural.ok) return;
  const verdict = checkVerification(verifyFor(structural.draft), structural.draft, docs, { simulated: true });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.reason, "resume_non_etaye");
});

const honest: ValidatedDraft = {
  title: "Un prototype de robot pour la recherche",
  summary: QUOTE,
  scientificStatus: "announcement",
  sources: [{ url: docs[0].url, documentId: "d1", title: docs[0].title }],
  claims: [{ text: QUOTE, documentId: "d1", quote: QUOTE }],
};

const allSupported = (draft: ValidatedDraft, quote: string) => ({
  statements: statementsFor(draft).map((s) => ({ id: s.id, supported: true, documentId: "d1", quote })),
  status: { supported: true },
});

test("vérificateur complaisant avec une citation réelle sans rapport : refusé par le serveur", () => {
  const invented = { ...honest, title: "Une découverte qui transforme toute la médecine mondiale" };
  const verdict = checkVerification(allSupported(invented, QUOTE), invented, docs, { simulated: true });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.match(verdict.detail, /sans rapport/);
});

test("chiffre absent des sources : refusé même si les mots correspondent", () => {
  const withNumber = { ...honest, summary: "Le laboratoire annonce 12 prototypes de robot destinés à la recherche." };
  const verdict = checkVerification(allSupported(withNumber, QUOTE), withNumber, docs, { simulated: true });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.match(verdict.detail, /Quantité/);
});

test("statut « publié » sans passage justificatif : statut incertain", () => {
  const published = { ...honest, scientificStatus: "published" as const };
  const verdict = checkVerification(verifyFor(published), published, docs, { simulated: true });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.reason, "statut_incertain");
});

test("vérification absente, incomplète ou mal formée : jamais « prête »", () => {
  assert.equal(checkVerification(null, honest, docs, { simulated: true }).ok, false);
  const partial = { statements: [{ id: "titre", supported: true, documentId: "d1", quote: QUOTE }], status: { supported: true } };
  assert.equal(checkVerification(partial, honest, docs, { simulated: true }).ok, false);
  const inventedQuote = allSupported(honest, "Cette phrase n'existe dans aucun document consulté.");
  assert.equal(checkVerification(inventedQuote, honest, docs, { simulated: true }).ok, false);
});

test("provenance : le champ « simulated » renvoyé par un modèle est ignoré", () => {
  const fromClaude = checkVerification({ ...verifyFor(honest), simulated: true }, honest, docs, { simulated: false });
  assert.equal(fromClaude.ok, true);
  if (fromClaude.ok) assert.equal(fromClaude.evidence.simulated, false, "seule l'identité du fournisseur compte");
  const fromTest = checkVerification({ ...verifyFor(honest), simulated: false }, honest, docs, { simulated: true });
  if (fromTest.ok) assert.equal(fromTest.evidence.simulated, true);
});

test("brouillon fidèle : accepté avec ses preuves, marqué comme vérification simulée", () => {
  const verdict = checkVerification(verifyFor(honest), honest, docs, { simulated: true });
  assert.equal(verdict.ok, true);
  if (verdict.ok) {
    assert.equal(verdict.evidence.simulated, true);
    assert.equal(verdict.evidence.statements.length, statementsFor(honest).length);
  }
});

// Recette D4 du 18 novembre 2026 (décision du porteur) : les articles d'ANALYSE sont
// une catégorie légitime — acceptés sans passage justificatif de statut (comme les
// annonces), tout en gardant la vérification de fidélité phrase par phrase.
test("statut « analyse » : accepté sans passage justificatif, fidélité toujours exigée", () => {
  const analysis: ValidatedDraft = { ...honest, scientificStatus: "analysis" };
  const verdict = checkVerification(verifyFor(analysis), analysis, docs, { simulated: true });
  assert.equal(verdict.ok, true, "une analyse fidèle ne part pas en examen pour son statut");
  if (verdict.ok) assert.equal(verdict.evidence.status.value, "analysis");

  const unfaithful = { ...analysis, title: "Une découverte qui transforme toute la médecine mondiale" };
  const rejected = checkVerification(allSupported(unfaithful, QUOTE), unfaithful, docs, { simulated: true });
  assert.equal(rejected.ok, false, "le statut analyse n'affaiblit pas la vérification de fidélité");
});

test("statut « analyse » : la validation structurelle du rédacteur l'accepte", () => {
  const output = {
    title: "Où en est vraiment la robotique autonome",
    summary: QUOTE,
    scientificStatus: "analysis",
    sources: ["https://labo.example/articles/robot"],
    claims: [{ text: QUOTE, documentId: "d1", quote: QUOTE }],
  };
  const structural = validateDraft(output, docs);
  assert.equal(structural.ok, true);
});
