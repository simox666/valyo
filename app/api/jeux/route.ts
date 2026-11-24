import { z } from "zod";
import { db } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { loadWeeklyQuiz, weeklyRound } from "@/lib/jeux/hebdo.ts";
import { grade, parisDay, recordScore, weekStart } from "@/lib/jeux/points.ts";
import { GAMES } from "@/lib/jeux/tirage.ts";

const pick = z.number().int().min(0).max(20);
const bodySchema = z.object({
  game: z.enum(GAMES),
  seed: z.string().max(40).regex(/^[a-z0-9]*$/),
  theme: z.string().max(40).regex(/^[a-z0-9-]*$/).optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  picks: z.union([z.array(pick).min(1).max(30), z.array(z.array(pick).min(1).max(10)).min(1).max(10)]),
});

/**
 * Fin de partie d'un membre connecté : le serveur rejoue la manche à partir de sa graine,
 * note les réponses et attribue les points (première partie du jour de chaque jeu seulement ; un quiz compte une fois par thème).
 */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Partie invalide.", 400);
  const today = parisDay();
  let weekly;
  if (parsed.data.game === "hebdo") {
    const questions = await loadWeeklyQuiz(db.query, parsed.data.day ?? weekStart(today));
    if (!questions) return fail("Ce quiz n'est plus disponible.", 400);
    weekly = weeklyRound(questions, parsed.data.seed);
  }
  const graded = grade({ ...parsed.data, weekly }, today);
  if (!graded.ok) return fail(graded.message, 400);
  const recorded = await recordScore(db.query, guard.user.id, parsed.data.game, graded.day, graded.marks, parsed.data.theme);
  return json({ ok: true, ...recorded });
}
