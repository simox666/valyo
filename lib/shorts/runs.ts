// Journal des Shorts : une ligne par jour (heure de Paris). Sert d'anti-doublon (un article utilisé
// ne l'est plus jamais) et rend la préparation rejouable sans dépense : relancer le même jour rend
// le même script.

import { timingSafeEqual } from "node:crypto";
import type { Query } from "../editorial/types.ts";
import { selectShort, type ShortCandidate } from "./selection.ts";
import { buildScript, type ShortScript, type ShortWriter } from "./script.ts";

export interface ShortPlan {
  day: string;
  /** Faux pour un essai : rien n'est enregistré, les articles restent disponibles. */
  recorded: boolean;
  items: { postId: string; theme: string; themeSlug: string; source: string }[];
  script: ShortScript;
}

/** Jeton partagé avec l'automate (variable VALYO_SHORTS_TOKEN), comparé en temps constant. */
export function shortsAuthorized(request: Request): boolean {
  const expected = process.env.VALYO_SHORTS_TOKEN ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (expected.length < 24 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const items = (picked: readonly ShortCandidate[]) => picked.map((p) => ({ postId: p.postId, theme: p.theme, themeSlug: p.themeSlug, source: p.source }));

/** Prépare le Short du jour : choix des articles, script, enregistrement. Nul s'il n'y a pas trois articles. */
export async function prepareShort(deps: { q: Query; writer: ShortWriter; now: Date; day: string; siteUrl: string; dryRun: boolean }): Promise<ShortPlan | null> {
  const { q, day } = deps;
  if (!deps.dryRun) {
    const [existing] = await q<{ plan: ShortPlan }>(`SELECT plan FROM short_runs WHERE day = $1::date`, [day]);
    if (existing) return existing.plan;
  }
  const picked = await selectShort(q, deps.now);
  if (picked.length === 0) return null;
  const { draft, costMicros } = await deps.writer.write(picked);
  const plan: ShortPlan = { day, recorded: !deps.dryRun, items: items(picked), script: buildScript(draft, picked, deps.siteUrl) };
  if (!deps.dryRun) {
    await q(
      `INSERT INTO short_runs (day, post_ids, plan, cost_micros) VALUES ($1::date, $2::uuid[], $3::jsonb, $4) ON CONFLICT (day) DO NOTHING`,
      [day, picked.map((p) => p.postId), JSON.stringify(plan), costMicros],
    );
  }
  return plan;
}

export async function markShortSent(q: Query, day: string): Promise<boolean> {
  const rows = await q(`UPDATE short_runs SET status = 'sent', sent_at = now() WHERE day = $1::date RETURNING day`, [day]);
  return rows.length > 0;
}
