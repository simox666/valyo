import { missingQuantities, overlap, sentences } from "../lexical.ts";
import type { Query } from "../types.ts";
import type {
  DevelopInput,
  DraftInput,
  DraftOutput,
  EditorialProvider,
  ProviderRequest,
  ProviderResult,
  BatchReadout,
  TriageInput,
  TriageOutput,
  VerifyInput,
  VerifyOutput,
} from "./types.ts";

// Fournisseur de test DÉTERMINISTE (contrat §6). Aucun appel réseau, aucun
// coût réel. Il ne sert jamais de repli à un vrai fournisseur. Ses verdicts de
// vérification sont marqués `simulated` et affichés comme tels.
// Comportements pilotés par des marqueurs explicites dans les documents de fixture :
//   [[fixture:url-inventee]]       → le rédacteur cite une source absente des documents
//   [[fixture:citation-inventee]]  → le rédacteur cite un passage absent du document
//   [[fixture:resume-trompeur]]    → titre, résumé, chiffres et statut inventés, avec une citation réelle sans rapport
//   [[fixture:contradiction]]      → le rédacteur signale une contradiction
//   [[fixture:statut-incertain]]   → le rédacteur signale un statut incertain
//   [[fixture:sortie-invalide]]    → sortie mal formée
//   [[fixture:ecarter]]            → écarté au tri

export interface TestProviderOptions {
  /** Pour les tests : identifiants de tâches absents des résultats (réponse partielle). */
  dropTaskIds?: Set<string>;
  /** Pour les tests : échec de soumission ambigu (réponse perdue après envoi). */
  failSubmitAfterSend?: boolean;
  /** Pour les tests : retrouve un lot par identifiant interne (rapprochement). */
  canFindByInternalId?: boolean;
  /** Pour les tests : lectures successives en échec avant la lecture normale ("null" = incomplète, "throw" = erreur). */
  usageFailures?: ("null" | "throw")[];
}

const MARKER = /\[\[fixture:[a-z-]+\]\]/g;

function firstSentences(text: string, max: number): string {
  const clean = text.replace(MARKER, "").replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?]+[.!?]/g) ?? [clean];
  let out = "";
  for (const s of parts) {
    if ((out + s).length > max) break;
    out += s;
  }
  return (out || clean.slice(0, max)).trim();
}

function triage(input: TriageInput): TriageOutput {
  return {
    decisions: input.candidates.map((c, i) => ({
      subjectId: c.subjectId,
      keep: !`${c.title} ${c.summary}`.includes("[[fixture:ecarter]]"),
      score: 100 - i,
      scientificStatus:
        c.sourceType === "scientific" ? (/arxiv|preprint|prepublication/i.test(c.url) ? "preprint" : "published") : "announcement",
    })),
  };
}

function draft(input: DraftInput): DraftOutput | Record<string, unknown> {
  const doc = input.documents[0];
  const all = input.documents.map((d) => d.text).join("\n");
  if (all.includes("[[fixture:sortie-invalide]]")) return { titre: "sortie mal formée" };
  const sentence = firstSentences(doc.text, 300);
  const sources = input.documents.map((d) => d.url);
  if (all.includes("[[fixture:url-inventee]]")) sources.push("https://source-inventee.example/article");
  if (all.includes("[[fixture:resume-trompeur]]")) {
    return {
      title: "Un robot guérit toutes les maladies",
      summary: "Un million de patients ont déjà été guéris et les essais cliniques sont confirmés.",
      scientificStatus: "published",
      sources,
      claims: [{ text: "Le robot guérit un million de patients.", documentId: doc.documentId, quote: sentence }],
    };
  }
  return {
    title: doc.title.replace(MARKER, "").trim(),
    summary: firstSentences(doc.text, 400),
    scientificStatus: input.statusHint ?? "announcement",
    sources,
    claims: [
      {
        text: sentence,
        documentId: doc.documentId,
        quote: all.includes("[[fixture:citation-inventee]]") ? "Une phrase qui ne figure dans aucun document consulté." : sentence,
      },
    ],
    flags: {
      contradiction: all.includes("[[fixture:contradiction]]"),
      uncertainStatus: all.includes("[[fixture:statut-incertain]]"),
    },
  };
}

/** Article de développement déterministe : phrases réellement présentes dans les documents. */
function develop(input: DevelopInput): DraftOutput | Record<string, unknown> {
  const all = input.documents.map((d) => d.text).join("\n");
  if (all.includes("[[fixture:sortie-invalide]]")) return { titre: "sortie mal formée" };
  const doc = input.documents[0];
  const body = input.documents
    .map((d) => firstSentences(d.text, 1600))
    .join(" ")
    .slice(0, 4800);
  const sentence = firstSentences(doc.text, 300);
  return {
    title: `${doc.title.replace(MARKER, "").trim()} : ce que disent les sources`,
    summary: body,
    scientificStatus: input.statusHint ?? "announcement",
    sources: input.documents.map((d) => d.url),
    claims: [{ text: sentence, documentId: doc.documentId, quote: sentence }],
    flags: { contradiction: all.includes("[[fixture:contradiction]]"), uncertainStatus: all.includes("[[fixture:statut-incertain]]") },
  };
}

