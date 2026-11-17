import { normalizeUrl } from "../urls.ts";
import { loadConfig, logRevision } from "./config.ts";
import { isFresh, memberDuplicate, subjectDocuments, documentUrls } from "./pipeline.ts";
import { itemEvidenceValid, lockRecapItem } from "./revision.ts";
import { SCIENTIFIC_STATUS_LABELS, type Db, type Query, type Row, type ScientificStatus } from "./types.ts";

// Transaction de publication et retrait/correction éditoriale (lot d'accélération A8).
//
// CAPACITÉ DÉSACTIVÉE : la publication n'est possible que si la configuration est en
// mode « public » ET non en pause, vérifié SOUS VERROU dans la transaction même. La
// console refuse de passer en mode public tant que la recette D4 n'est pas faite :
// cette voie ne peut donc s'exercer que sur une base dédiée de test.
//
// Vérifications AU COMMIT (contrat §5, règle conservatrice) :
// - fraîcheur à l'instant RÉEL (pas celui du créneau) ;
// - doublons tardifs avec les publications des membres ;
// - unicité (récapitulatif jamais publié deux fois) et version attendue.
// Le retrait reste possible quel que soit le mode : corriger du contenu déjà public
// est une action de sécurité, pas une publication.

export type PublishOutcome =
  | { ok: true; postId: string; published: number; excluded: { itemId: string; motif: string }[] }
  | { ok: false; code: "capacite" | "pause" | "introuvable" | "etat" | "version" | "deja_publie" | "vide" | "verification"; message: string };

interface ItemRow extends Row {
  id: string;
  subject_id: string;
  position: number;
  title: string;
  summary: string;
  scientific_status: string;
  sources: { url: string; title: string }[];
}

/** Corps de la publication, dérivé des seuls éléments validés (aucun HTML du modèle). */
export function renderRecapBody(items: Pick<ItemRow, "title" | "summary" | "scientific_status" | "sources">[]): string {
  const blocks = items.map((item, i) => {
    const status = SCIENTIFIC_STATUS_LABELS[item.scientific_status as ScientificStatus] ?? "Statut inconnu";
    const sources = item.sources.map((s) => s.url).join(" · ");
    return `${i + 1}. ${item.title}\n[${status}]\n${item.summary}\nSources : ${sources}`;
  });
  return `${blocks.join("\n\n")}\n\nRésumés automatisés par l'agent éditorial, à partir des sources citées. Signalez toute erreur : elle sera corrigée ou retirée.`;
}

async function agentUserId(q: Query): Promise<string> {
  const [row] = await q<{ id: string }>(`SELECT id FROM users WHERE role = 'agent' ORDER BY created_at LIMIT 1`);
  if (!row) throw new Error("Compte agent-editorial absent");
  return row.id;
}

