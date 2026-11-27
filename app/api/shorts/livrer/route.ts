import { configuredAdminEmails } from "@/lib/admins.ts";
import { db } from "@/lib/db";
import { sendShortDelivery } from "@/lib/email";
import { fail, json, readBodyCapped } from "@/lib/http";
import { markShortSent, shortsAuthorized, type ShortPlan } from "@/lib/shorts/runs.ts";

const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

/**
 * Reçoit la vidéo du jour (corps de la requête, MP4) et l'envoie par e-mail aux administrateurs,
 * avec le titre et la description à coller dans YouTube. Rien n'est publié automatiquement.
 */
export async function POST(request: Request) {
  if (!shortsAuthorized(request)) return fail("Accès refusé.", 401);
  const day = new URL(request.url).searchParams.get("day") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail("Jour invalide.", 400);
  const [run] = await db.query<{ plan: ShortPlan }>(`SELECT plan FROM short_runs WHERE day = $1::date`, [day]);
  if (!run) return fail("Aucun Short préparé pour ce jour.", 404);
  const bytes = await readBodyCapped(request, MAX_VIDEO_BYTES);
  if (!bytes || bytes.length < 10_000) return fail("Vidéo absente ou trop lourde (30 Mo au plus).", 400);
  const to = configuredAdminEmails();
  if (to.length === 0) return fail("Aucune adresse d'administrateur configurée (ADMIN_EMAILS).", 503);
  const s = run.plan.script;
  try {
    await sendShortDelivery(to, { day, title: s.youtubeTitle, description: s.description, tags: s.tags, spoken: [s.hook, ...s.news.map((n) => n.spoken), s.question, s.cta], video: Buffer.from(bytes) });
  } catch (error) {
    return fail((error as Error).message || "Envoi impossible.", 502);
  }
  await markShortSent(db.query, day);
  return json({ ok: true, recipients: to.length });
}
