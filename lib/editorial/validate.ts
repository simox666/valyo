import { z } from "zod";
import { normalizeUrl } from "../urls.ts";
import { missingQuantities, overlap, sentences, squash } from "./lexical.ts";
import type { DraftDocument } from "./providers/types.ts";
import type { ReviewReason, ScientificStatus } from "./types.ts";

// Validation serveur en deux temps (contrat §6, revue B003) :
// 1. validateDraft : contrôle STRUCTUREL de la sortie du rédacteur (schéma,
//    sources = documents consultés, passages cités présents). Ne suffit jamais
//    à rendre un brouillon « prêt ».
// 2. checkVerification : contrôle du verdict INDÉPENDANT de fidélité. Chaque
//    énoncé (titre, phrases du résumé, affirmations) et le statut doivent être
//    déclarés étayés, avec un passage réellement présent dans un document, en
//    rapport avec l'énoncé et contenant ses quantités. Sinon : examen.
// Ni le vérificateur ni ces garde-fous ne constituent une preuve sémantique
// absolue : la recette humaine D4 reste obligatoire avant activation.

const draftSchema = z.object({
  title: z.string().trim().min(5).max(200),
  summary: z.string().trim().min(20).max(1200),
  scientificStatus: z.enum(["announcement", "preprint", "published", "unknown", "analysis"]),
  sources: z.array(z.string()).min(1).max(10),
  claims: z
    .array(z.object({ text: z.string().trim().min(10).max(600), documentId: z.string(), quote: z.string().trim().min(20).max(800) }))
    .min(1)
    .max(8),
  flags: z
    .object({ contradiction: z.boolean().optional(), suspiciousInstructions: z.boolean().optional(), uncertainStatus: z.boolean().optional() })
    .optional(),
});

export interface ValidatedDraft {
  title: string;
  summary: string;
  scientificStatus: ScientificStatus;
  sources: { url: string; documentId: string; title: string }[];
  claims: { text: string; documentId: string; quote: string }[];
}

export type DraftVerdict = { ok: true; draft: ValidatedDraft } | { ok: false; reason: ReviewReason; detail: string };

/**
 * Développement (lot d'accélération A10) : même forme que le brouillon, avec un corps
 * d'article plus long dans `summary` et davantage d'affirmations rattachées.
 */
const developmentSchema = draftSchema.extend({
  summary: z.string().trim().min(200).max(5000),
  claims: z
    .array(z.object({ text: z.string().trim().min(10).max(600), documentId: z.string(), quote: z.string().trim().min(20).max(800) }))
    .min(1)
    .max(12),
});

export function validateDraft(output: unknown, documents: DraftDocument[]): DraftVerdict {
  return validateWith(draftSchema, output, documents);
}

export function validateDevelopment(output: unknown, documents: DraftDocument[]): DraftVerdict {
  return validateWith(developmentSchema, output, documents);
}

function validateWith(schema: z.ZodType<z.infer<typeof draftSchema>>, output: unknown, documents: DraftDocument[]): DraftVerdict {
  const parsed = schema.safeParse(output);
  if (!parsed.success) return { ok: false, reason: "resume_non_etaye", detail: "Sortie du rédacteur invalide (schéma)" };
  const d = parsed.data;

  if (d.flags?.suspiciousInstructions) return { ok: false, reason: "instructions_suspectes", detail: "Signalé par le rédacteur" };
  if (d.flags?.contradiction) return { ok: false, reason: "contradiction", detail: "Contradiction signalée entre les sources" };
  if (d.flags?.uncertainStatus || d.scientificStatus === "unknown") {
    return { ok: false, reason: "statut_incertain", detail: "Statut de l'information incertain" };
  }

  const byNormalized = new Map<string, DraftDocument>();
  for (const doc of documents) {
    const n = normalizeUrl(doc.url);
    if (n) byNormalized.set(n, doc);
  }
  const sources: ValidatedDraft["sources"] = [];
  for (const url of d.sources) {
    const doc = byNormalized.get(normalizeUrl(url) ?? "");
    if (!doc) return { ok: false, reason: "resume_non_etaye", detail: `Source non consultée citée : ${url}` };
    if (!sources.some((s) => s.documentId === doc.documentId)) sources.push({ url: doc.url, documentId: doc.documentId, title: doc.title });
  }

  for (const claim of d.claims) {
    const doc = documents.find((x) => x.documentId === claim.documentId);
    if (!doc) return { ok: false, reason: "resume_non_etaye", detail: "Affirmation rattachée à un document inconnu" };
    if (!squash(doc.text).includes(squash(claim.quote))) {
      return { ok: false, reason: "resume_non_etaye", detail: "Passage cité absent du document consulté" };
    }
  }

  return {
    ok: true,
    draft: { title: d.title, summary: d.summary, scientificStatus: d.scientificStatus, sources, claims: d.claims },
  };
}

