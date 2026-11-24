import "server-only";
import { db } from "../db";
import { ensureWeeklyQuiz } from "./hebdo.ts";
import { createClaudeQuizWriter } from "./hebdo-claude.ts";
import { parisDay } from "./points.ts";

declare global {
  // eslint-disable-next-line no-var
  var __valyoWeeklyQuiz: ReturnType<typeof setInterval> | undefined;
}

async function tick(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || process.env.VALYO_QUIZ_HEBDO === "off") return;
  const now = new Date();
  const outcome = await ensureWeeklyQuiz({ q: db.query, writer: createClaudeQuizWriter({ apiKey, model: process.env.VALYO_QUIZ_MODELE }), now, day: parisDay(now) });
  if (outcome === "ready" || outcome === "failed") console.log(`[quiz de la semaine] ${outcome}`);
}

/** Fabrique le quiz de la semaine dès qu'il manque : une vérification peu après le démarrage, puis toutes les 30 minutes. */
export function startWeeklyQuizLoop(): void {
  if (globalThis.__valyoWeeklyQuiz) return;
  const run = () => { tick().catch((error) => console.error("[quiz de la semaine] échec :", (error as Error).message)); };
  setTimeout(run, 60_000).unref?.();
  globalThis.__valyoWeeklyQuiz = setInterval(run, 30 * 60 * 1000);
  globalThis.__valyoWeeklyQuiz.unref?.();
}