export async function publishRecap(
  db: Db,
  args: { recapId: string; expectedVersion: number; now: Date; actorId: string | null; actorLabel: string },
): Promise<PublishOutcome> {
  return db.transaction(async (q) => {
    // Capacité vérifiée sous verrou : pause ou mode brouillon arrêtent tout.
    const config = await loadConfig(q, { lock: true });
    if (config.mode !== "public") return { ok: false, code: "capacite", message: "Publication désactivée : la configuration est en mode brouillon." };
    if (config.paused) return { ok: false, code: "pause", message: "Agent en pause : aucune publication." };

    const [recap] = await q(`SELECT * FROM editorial_recaps WHERE id = $1 FOR UPDATE`, [args.recapId]);
    if (!recap) return { ok: false, code: "introuvable", message: "Récapitulatif introuvable." };
    if (recap.post_id) return { ok: false, code: "deja_publie", message: "Récapitulatif déjà publié : unicité garantie." };
    if (recap.state !== "ready") return { ok: false, code: "etat", message: `État « ${recap.state} » : seul un brouillon validé (ready) se publie.` };
    if (Number(recap.version) !== args.expectedVersion) {
      return { ok: false, code: "version", message: `Version ${recap.version} différente de la version relue (${args.expectedVersion}) : relire avant de publier.` };
    }

    const items = (await q(`SELECT * FROM editorial_recap_items WHERE recap_id = $1 ORDER BY position`, [args.recapId])) as ItemRow[];
    // ACC05 : contrôle FINAL des preuves au commit. Chaque élément doit porter une
    // vérification valide pour SON texte exact, ou une relecture humaine qui l'atteste.
    const unverified = items.filter((item) => !itemEvidenceValid(item as unknown as { claims: unknown; human_revision: unknown }));
    if (unverified.length > 0) {
      return {
        ok: false,
        code: "verification",
        message: `${unverified.length} élément(s) dont la vérification a été invalidée par une révision : relecture humaine requise avant publication.`,
      };
    }
    const published: ItemRow[] = [];
    const excluded: { itemId: string; motif: string }[] = [];
    for (const item of items) {
      const docs = await subjectDocuments(q, item.subject_id);
      if (!isFresh(docs, args.now)) {
        excluded.push({ itemId: item.id, motif: "perime_au_commit" });
        await q(`UPDATE editorial_subjects SET status = 'ignored', block_reason = 'perime', updated_at = now() WHERE id = $1`, [item.subject_id]);
        continue;
      }
      const dup = await memberDuplicate(q, docs.flatMap(documentUrls));
      if (dup) {
        excluded.push({ itemId: item.id, motif: "doublon_tardif" });
        await q(`UPDATE editorial_subjects SET status = 'duplicate', duplicate_post_id = $2, updated_at = now() WHERE id = $1`, [item.subject_id, dup]);
        continue;
      }
      published.push(item);
    }
    if (excluded.length > 0) {
      await q(`UPDATE editorial_recaps SET notes = notes || $2::jsonb, updated_at = now() WHERE id = $1`, [
        args.recapId,
        JSON.stringify({ exclusionsAuCommit: excluded }),
      ]);
      await q(`DELETE FROM editorial_recap_items WHERE id = ANY($1::uuid[])`, [excluded.map((e) => e.itemId)]);
    }
    if (published.length === 0) {
      return { ok: false, code: "vide", message: "Plus aucune nouvelle publiable au commit (fraîcheur ou doublons) : rien n'est publié." };
    }

    const title = `Sciences et tech : le récapitulatif du ${new Date(recap.slot_at as string).toISOString().slice(0, 10)}`;
    const [post] = await q<{ id: string }>(
      `INSERT INTO posts (author_id, kind, title, body) VALUES ($1, 'news', $2, $3) RETURNING id`,
      [await agentUserId(q), title, renderRecapBody(published)],
    );
    const seen = new Set<string>();
    let position = 0;
    for (const item of published) {
      for (const source of item.sources) {
        const normalized = normalizeUrl(source.url);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        await q(`INSERT INTO post_sources (post_id, position, url, normalized_url) VALUES ($1, $2, $3, $4)`, [post.id, position++, source.url, normalized]);
      }
    }
    await q(`UPDATE editorial_recaps SET state = 'published', post_id = $2, version = version + 1, updated_at = now() WHERE id = $1`, [
      args.recapId,
      post.id,
    ]);
    await logRevision(q, {
      entity: "recap",
      entityId: args.recapId,
      after: { postId: post.id, published: published.length, excluded },
      reason: "Publication du récapitulatif (vérifications au commit : fraîcheur réelle, doublons tardifs, unicité, version)",
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    return { ok: true, postId: post.id, published: published.length, excluded };
  });
}

export type WithdrawOutcome = { ok: true } | { ok: false; code: "introuvable" | "etat"; message: string };

/** Retrait éditorial : la publication devient indisponible, l'historique est conservé. Possible quel que soit le mode. */
export async function withdrawRecap(
  db: Db,
  args: { recapId: string; motif: string; actorId: string | null; actorLabel: string },
): Promise<WithdrawOutcome> {
  return db.transaction(async (q) => {
    const [recap] = await q(`SELECT * FROM editorial_recaps WHERE id = $1 FOR UPDATE`, [args.recapId]);
    if (!recap) return { ok: false, code: "introuvable", message: "Récapitulatif introuvable." };
    if (recap.state !== "published" || !recap.post_id) return { ok: false, code: "etat", message: "Seul un récapitulatif publié se retire." };
    await q(`UPDATE posts SET status = 'removed', edited_at = now() WHERE id = $1`, [recap.post_id]);
    await q(`UPDATE editorial_recaps SET state = 'withdrawn', version = version + 1, notes = notes || $2::jsonb, updated_at = now() WHERE id = $1`, [
      args.recapId,
      JSON.stringify({ retrait: { motif: args.motif } }),
    ]);
    await logRevision(q, {
      entity: "recap",
      entityId: args.recapId,
      reason: `Retrait éditorial : ${args.motif}`,
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    return { ok: true };
  });
}

export type CorrectOutcome = { ok: true } | { ok: false; code: "introuvable" | "etat" | "inchange"; message: string };

/**
 * Correction éditoriale d'une publication : le texte corrigé remplace l'ancien dans la
 * publication, la vérification de fidélité de l'élément est invalidée et la version
 * du récapitulatif augmente. Possible quel que soit le mode (action de sécurité).
 */
export async function correctPublishedItem(
  db: Db,
  args: { itemId: string; title: string; summary: string; motif: string; actorId: string | null; actorLabel: string; now?: Date },
): Promise<CorrectOutcome> {
  return db.transaction(async (q) => {
    const item = await lockRecapItem(q, args.itemId);
    if (!item) return { ok: false, code: "introuvable", message: "Élément introuvable." };
    if (item.recap_state !== "published" || !item.post_id) {
      return { ok: false, code: "etat", message: "Élément non publié : utiliser la révision de brouillon." };
    }
    const title = args.title.trim();
    const summary = args.summary.trim();
    if (title === item.title && summary === item.summary) return { ok: false, code: "inchange", message: "Aucun changement de texte." };
    const at = (args.now ?? new Date()).toISOString();
    const previous = { title: item.title, summary: item.summary };
    const history = Array.isArray((item.human_revision as { historique?: unknown[] })?.historique)
      ? (item.human_revision as { historique: unknown[] }).historique
      : [];
    await q(`UPDATE editorial_recap_items SET title = $2, summary = $3, claims = NULL, human_revision = $4 WHERE id = $1`, [
      args.itemId,
      title,
      summary,
      JSON.stringify({
        motif: args.motif,
        par: args.actorLabel,
        le: at,
        verificationInvalidee: true,
        correctionPubliee: true,
        historique: [...history, { motif: args.motif, par: args.actorLabel, le: at, precedent: previous }],
      }),
    ]);
    const items = (await q(`SELECT * FROM editorial_recap_items WHERE recap_id = $1 ORDER BY position`, [item.recap_id])) as ItemRow[];
    await q(`UPDATE posts SET body = $2, edited_at = now() WHERE id = $1`, [item.post_id, renderRecapBody(items)]);
    await q(`UPDATE editorial_recaps SET version = version + 1, updated_at = now() WHERE id = $1`, [item.recap_id]);
    await logRevision(q, {
      entity: "recap_item",
      entityId: args.itemId,
      before: previous,
      after: { title, summary, correctionPubliee: true },
      reason: `Correction éditoriale publiée : ${args.motif}`,
      actorId: args.actorId,
      actorLabel: args.actorLabel,
    });
    return { ok: true };
  });
}