/** Énoncés soumis au vérificateur : le titre, chaque phrase du résumé et chaque affirmation. */
export function statementsFor(draft: ValidatedDraft): { id: string; text: string }[] {
  return [
    { id: "titre", text: draft.title },
    ...sentences(draft.summary).map((text, i) => ({ id: `resume-${i + 1}`, text })),
    ...draft.claims.map((c, i) => ({ id: `affirmation-${i + 1}`, text: c.text })),
  ];
}

const verifySchema = z.object({
  statements: z.array(z.object({ id: z.string(), supported: z.boolean(), documentId: z.string().optional(), quote: z.string().optional() })),
  status: z.object({ supported: z.boolean(), documentId: z.string().optional(), quote: z.string().optional() }),
  // Un éventuel champ « simulated » renvoyé par un modèle est ignoré (revue C006, point 5).
});

export interface VerificationEvidence {
  statements: { id: string; text: string; documentId: string; quote: string }[];
  status: { value: ScientificStatus; documentId: string | null; quote: string | null };
  simulated: boolean;
}

export type VerificationVerdict =
  | { ok: true; evidence: VerificationEvidence }
  | { ok: false; reason: ReviewReason; detail: string; simulated: boolean };

/** Seuil minimal de rapport lexical entre un énoncé et le passage qui l'étaye. */
export const MIN_EVIDENCE_OVERLAP = 0.3;

export function checkVerification(
  output: unknown,
  draft: ValidatedDraft,
  documents: DraftDocument[],
  provenance: { simulated: boolean },
): VerificationVerdict {
  const simulated = provenance.simulated;
  const parsed = verifySchema.safeParse(output);
  if (!parsed.success) return { ok: false, reason: "resume_non_etaye", detail: "Vérification absente ou invalide", simulated };
  const v = parsed.data;
  const docs = new Map(documents.map((d) => [d.documentId, d]));
  const evidence: VerificationEvidence["statements"] = [];

  for (const statement of statementsFor(draft)) {
    const answer = v.statements.find((s) => s.id === statement.id);
    if (!answer) return { ok: false, reason: "resume_non_etaye", detail: `Énoncé non vérifié : « ${statement.text} »`, simulated };
    if (!answer.supported) return { ok: false, reason: "resume_non_etaye", detail: `Énoncé non étayé : « ${statement.text} »`, simulated };
    const doc = answer.documentId ? docs.get(answer.documentId) : undefined;
    const quote = answer.quote ?? "";
    if (!doc || quote.length < 10 || !squash(doc.text).includes(squash(quote))) {
      return { ok: false, reason: "resume_non_etaye", detail: `Preuve absente du document pour « ${statement.text} »`, simulated };
    }
    // Garde-fous serveur : une preuve réelle mais sans rapport, ou sans les chiffres annoncés, est refusée.
    if (overlap(statement.text, quote) < MIN_EVIDENCE_OVERLAP) {
      return { ok: false, reason: "resume_non_etaye", detail: `Preuve sans rapport avec « ${statement.text} »`, simulated };
    }
    if (missingQuantities(statement.text, doc.text).length > 0) {
      return { ok: false, reason: "resume_non_etaye", detail: `Quantité absente des sources : « ${statement.text} »`, simulated };
    }
    evidence.push({ id: statement.id, text: statement.text, documentId: doc.documentId, quote });
  }

  if (!v.status.supported) return { ok: false, reason: "statut_incertain", detail: `Statut « ${draft.scientificStatus} » non étayé`, simulated };
  let statusEvidence: VerificationEvidence["status"] = { value: draft.scientificStatus, documentId: null, quote: null };
  // « announcement » et « analysis » se constatent à la nature du document : pas de passage
  // justificatif exigible (contrairement à « prépublication » ou « publié », qui citent une revue).
  if (draft.scientificStatus !== "announcement" && draft.scientificStatus !== "analysis") {
    const doc = v.status.documentId ? docs.get(v.status.documentId) : undefined;
    if (!doc || !v.status.quote || !squash(doc.text).includes(squash(v.status.quote))) {
      return { ok: false, reason: "statut_incertain", detail: "Statut sans passage justificatif dans les documents", simulated };
    }
    statusEvidence = { value: draft.scientificStatus, documentId: doc.documentId, quote: v.status.quote };
  }
  return { ok: true, evidence: { statements: evidence, status: statusEvidence, simulated } };
}
