import "server-only";
import { db } from "../db";
import { budgetSummary } from "../editorial/budget.ts";
import { loadConfig, readiness } from "../editorial/config.ts";
import { utcPeriod } from "../editorial/time.ts";

// Lectures pour la console d'administration. Réservé aux administrateurs : les
// pages appelantes vérifient le rôle côté serveur avant tout appel.

export async function editorialOverview() {
  const config = await loadConfig(db.query);
  const [budget, sources, recaps, subjectCounts, review, taskCounts, tasks, batches, revisions] = await Promise.all([
    budgetSummary(db.query, utcPeriod(new Date()), config.budgetCapMicros, config.currency),
    db.query(`SELECT * FROM editorial_sources ORDER BY active DESC, priority, name`),
    db.query(
      `SELECT r.*, (SELECT count(*)::int FROM editorial_recap_items i WHERE i.recap_id = r.id) AS items
       FROM editorial_recaps r ORDER BY slot_at DESC LIMIT 20`,
    ),
    db.query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM editorial_subjects GROUP BY status ORDER BY status`),
    db.query(
      `SELECT s.id, s.title, s.status, s.block_reason, s.duplicate_post_id, s.draft->>'refus' AS refus, s.updated_at,
         (SELECT d.url FROM editorial_documents d WHERE d.id = s.primary_document_id) AS url
       FROM editorial_subjects s WHERE s.status IN ('review_required', 'duplicate') ORDER BY s.updated_at DESC LIMIT 50`,
    ),
    db.query<{ state: string; n: number }>(`SELECT state, count(*)::int AS n FROM editorial_tasks GROUP BY state ORDER BY state`),
    db.query(
      `SELECT id, kind, state, attempts, max_attempts, next_attempt_at, error, updated_at FROM editorial_tasks
       WHERE state NOT IN ('done') ORDER BY updated_at DESC LIMIT 30`,
    ),
    // Identifiants externes du fournisseur volontairement absents.
    db.query(`SELECT id, provider, state, created_at, submitted_at, ended_at, usage, error FROM editorial_batches ORDER BY created_at DESC LIMIT 15`),
    db.query(`SELECT entity, entity_id, reason, actor_label, created_at FROM editorial_revisions ORDER BY created_at DESC LIMIT 15`),
  ]);
  return { config, ready: readiness(config, { claudeKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY) }), budget, sources, recaps, subjectCounts, review, taskCounts, tasks, batches, revisions };
}

/** Rendu PUBLIC (lot d'accélération A9) : éléments structurés du récapitulatif publié lié à cette publication. */
export async function publishedRecapItems(postId: string) {
  const [recap] = await db.query(`SELECT id, state FROM editorial_recaps WHERE post_id = $1`, [postId]);
  if (!recap || recap.state !== "published") return null;
  const items = await db.query(
    `SELECT i.id, i.position, i.title, i.summary, i.scientific_status, i.sources, i.human_revision, dv.post_id AS development_post_id
     FROM editorial_recap_items i
     LEFT JOIN editorial_developments dv ON dv.recap_item_id = i.id AND dv.state = 'published'
     WHERE i.recap_id = $1 ORDER BY i.position`,
    [recap.id],
  );
  return items.map((i) => {
    const revision = i.human_revision as { motif: string; le: string; correctionPubliee?: boolean } | null;
    return {
      id: i.id as string,
      position: Number(i.position),
      title: i.title as string,
      summary: i.summary as string,
      scientificStatus: i.scientific_status as string,
      sources: i.sources as { url: string; title: string }[],
      correction: revision?.correctionPubliee ? { motif: revision.motif, le: revision.le } : null,
      developmentPostId: (i.development_post_id as string) ?? null,
    };
  });
}

export async function recapPreview(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [recap] = await db.query(`SELECT * FROM editorial_recaps WHERE id = $1`, [id]);
  if (!recap) return null;
  const items = await db.query(`SELECT * FROM editorial_recap_items WHERE recap_id = $1 ORDER BY position`, [id]);
  return { recap, items };
}
