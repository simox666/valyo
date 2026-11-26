import { parseFeed, type FeedItem } from "../editorial/extract.ts";
import type { Transport } from "../editorial/fetch.ts";
import type { Db } from "../editorial/types.ts";
import { normalizeUrl } from "../urls.ts";
import { fullArticle, isPaywalled, ogImage } from "./page.ts";
import { ACTU_SOURCES, MAX_PER_RUN, classify, isPromotional, type ActuSource } from "./sources.ts";
import { autoSynthesize, type AutoSynthesisInput, type Summarizer } from "./synthesis.ts";

// Importation des actus réelles. Chaque nouvelle devient une publication de « Valyo Actus » :
// titre, court extrait (ou l'article complet pour une source sous licence libre), image fournie
// par le flux, thème, et la source en lien. Les membres la commentent, y réagissent, en font un salon.
// Si un résumeur est fourni, la synthèse IA de chaque nouvel article est générée dans la foulée
// (Haiku : une fraction de centime par article), après l'insertion de toutes les nouvelles.
// - Une seule importation à la fois et au plus une par heure (table actus_runs).
// - Doublons écartés par adresse normalisée (y compris si un membre l'a déjà partagée).
// - Fraîcheur : 3 jours au plus.
// - Accès libre seulement : la page de l'article est lue, un article réservé aux abonnés est écarté.
//   Elle fournit aussi l'image de l'éditeur (og:image) quand le flux n'en donne pas.

export const IMPORT_INTERVAL_MINUTES = 60;
const FRESH_DAYS = 3;
const EXCERPT = 400;

