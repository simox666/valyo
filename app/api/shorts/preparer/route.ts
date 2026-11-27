import { db } from "@/lib/db";
import { fail, json, readJson } from "@/lib/http";
import { parisDay } from "@/lib/jeux/points.ts";
import { SITE_URL } from "@/components/JsonLd";
import { prepareShort, shortsAuthorized } from "@/lib/shorts/runs.ts";
import { createShortWriter } from "@/lib/shorts/script.ts";

/**
 * Prépare le Short du jour pour l'automate (automation/shorts) : choisit trois articles et écrit le script.
 * Protégé par le jeton VALYO_SHORTS_TOKEN. `dryRun` : un essai, rien n'est enregistré.
 */
export async function POST(request: Request) {
  if (!shortsAuthorized(request)) return fail("Accès refusé.", 401);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("ANTHROPIC_API_KEY n'est pas configurée.", 503);
  const body = ((await readJson(request).catch(() => null)) ?? {}) as { dryRun?: unknown };
  try {
    const plan = await prepareShort({ q: db.query, writer: createShortWriter({ apiKey, model: process.env.VALYO_SHORTS_MODELE }), now: new Date(), day: parisDay(), siteUrl: SITE_URL, dryRun: body.dryRun === true });
    if (!plan) return fail("Pas assez d'articles récents non encore utilisés pour faire un Short aujourd'hui.", 409);
    return json(plan);
  } catch (error) {
    return fail((error as Error).message || "Préparation impossible.", 502);
  }
}
