import { normalizeUrl } from "../urls.ts";
import { loadConfig, logRevision } from "./config.ts";
import { subjectDocuments } from "./pipeline.ts";
import type { DraftDocument } from "./providers/types.ts";
import { enqueue } from "./tasks.ts";
import type { Db, Query, Row } from "./types.ts";

// Développement lié (lot d'accélération A10) : article long qui approfondit UNE
// nouvelle d'un récapitulatif, demandé explicitement — jamais une publication
// autonome de l'agent (decisions.md D8 proposé).
//
// Tant que D8 reste une proposition :
// - les demandes PUBLIQUES (membres) sont désactivées : seule une personne
//   administratrice peut demander un développement ;
// - aucun choix de priorité ni de plafond configurable n'est exposé : un seul
//   développement actif par sujet (index unique), c'est tout.
// Le pipeline, la vérification de fidélité et le budget sont RÉUTILISÉS :
// le développement est une tâche fournisseur ordinaire (kind « develop » puis
// « verify »), soumise par lots, réservée et rapprochée comme les autres.

const DEVELOP_MAX_OUTPUT_TOKENS = 8_000;
const MAX_DOCS = 4;
const MAX_DOC_CHARS = 8_000;

export type RequestOutcome =
  | { ok: true; developmentId: string }
  | { ok: false; code: "public_desactive" | "introuvable" | "etat" | "deja" | "origine"; message: string };