export interface ImportReport {
  imported: number;
  synthesized?: number;
  perSource: Record<string, number | string>;
  paywalled: number;
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= EXCERPT) return flat;
  const cut = flat.slice(0, EXCERPT);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" ")))}…`;
}

/** Article complet d'une source sous licence libre, suivi de l'attribution exigée par la licence. */
export function licensedBody(source: ActuSource, html: string, link: string): string | null {
  if (!source.license) return null;
  const article = fullArticle(html);
  if (!article) return null;
  const by = article.authors.map((a) => (a.role ? `${a.name} (${a.role})` : a.name)).join(", ");
  return [
    article.text,
    "———",
    `${by ? `Auteur${article.authors.length > 1 ? "s" : ""} : ${by}.\n` : ""}Cet article est republié à partir de ${source.name} sous licence ${source.license.name} (${source.license.url}). Lire l’article original : ${link}`,
  ].join("\n\n");
}

export async function importActus(deps: { db: Db; transport: Transport; now?: Date; sources?: ActuSource[]; summarize?: Summarizer | null; estimateMicros?: number }): Promise<ImportReport> {
  const { db, transport } = deps;
  const now = deps.now ?? new Date();
  const report: ImportReport = { imported: 0, perSource: {}, paywalled: 0 };
  const [account] = await db.query<{ id: string }>(`SELECT id FROM users WHERE handle = 'valyo-actus'`);
  if (!account) throw new Error("Compte valyo-actus absent (migration 017)");
  const themes = new Map((await db.query<{ id: string; slug: string }>(`SELECT id, slug FROM themes WHERE active`)).map((t) => [t.slug, t.id]));

  // Collecte réseau d'abord, hors transaction.
  const batches: { source: ActuSource; items: FeedItem[] }[] = [];
  for (const source of deps.sources ?? ACTU_SOURCES) {
    try {
      const items = parseFeed((await transport.get(source.url, "feed")).body)
        .filter((i) => i.title && i.link && i.publishedAt && now.getTime() - i.publishedAt.getTime() < FRESH_DAYS * 86400000)
        .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());
      batches.push({ source, items });
    } catch (error) {
      report.perSource[source.name] = `erreur : ${String(error).slice(0, 120)}`;
    }
  }

  // Alternance des sources pour un fil varié, plafond global par passage.
  const queue: { source: ActuSource; item: FeedItem }[] = [];
  for (let round = 0; queue.length < MAX_PER_RUN; round++) {
    let added = false;
    for (const { source, items } of batches) {
      if (round < source.perRun && items[round]) {
        queue.push({ source, item: items[round] });
        added = true;
      }
    }
    if (!added) break;
  }

  const toSummarize: AutoSynthesisInput[] = [];
  for (const { source, item } of queue.slice(0, MAX_PER_RUN)) {
    const normalized = normalizeUrl(item.link);
    if (!normalized) continue;
    if (isPromotional(item.title, item.summary, item.link)) continue;
    const theme = classify(source, `${item.title} ${item.summary}`);
    if (!theme || !themes.has(theme)) continue;
    const [known] = await db.query(`SELECT 1 FROM post_sources ps JOIN posts p ON p.id = ps.post_id WHERE ps.normalized_url = $1 AND p.status <> 'deleted'`, [normalized]);
    if (known) continue;
    let image = item.image && /^https:\/\//.test(item.image) ? item.image : null;
    let html: string | null = null;
    try {
      html = (await transport.get(item.link, "html")).body;
      if (isPaywalled(html)) {
        report.paywalled++;
        continue;
      }
      image ??= ogImage(html);
    } catch {
      // Page injoignable : la nouvelle reste (sources en accès libre), sans image supplémentaire.
    }
    const body = (html && licensedBody(source, html, item.link)) || excerpt(item.summary) || `Lire l'article sur ${source.name}.`;
    const created = await db.transaction(async (q) => {
      const [dup] = await q(`SELECT 1 FROM post_sources ps JOIN posts p ON p.id = ps.post_id WHERE ps.normalized_url = $1 AND p.status <> 'deleted'`, [normalized]);
      if (dup) return null;
      const [post] = await q<{ id: string }>(
        `INSERT INTO posts (author_id, kind, title, body, image_url, source_name, created_at)
         VALUES ($1, 'news', $2, $3, $4, $5, $6) RETURNING id`,
        [
          account.id,
          item.title.slice(0, 200),
          body,
          image,
          source.name,
          // L'heure de publication réelle de la source, jamais dans le futur.
          new Date(Math.min(item.publishedAt!.getTime(), now.getTime())).toISOString(),
        ],
      );
      await q(`INSERT INTO post_sources (post_id, position, url, normalized_url) VALUES ($1, 0, $2, $3)`, [post.id, item.link, normalized]);
      await q(`INSERT INTO post_themes (post_id, theme_id) VALUES ($1, $2)`, [post.id, themes.get(theme)]);
      return post.id;
    });
    if (created) {
      report.imported++;
      report.perSource[source.name] = Number(report.perSource[source.name] ?? 0) + 1;
      if (html) toSummarize.push({ postId: created, title: item.title.slice(0, 200), source: source.name, url: item.link, html });
    }
  }
  if (deps.summarize && toSummarize.length) {
    try {
      report.synthesized = await autoSynthesize({ db, summarize: deps.summarize, items: toSummarize, estimateMicros: deps.estimateMicros });
    } catch (error) {
      console.error("Synthèses automatiques interrompues :", String(error).slice(0, 300));
    }
  }
  return report;
}

/**
 * Déclenchement paresseux : appelé à l'affichage du fil, il lance une importation si la
 * dernière date de plus d'une heure. Une seule à la fois (réservation atomique). Ne bloque
 * jamais l'affichage : les erreurs sont consignées, pas propagées.
 */
export async function maybeImportActus(deps: { db: Db; transport: Transport; summarize?: Summarizer | null; estimateMicros?: number }): Promise<ImportReport | null> {
  const claimed = await deps.db.query(
    `UPDATE actus_runs SET started_at = now(), finished_at = NULL
     WHERE id = 1 AND started_at < now() - make_interval(mins => $1) RETURNING id`,
    [IMPORT_INTERVAL_MINUTES],
  );
  if (!claimed.length) return null;
  try {
    const report = await importActus(deps);
    await deps.db.query(`UPDATE actus_runs SET finished_at = now(), report = $1 WHERE id = 1`, [JSON.stringify(report)]);
    return report;
  } catch (error) {
    await deps.db.query(`UPDATE actus_runs SET finished_at = now(), report = $1 WHERE id = 1`, [JSON.stringify({ erreur: String(error).slice(0, 300) })]);
    return null;
  }
}
