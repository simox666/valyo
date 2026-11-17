// Interface fournisseur (contrat §2). L'état technique du fournisseur est
// séparé du verdict éditorial : un lot « terminé » peut contenir des résultats
// rejetés par la validation serveur.

export interface TriageInput {
  candidates: { subjectId: string; title: string; summary: string; sourceType: string; publishedAt: string | null; url: string }[];
}

export interface TriageOutput {
  decisions: { subjectId: string; keep: boolean; score: number; scientificStatus: string }[];
}

export interface DraftDocument {
  documentId: string;
  url: string;
  title: string;
  publishedAt: string | null;
  text: string;
}

export interface DraftInput {
  subjectId: string;
  /** Statut proposé au tri, à confirmer ou corriger par le rédacteur. */
  statusHint: string | null;
  documents: DraftDocument[];
}

/** Sortie attendue du rédacteur ; validée côté serveur avant tout usage (validate.ts). */
export interface DraftOutput {
  title: string;
  summary: string;
  scientificStatus: string;
  sources: string[];
  claims: { text: string; documentId: string; quote: string }[];
  flags?: { contradiction?: boolean; suspiciousInstructions?: boolean; uncertainStatus?: boolean };
}

/**
 * Vérification indépendante de fidélité (revue B003). Le serveur fournit la
 * liste des énoncés à vérifier (titre, phrases du résumé, affirmations) et le
 * statut proposé ; le vérificateur doit, pour chacun, dire s'il est étayé et
 * citer le passage qui l'étaye. Le vérificateur peut se tromper : son verdict
 * n'est qu'une condition nécessaire, complétée par les contrôles serveur et la recette humaine.
 */
export interface VerifyInput {
  subjectId: string;
  statements: { id: string; text: string }[];
  scientificStatus: string;
  documents: DraftDocument[];
}

export interface VerifyOutput {
  statements: { id: string; supported: boolean; documentId?: string; quote?: string }[];
  status: { supported: boolean; documentId?: string; quote?: string };
  /** Vrai si le verdict provient d'un fournisseur de test (affiché comme tel). */
  simulated?: boolean;
}

/**
 * Développement lié (lot d'accélération A10) : article long et fidèle sur une nouvelle
 * déjà récapitulée. La sortie a la même forme que celle du rédacteur (DraftOutput),
 * le champ `summary` portant le corps de l'article ; elle passe par la même
 * vérification indépendante de fidélité.
 */
export interface DevelopInput {
  subjectId: string;
  statusHint: string | null;
  /** Résumé déjà publié dans le récapitulatif, pour la continuité éditoriale. */
  recapSummary: string | null;
  documents: DraftDocument[];
}

export type ProviderRequest =
  | { taskId: string; kind: "triage"; input: TriageInput; maxOutputTokens: number }
  | { taskId: string; kind: "draft"; input: DraftInput; maxOutputTokens: number }
  | { taskId: string; kind: "develop"; input: DevelopInput; maxOutputTokens: number }
  | { taskId: string; kind: "verify"; input: VerifyInput; maxOutputTokens: number };

export type ProviderResult =
  | { taskId: string; ok: true; output: unknown }
  | { taskId: string; ok: false; error: { code: string; message: string; permanent: boolean } };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** Erreur dont on sait avec certitude que la demande n'a pas été reçue par le fournisseur. */
export class ProviderNotSentError extends Error {}

/** Estimation (indicateur) et borne garantie (réservée) du coût d'une requête, en micro-unités. */
export interface RequestCost {
  estimateMicros: bigint;
  boundMicros: bigint;
}

/**
 * Lecture d'un lot (revue C201). Un lot terminé n'est « complet » que si ses résultats sont
 * cohérents : un résultat unique par requête attendue, aucun identifiant inconnu, compteurs du
 * fournisseur concordants, usages bien formés. Sinon, rien n'est appliqué ni rapproché.
 */
export type BatchReadout =
  | { state: "in_progress" }
  | { state: "ended"; complete: true; results: ProviderResult[]; usage: Usage }
  | { state: "ended"; complete: false; reason: string };

export interface EditorialProvider {
  id: "test" | "claude";
  label: string;
  /** Modèle réellement utilisé par l'adaptateur (revue C203) ; null pour le fournisseur de test. */
  model: string | null;
  /** Vrai seulement pour le fournisseur de test : seul ce champ (et non la sortie d'un modèle) marque une preuve comme simulée. */
  simulated: boolean;
  capabilities: { cancel: boolean; findByInternalId: boolean };
  /**
   * Coût de chaque requête, exactement telle qu'elle sera envoyée (revue C202) : estimation
   * indicative et borne GARANTIE fondée sur une limite documentée. Lève une erreur si aucune
   * borne garantie n'est disponible : la soumission est alors refusée. Absente pour le
   * fournisseur de test (majorant simulé).
   */
  costPerRequest?(requests: ProviderRequest[], prices: { inputPerMTokMicros: number; outputPerMTokMicros: number }): Promise<RequestCost[]>;
  submitBatch(internalId: string, requests: ProviderRequest[]): Promise<{ externalId: string }>;
  readBatch(externalId: string, expectedTaskIds: string[]): Promise<BatchReadout>;
  cancelBatch?(externalId: string): Promise<void>;
  findBatchByInternalId?(internalId: string): Promise<{ externalId: string } | null>;
}
