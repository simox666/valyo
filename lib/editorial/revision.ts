import { createHash } from "node:crypto";
import { logRevision } from "./config.ts";
import type { Query } from "./types.ts";

// Révision éditoriale administrative (lot d'accélération A7).
// Une personne corrige le texte d'un élément de récapitulatif NON publié, avec un motif.
// Dès que le texte change, la vérification de fidélité ne s'applique plus au nouveau
// texte : elle est INVALIDÉE (claims remis à NULL) et l'aperçu l'affiche. L'historique
// complet (avant/après, motif, acteur) est conservé dans editorial_revisions.
// Le retrait ou la correction d'un récapitulatif déjà publié relève de la transaction
// de publication (publish.ts), pas de cette révision.

export type ReviseOutcome =
  | { ok: true; verificationInvalidated: boolean }
  | { ok: false; code: "introuvable" | "etat" | "inchange"; message: string };

// Toujours verrouiller le parent AVANT de lire son élément. Sous READ COMMITTED,
// une jointure commencée avant l'attente du verrou peut mêler une version récente
// du parent et l'ancien texte de l'élément. La seconde requête prend un nouveau snapshot.
export async function lockRecapItem(q: Query, itemId: string): Promise<Record<string, unknown> | undefined> {
  const [recap] = await q(
    `SELECT * FROM editorial_recaps WHERE id =
     (SELECT recap_id FROM editorial_recap_items WHERE id = $1) FOR UPDATE`, [itemId],
  );
  if (!recap) return undefined;
  const [item] = await q(`SELECT * FROM editorial_recap_items WHERE id = $1 AND recap_id = $2`, [itemId, recap.id]);
  return item ? { ...item, recap_state: recap.state, recap_version: recap.version, post_id: recap.post_id } : undefined;
}

export async function reviseRecapItem(
  q: Query,
  args: { itemId: string; title: string; summary: string; motif: string; actorId: string | null; actorLabel: string; now?: Date },
): Promise<ReviseOutcome> {
  const item = await lockRecapItem(q, args.itemId);
  if (!item) return { ok: false, code: "introuvable", message: "Élément introuvable." };
  if (item.recap_state === "published" || item.recap_state === "withdrawn") {
    return { ok: false, code: "etat", message: "Récapitulatif publié ou retiré : passer par la correction éditoriale, pas par la révision de brouillon." };
  }
  const title = args.title.trim();
  const summary = args.summary.trim();
  const changed = title !== (item.title as string) || summary !== (item.summary as string);
  if (!changed) return { ok: false, code: "inchange", message: "Aucun changement de texte : rien à réviser." };

  const at = (args.now ?? new Date()).toISOString();
  const previous = { title: item.title, summary: item.summary };
  const history = Array.isArray((item.human_revision as { historique?: unknown[] })?.historique)
    ? (item.human_revision as { historique: unknown[] }).historique
    : [];
  const humanRevision = {
    motif: args.motif,
    par: args.actorLabel,
    le: at,
    verificationInvalidee: true,
    historique: [...history, { motif: args.motif, par: args.actorLabel, le: at, precedent: previous }],
  };
  await q(
    `UPDATE editorial_recap_items SET title = $2, summary = $3, claims = NULL, human_revision = $4 WHERE id = $1`,
    [args.itemId, title, summary, JSON.stringify(humanRevision)],
  );
  // ACC05 : la révision invalide aussi L'ÉTAT PUBLIABLE et la version du récapitulatif.
  // Un brouillon « ready » repasse à l'examen, et toute version déjà relue est périmée :
  // la publication avec l'ancienne version est refusée.
  await q(
    `UPDATE editorial_recaps SET state = CASE WHEN state = 'ready' THEN 'review_required' ELSE state END,
       version = version + 1, notes = notes || '{"motif": "revision_humaine_a_relire"}'::jsonb, updated_at = now()
     WHERE id = $1`,
    [item.recap_id],
  );
  await logRevision(q, {
    entity: "recap_item",
    entityId: args.itemId,
    before: previous,
    after: { title, summary, verificationInvalidee: true },
    reason: `Révision éditoriale : ${args.motif}`,
    actorId: args.actorId,
    actorLabel: args.actorLabel,
  });
  return { ok: true, verificationInvalidated: true };
}