export async function requestDevelopment(
  db: Db,
  args: { recapItemId: string; trigger: "admin" | "member"; actorId: string | null; actorLabel: string },
): Promise<RequestOutcome> {
  if (args.trigger !== "admin") {
    return { ok: false, code: "public_desactive", message: "Demandes publiques de développement désactivées tant que la règle D8 n'est pas validée." };
  }
  return db.transaction(async (q) => {
    const [item] = await q(
      `SELECT i.*, r.state AS recap_state FROM editorial_recap_items i JOIN editorial_recaps r ON r.id = i.recap_id WHERE i.id = $1 FOR UPDATE`,
      [args.recapItemId],
    );
    if (!item) return { ok: false, code: "introuvable" as const, message: "Élément de récapitulatif introuvable." };
    if (item.recap_state !== "ready" && item.recap_state !== "published") {
      return { ok: false, code: "etat" as const, message: `Récapitulatif « ${item.recap_state} » : un développement part d'un brouillon validé ou publié.` };
    }
    const docs = await subjectDocuments(q, item.subject_id as string);
    const usable = docs.filter((d) => d.extracted_text || d.summary).slice(0, MAX_DOCS);
    if (usable.length === 0) {
      return { ok: false, code: "origine" as const, message: "Aucun document d'origine disponible : développement impossible." };
    }
    const inserted = await q<{ id: string }>(
      `INSERT INTO editorial_developments (recap_item_id, subject_id, requested_by) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING id`,
      [args.recapItemId, item.subject_id, args.actorId],
    );
    if (!inserted[0]) return { ok: false, code: "deja" as const, message: "Un développement actif existe déjà pour ce sujet." };
    const developmentId = inserted[0].id;
    const documents: DraftDocument[] = usable.map((d) => ({
      documentId: d.id as string,
      url: (d.final_url as string) || (d.url as string),
      title: d.title as string,
      publishedAt: d.published_at ? new Date(d.published_at as string).toISOString() : null,
      text: String(d.extracted_text || d.summary || "").slice(0, MAX_DOC_CHARS),
    }));
    const task = await enqueue(q, {
      kind: "develop",
      key: `develop:${developmentId}`,
      payload: {
        developmentId,
        maxOutputTokens: DEVELOP_MAX_OUTPUT_TOKENS,
        input: {
          subjectId: item.subject_id,
          statusHint: (item.scientific_status as string) ?? null,
          recapSummary: (item.summary as string) ?? null,
          documents,
        },
      },
    });
    await q(`UPDATE editorial_developments SET task_id = $2 WHERE id = $1`, [developmentId, task.id]);
    await logRevision(q, {
      entity: "development",
      entityId: developmentId,
      reason: "Développement demandé (déclenchement administrateur ; demandes publiques désactivées, D8 proposé)",
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    return { ok: true as const, developmentId };
  });
}

export type PublishDevOutcome =
  | { ok: true; postId: string }
  | { ok: false; code: "capacite" | "pause" | "introuvable" | "etat" | "origine"; message: string };

/** Corps public de l'article : texte validé uniquement, avec renvoi vers le récapitulatif d'origine. */
export function renderDevelopmentBody(content: { summary: string; sources: { url: string }[] }, recapPostId: string | null): string {
  const back = recapPostId ? `\n\nCette nouvelle développe un point du récapitulatif : /p/${recapPostId}` : "";
  const sources = content.sources.map((s) => s.url).join(" · ");
  return `${content.summary}\n\nSources : ${sources}${back}\n\nArticle automatisé de l'agent éditorial, vérifié à partir des sources citées. Signalez toute erreur : elle sera corrigée ou retirée.`;
}

/** Publication d'un développement : même capacité désactivée que les récapitulatifs (mode public + hors pause, sous verrou). */
export async function publishDevelopment(
  db: Db,
  args: { developmentId: string; actorId: string | null; actorLabel: string },
): Promise<PublishDevOutcome> {
  return db.transaction(async (q) => {
    const config = await loadConfig(q, { lock: true });
    if (config.mode !== "public") return { ok: false, code: "capacite", message: "Publication désactivée : la configuration est en mode brouillon." };
    if (config.paused) return { ok: false, code: "pause", message: "Agent en pause : aucune publication." };
    const [dev] = await q(
      `SELECT d.*, r.post_id AS recap_post_id FROM editorial_developments d
       JOIN editorial_recap_items i ON i.id = d.recap_item_id JOIN editorial_recaps r ON r.id = i.recap_id
       WHERE d.id = $1 FOR UPDATE`,
      [args.developmentId],
    );
    if (!dev) return { ok: false, code: "introuvable", message: "Développement introuvable." };
    if (dev.state !== "ready") return { ok: false, code: "etat", message: `État « ${dev.state} » : seul un article vérifié (ready) se publie.` };
    if (dev.origin_unavailable) return { ok: false, code: "origine", message: "Origine indisponible : publication refusée tant que la situation n'est pas examinée." };
    const content = dev.content as { title: string; summary: string; sources: { url: string }[]; verification?: unknown };
    // ACC05 (même principe que les récapitulatifs) : pas de publication sans preuve de
    // vérification attachée au texte exact.
    if (!content?.verification) return { ok: false, code: "etat", message: "Vérification absente ou invalidée : relecture requise avant publication." };
    const [agent] = await q<{ id: string }>(`SELECT id FROM users WHERE role = 'agent' ORDER BY created_at LIMIT 1`);
    const [post] = await q<{ id: string }>(`INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', $2, $3) RETURNING id`, [
      agent.id,
      content.title,
      renderDevelopmentBody(content, (dev.recap_post_id as string) ?? null),
    ]);
    let position = 0;
    const seen = new Set<string>();
    for (const s of content.sources) {
      const normalized = normalizeUrl(s.url);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      await q(`INSERT INTO post_sources (post_id, position, url, normalized_url) VALUES ($1, $2, $3, $4)`, [post.id, position++, s.url, normalized]);
    }
    await q(`UPDATE editorial_developments SET state = 'published', post_id = $2, updated_at = now() WHERE id = $1`, [args.developmentId, post.id]);
    await logRevision(q, {
      entity: "development",
      entityId: args.developmentId,
      after: { postId: post.id },
      reason: "Développement publié (relation réciproque avec le récapitulatif)",
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    return { ok: true, postId: post.id };
  });
}

/**
 * Origine indisponible : le document source a disparu ou a été retiré. L'article n'est
 * pas supprimé, mais l'état est marqué, la publication future est bloquée et, si
 * l'article est déjà public, un avertissement est ajouté en tête.
 */
export async function markOriginUnavailable(
  db: Db,
  args: { developmentId: string; motif: string; actorId: string | null; actorLabel: string },
): Promise<{ ok: boolean }> {
  return db.transaction(async (q) => {
    const [dev] = await q(`SELECT * FROM editorial_developments WHERE id = $1 FOR UPDATE`, [args.developmentId]);
    if (!dev) return { ok: false };
    await q(`UPDATE editorial_developments SET origin_unavailable = true, updated_at = now() WHERE id = $1`, [args.developmentId]);
    if (dev.post_id) {
      await q(`UPDATE posts SET body = $2 || body, edited_at = now() WHERE id = $1`, [
        dev.post_id,
        `⚠ Origine indisponible : la source de cet article n'est plus accessible (${args.motif}). Le contenu est conservé tel que vérifié à sa publication.\n\n`,
      ]);
    }
    await logRevision(q, {
      entity: "development",
      entityId: args.developmentId,
      reason: `Origine indisponible : ${args.motif}`,
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    return { ok: true };
  });
}

export type CorrectDevOutcome = { ok: true } | { ok: false; code: "introuvable" | "etat" | "inchange"; message: string };

/** Correction humaine d'un développement publié : texte remplacé, vérification invalidée, historique conservé. */
export async function correctDevelopment(
  db: Db,
  args: { developmentId: string; title: string; summary: string; motif: string; actorId: string | null; actorLabel: string; now?: Date },
): Promise<CorrectDevOutcome> {
  return db.transaction(async (q) => {
    const [dev] = await q(
      `SELECT d.*, r.post_id AS recap_post_id FROM editorial_developments d
       JOIN editorial_recap_items i ON i.id = d.recap_item_id JOIN editorial_recaps r ON r.id = i.recap_id
       WHERE d.id = $1 FOR UPDATE`,
      [args.developmentId],
    );
    if (!dev) return { ok: false, code: "introuvable", message: "Développement introuvable." };
    if (dev.state !== "published" || !dev.post_id) return { ok: false, code: "etat", message: "Seul un développement publié se corrige par cette voie." };
    const content = dev.content as { title: string; summary: string; sources: { url: string }[]; verification?: unknown };
    const title = args.title.trim();
    const summary = args.summary.trim();
    if (title === content.title && summary === content.summary) return { ok: false, code: "inchange", message: "Aucun changement de texte." };
    const at = (args.now ?? new Date()).toISOString();
    const history = Array.isArray((dev.human_revision as { historique?: unknown[] })?.historique)
      ? (dev.human_revision as { historique: unknown[] }).historique
      : [];
    const next = { ...content, title, summary };
    delete next.verification; // la vérification ne couvre plus le texte corrigé
    await q(`UPDATE editorial_developments SET content = $2, human_revision = $3, updated_at = now() WHERE id = $1`, [
      args.developmentId,
      JSON.stringify(next),
      JSON.stringify({
        motif: args.motif,
        par: args.actorLabel,
        le: at,
        verificationInvalidee: true,
        historique: [...history, { motif: args.motif, par: args.actorLabel, le: at, precedent: { title: content.title, summary: content.summary } }],
      }),
    ]);
    await q(`UPDATE posts SET title = $2, body = $3, edited_at = now() WHERE id = $1`, [
      dev.post_id,
      title,
      renderDevelopmentBody(next, (dev.recap_post_id as string) ?? null),
    ]);
    await logRevision(q, {
      entity: "development",
      entityId: args.developmentId,
      before: { title: content.title, summary: content.summary },
      after: { title, summary, verificationInvalidee: true },
      reason: `Correction éditoriale du développement : ${args.motif}`,
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    return { ok: true };
  });
}

/** Retrait d'un développement publié : la page devient indisponible, l'historique est conservé. */
export async function withdrawDevelopment(
  db: Db,
  args: { developmentId: string; motif: string; actorId: string | null; actorLabel: string },
): Promise<{ ok: boolean; message?: string }> {
  return db.transaction(async (q) => {
    const [dev] = await q(`SELECT * FROM editorial_developments WHERE id = $1 FOR UPDATE`, [args.developmentId]);
    if (!dev || dev.state !== "published" || !dev.post_id) return { ok: false, message: "Seul un développement publié se retire." };
    await q(`UPDATE posts SET status = 'removed', edited_at = now() WHERE id = $1`, [dev.post_id]);
    await q(`UPDATE editorial_developments SET state = 'withdrawn', updated_at = now() WHERE id = $1`, [args.developmentId]);
    await logRevision(q, {
      entity: "development",
      entityId: args.developmentId,
      reason: `Retrait du développement : ${args.motif}`,
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    return { ok: true };
  });
}

/** Développement publié rattaché à un sujet, pour la relation réciproque côté récapitulatif. */
export async function publishedDevelopmentFor(q: Query, subjectId: string): Promise<Row | null> {
  const [row] = await q(`SELECT id, post_id FROM editorial_developments WHERE subject_id = $1 AND state = 'published'`, [subjectId]);
  return row ?? null;
}
