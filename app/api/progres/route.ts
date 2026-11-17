import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { markSeen, nextGoal, syncProgress } from "@/lib/social/progress.ts";

/** Progression du membre connecté : série, prochain objectif et paliers pas encore montrés. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.onboarded) return fail("Connectez-vous pour continuer.", 401);
  const { progress, unseen } = await syncProgress(db.query, user.id);
  return json({
    ok: true,
    streak: progress.streak,
    goal: nextGoal(progress),
    elements: progress.themes.filter((t) => t.level > 0).length,
    totalElements: progress.themes.length,
    unseen,
  });
}

const bodySchema = z.object({ seen: z.array(z.string().min(1).max(80)).min(1).max(20) });

/** Le toast a été montré : ces paliers ne réapparaîtront plus. */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  await markSeen(db.query, guard.user.id, parsed.data.seen);
  return json({ ok: true });
}