export type ApproveOutcome = { ok: true } | { ok: false; code: "introuvable" | "etat" | "inutile" | "version"; message: string };

/**
 * RELECTURE humaine explicite d'un élément révisé (ACC05) : la personne atteste avoir
 * relu le texte exact contre les sources. C'est la seule voie de retour vers un état
 * publiable pour un élément dont la vérification automatique a été invalidée.
 */
export async function approveRecapItem(
  q: Query,
  args: { itemId: string; expectedVersion: number; motif: string; actorId: string | null; actorLabel: string; now?: Date },
): Promise<ApproveOutcome> {
  const item = await lockRecapItem(q, args.itemId);
  if (!item) return { ok: false, code: "introuvable", message: "Élément introuvable." };
  if (item.recap_state === "published" || item.recap_state === "withdrawn") {
    return { ok: false, code: "etat", message: "Récapitulatif publié ou retiré : la relecture ne s'applique qu'aux brouillons." };
  }
  if (Number(item.recap_version) !== args.expectedVersion) return { ok: false, code: "version", message: "Le brouillon a changé depuis son affichage : rechargez et relisez avant d'approuver." };
  if (item.claims) return { ok: false, code: "inutile", message: "La vérification de cet élément est encore valide : rien à relire." };
  const revision = (item.human_revision as Record<string, unknown>) ?? {};
  await q(`UPDATE editorial_recap_items SET human_revision = $2 WHERE id = $1`, [
    args.itemId,
    JSON.stringify({ ...revision, relecture: { fingerprint: evidenceFingerprint(item), par: args.actorLabel, le: (args.now ?? new Date()).toISOString(), motif: args.motif } }),
  ]);
  await logRevision(q, {
    entity: "recap_item",
    entityId: args.itemId,
    reason: `Relecture humaine après révision : ${args.motif}`,
    actorId: args.actorId,
    actorLabel: args.actorLabel,
  });
  return { ok: true };
}

/** Un élément est publiable si sa vérification automatique est valide OU si une relecture humaine l'atteste (ACC05). */
export function evidenceFingerprint(item: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify([item.title, item.summary, item.scientific_status, item.sources])).digest("hex");
}

export function itemEvidenceValid(item: { claims: unknown; human_revision: unknown } & Record<string, unknown>): boolean {
  if (item.claims) return true;
  const relecture = (item.human_revision as { relecture?: { fingerprint?: string } } | null)?.relecture;
  return Boolean(relecture?.fingerprint && relecture.fingerprint === evidenceFingerprint(item));
}

export type RecapReadyOutcome = { ok: true } | { ok: false; code: "introuvable" | "etat" | "elements" | "version"; message: string };

/** Repasse un récapitulatif révisé en « ready », seulement si CHAQUE élément a une preuve valide ou une relecture. */
export async function markRecapReady(
  q: Query,
  args: { recapId: string; expectedVersion: number; motif: string; actorId: string | null; actorLabel: string },
): Promise<RecapReadyOutcome> {
  const [recap] = await q(`SELECT * FROM editorial_recaps WHERE id = $1 FOR UPDATE`, [args.recapId]);
  if (!recap) return { ok: false, code: "introuvable", message: "Récapitulatif introuvable." };
  if (recap.state !== "review_required") return { ok: false, code: "etat", message: `État « ${recap.state} » : seul un récapitulatif à examiner se revalide.` };
  if (Number(recap.version) !== args.expectedVersion) return { ok: false, code: "version", message: "Le brouillon a changé : rechargez la page." };
  const items = await q(`SELECT * FROM editorial_recap_items WHERE recap_id = $1`, [args.recapId]);
  const missing = items.filter((i) => !itemEvidenceValid(i as { claims: unknown; human_revision: unknown })).length;
  if (missing > 0) {
    return { ok: false, code: "elements", message: `${missing} élément(s) sans vérification valide ni relecture humaine : relire d'abord chaque élément révisé.` };
  }
  await q(`UPDATE editorial_recaps SET state = 'ready', version = version + 1, updated_at = now() WHERE id = $1`, [args.recapId]);
  await logRevision(q, {
    entity: "recap",
    entityId: args.recapId,
    reason: `Brouillon revalidé après relecture : ${args.motif}`,
    actorId: args.actorId,
    actorLabel: args.actorLabel,
  });
  return { ok: true };
}