const STATUS_CUES: Record<string, RegExp> = {
  preprint: /pr[ée]publication|preprint|arxiv|pas encore [ée]t[ée] relu|non relu/i,
  published: /publi[ée]e? dans|revue [àa] comit[ée]|peer[- ]review|relu par les pairs/i,
};

/** Vérification simulée : recouvrement lexical et quantités. Volontairement simple, jamais présentée comme réelle. */
export function simulatedVerify(input: VerifyInput): VerifyOutput {
  const docSentences = input.documents.flatMap((d) => sentences(d.text.replace(MARKER, "")).map((s) => ({ documentId: d.documentId, s })));
  const best = (text: string) =>
    docSentences.map((x) => ({ ...x, score: overlap(text, x.s) })).sort((a, b) => b.score - a.score)[0];
  const allText = input.documents.map((d) => d.text).join("\n");
  const statements = input.statements.map((st) => {
    const match = best(st.text);
    const supported = Boolean(match) && match.score >= 0.6 && missingQuantities(st.text, allText).length === 0;
    return supported ? { id: st.id, supported, documentId: match.documentId, quote: match.s } : { id: st.id, supported: false };
  });
  const cue = STATUS_CUES[input.scientificStatus];
  let status: VerifyOutput["status"] = { supported: false };
  if (input.scientificStatus === "announcement" || input.scientificStatus === "analysis") status = { supported: true };
  else if (cue) {
    const hit = docSentences.find((x) => cue.test(x.s));
    if (hit) status = { supported: true, documentId: hit.documentId, quote: hit.s };
  }
  return { statements, status, simulated: true };
}

/** Réponse déterministe du fournisseur de test (réutilisée par la fausse API des tests de l'adaptateur Claude). */
export function fixtureAnswer(request: ProviderRequest): ProviderResult {
  const output =
    request.kind === "triage"
      ? triage(request.input)
      : request.kind === "draft"
        ? draft(request.input)
        : request.kind === "develop"
          ? develop(request.input)
          : simulatedVerify(request.input);
  return { taskId: request.taskId, ok: true, output };
}

export function createTestProvider(q: Query, options: TestProviderOptions = {}): EditorialProvider {
  const readFailures = [...(options.usageFailures ?? [])];
  const load = async (externalId: string) => {
    const [row] = await q<{ requests: ProviderRequest[]; internal_id: string }>(
      `SELECT requests, internal_id FROM editorial_test_batches WHERE external_id = $1`,
      [externalId],
    );
    return row ?? null;
  };
  return {
    id: "test",
    label: "Fournisseur de test déterministe (aucun appel réel, vérifications simulées)",
    model: null,
    simulated: true,
    capabilities: { cancel: false, findByInternalId: Boolean(options.canFindByInternalId) },
    async submitBatch(internalId, requests) {
      const externalId = `test_${internalId}`;
      await q(`INSERT INTO editorial_test_batches (external_id, internal_id, requests) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
        externalId,
        internalId,
        JSON.stringify(requests),
      ]);
      if (options.failSubmitAfterSend) throw new Error("Réponse perdue après l'envoi (simulation)");
      return { externalId };
    },
    async readBatch(externalId, expectedTaskIds): Promise<BatchReadout> {
      const failure = readFailures.shift();
      if (failure === "throw") throw new Error("Lecture indisponible (simulation)");
      if (failure === "null") return { state: "ended", complete: false, reason: "usage pas encore disponible (simulation)" };
      const batch = await load(externalId);
      if (!batch) return { state: "ended", complete: false, reason: "lot inconnu du fournisseur de test" };
      const returned = batch.requests.filter((r) => !options.dropTaskIds?.has(r.taskId));
      const ids = new Set(returned.map((r) => r.taskId));
      if (ids.size !== expectedTaskIds.length || !expectedTaskIds.every((id) => ids.has(id))) {
        return { state: "ended", complete: false, reason: "résultats incomplets (simulation)" };
      }
      let inputChars = 0;
      let outputChars = 0;
      for (const r of returned) {
        inputChars += JSON.stringify(r.input).length;
        outputChars += JSON.stringify(fixtureAnswer(r)).length;
      }
      return {
        state: "ended",
        complete: true,
        results: returned.map(fixtureAnswer),
        usage: { inputTokens: Math.ceil(inputChars / 4), outputTokens: Math.ceil(outputChars / 4) },
      };
    },
    async findBatchByInternalId(internalId) {
      if (!options.canFindByInternalId) throw new Error("Capacité non disponible");
      const [row] = await q<{ external_id: string }>(`SELECT external_id FROM editorial_test_batches WHERE internal_id = $1`, [internalId]);
      return row ? { externalId: row.external_id } : null;
    },
  };
}
