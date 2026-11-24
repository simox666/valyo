// Quiz de la semaine : des questions tirées des articles de presse publiés sur Valyo pendant
// les sept derniers jours, écrites par l'IA puis publiées sans relecture humaine.
// Garde-fous, puisque personne ne relit :
//  - seuls des articles de presse importés servent de matière (jamais un texte de membre) ;
//  - chaque question est contrôlée ici (forme, article d'origine, propositions distinctes) ;
//  - une seconde passe de l'IA vérifie chaque question contre le texte de l'article, et toute
//    question non confirmée est écartée ;
//  - en dessous de MIN_QUESTIONS questions retenues, la semaine reste sans quiz ;
//  - au plus MAX_ATTEMPTS essais par semaine, donc une dépense bornée.

import type { Query } from "../editorial/types.ts";
import { weekStart } from "./points.ts";
import { seededRandom, shuffle, type PlayableQuestion } from "./tirage.ts";

export const WEEKLY_SIZE = 7;
export const MIN_QUESTIONS = 5;
export const MIN_ARTICLES = 6;
export const MAX_ARTICLES = 14;
export const MAX_ATTEMPTS = 3;
/** Délai avant de retenter après un échec, ou de reprendre un essai resté en plan. */
export const RETRY_AFTER_MS = 60 * 60 * 1000;

export interface WeeklyArticle {
  postId: string;
  source: string;
  title: string;
  /** Extrait de l'article, complété de sa synthèse quand elle existe. */
  text: string;
}

export interface WeeklyQuestion {
  postId: string;
  source: string;
  question: string;
  /** La bonne réponse en premier ; l'ordre est mélangé à chaque partie. */
  choices: string[];
  explain: string;
}

/** Ce que l'IA propose, avant contrôle. */
export interface DraftQuestion {
  postId: string;
  question: string;
  good: string;
  wrong: string[];
  explain: string;
}

export interface QuizWriter {
  /** Rédige des questions à partir des articles. */
  write(articles: WeeklyArticle[], count: number): Promise<{ drafts: DraftQuestion[]; costMicros: number }>;
  /** Relit chaque question contre son article : vrai si la bonne réponse est confirmée et la seule juste. */
  verify(items: { question: WeeklyQuestion; article: WeeklyArticle }[]): Promise<{ confirmed: boolean[]; costMicros: number }>;
  model: string;
}

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Les articles de presse publiés pendant les sept jours qui précèdent `now`, les mieux documentés d'abord. */
export async function weeklyArticles(q: Query, now: Date): Promise<WeeklyArticle[]> {
  const rows = await q<{ id: string; source_name: string; title: string; body: string; content: { essentiel?: string; points?: string[] } | null }>(
    `SELECT p.id, p.source_name, p.title, p.body, s.content
     FROM posts p LEFT JOIN post_syntheses s ON s.post_id = p.id AND s.status = 'ready'
     WHERE p.status = 'published' AND p.source_name IS NOT NULL
       AND p.created_at >= $1::timestamptz - interval '7 days' AND p.created_at <= $1::timestamptz
     ORDER BY (s.content IS NOT NULL) DESC, p.created_at DESC
     LIMIT $2`,
    [now.toISOString(), MAX_ARTICLES],
  );
  return rows.map((r) => {
    const excerpt = clean(r.body.split("\n\n———\n\n")[0], 1500);
    const synthesis = r.content ? clean([r.content.essentiel, ...(r.content.points ?? [])].filter(Boolean).join(" "), 1500) : "";
    return { postId: r.id, source: r.source_name, title: clean(r.title, 300), text: [excerpt, synthesis].filter(Boolean).join("\n") };
  }).filter((a) => a.text.length >= 200);
}

/** Contrôle de forme : une question par article au plus, quatre propositions distinctes, textes de taille raisonnable. */
export function checkDrafts(drafts: readonly DraftQuestion[], articles: readonly WeeklyArticle[]): WeeklyQuestion[] {
  const byId = new Map(articles.map((a) => [a.postId, a]));
  const used = new Set<string>();
  const kept: WeeklyQuestion[] = [];
  for (const d of drafts) {
    const article = byId.get(String(d?.postId ?? ""));
    if (!article || used.has(article.postId)) continue;
    const question = clean(d.question, 400);
    const good = clean(d.good, 160);
    const wrong = (Array.isArray(d.wrong) ? d.wrong : []).map((w) => clean(w, 160)).filter(Boolean);
    const explain = clean(d.explain, 500);
    if (question.length < 20 || !good || wrong.length !== 3 || explain.length < 20) continue;
    const choices = [good, ...wrong];
    if (new Set(choices.map((c) => c.toLowerCase())).size !== 4) continue;
    // Une adresse dans une question ou une réponse n'a rien à y faire (texte piégé dans un article).
    if ([question, explain, ...choices].some((t) => /https?:\/\/|www\./i.test(t))) continue;
    used.add(article.postId);
    kept.push({ postId: article.postId, source: article.source, question, choices, explain });
  }
  return kept;
}

export type EnsureOutcome = "ready" | "exists" | "busy" | "too-few-articles" | "exhausted" | "failed";

/**
 * Fabrique le quiz de la semaine de `now` s'il n'existe pas encore. Sans effet si un quiz est prêt,
 * si un essai est en cours ou trop récent, ou si la semaine a épuisé ses essais.
 */
export async function ensureWeeklyQuiz(deps: { q: Query; writer: QuizWriter; now: Date; day: string }): Promise<EnsureOutcome> {
  const { q, writer, now } = deps;
  const week = weekStart(deps.day);
  const [existing] = await q<{ status: string; attempts: number }>(`SELECT status, attempts FROM weekly_quiz WHERE week = $1::date`, [week]);
  if (existing?.status === "ready") return "exists";
  if (existing && existing.attempts >= MAX_ATTEMPTS) return "exhausted";

  const articles = await weeklyArticles(q, now);
  if (articles.length < MIN_ARTICLES) return "too-few-articles";

  // Réservation de l'essai : une seule fabrication à la fois, et pas de nouvelle tentative trop tôt.
  const reserved = await q(
    `INSERT INTO weekly_quiz (week, status, attempts, updated_at) VALUES ($1::date, 'pending', 1, $2::timestamptz)
     ON CONFLICT (week) DO UPDATE SET status = 'pending', attempts = weekly_quiz.attempts + 1, updated_at = $2::timestamptz
     WHERE weekly_quiz.status <> 'ready' AND weekly_quiz.attempts < $3
       AND weekly_quiz.updated_at <= $2::timestamptz - ($4::int * interval '1 millisecond')
     RETURNING attempts`,
    [week, now.toISOString(), MAX_ATTEMPTS, RETRY_AFTER_MS],
  );
  if (reserved.length === 0) return "busy";

  let cost = 0;
  const fail = async (error: string): Promise<EnsureOutcome> => {
    await q(`UPDATE weekly_quiz SET status = 'failed', error = $2, cost_micros = cost_micros + $3 WHERE week = $1::date`, [week, error.slice(0, 300), cost]);
    return "failed";
  };
  try {
    const written = await writer.write(articles, WEEKLY_SIZE);
    cost += written.costMicros;
    const checked = checkDrafts(written.drafts, articles);
    if (checked.length < MIN_QUESTIONS) return await fail(`seulement ${checked.length} questions bien formées`);

    const byId = new Map(articles.map((a) => [a.postId, a]));
    const verdict = await writer.verify(checked.map((question) => ({ question, article: byId.get(question.postId)! })));
    cost += verdict.costMicros;
    const confirmed = checked.filter((_, i) => verdict.confirmed[i] === true).slice(0, WEEKLY_SIZE);
    if (confirmed.length < MIN_QUESTIONS) return await fail(`seulement ${confirmed.length} questions confirmées à la relecture`);

    await q(
      `UPDATE weekly_quiz SET status = 'ready', questions = $2::jsonb, model = $3, error = NULL, cost_micros = cost_micros + $4 WHERE week = $1::date`,
      [week, JSON.stringify(confirmed), writer.model, cost],
    );
    return "ready";
  } catch (error) {
    return await fail((error as Error).message || "erreur inconnue");
  }
}

/**
 * Le quiz d'une semaine (lundi AAAA-MM-JJ), réduit aux questions dont l'article est toujours publié.
 * Nul s'il n'y a pas de quiz prêt, ou s'il reste trop peu de questions.
 */
export async function loadWeeklyQuiz(q: Query, week: string): Promise<WeeklyQuestion[] | null> {
  const [row] = await q<{ questions: WeeklyQuestion[] | null }>(`SELECT questions FROM weekly_quiz WHERE week = $1::date AND status = 'ready'`, [week]);
  if (!row?.questions?.length) return null;
  const live = await q<{ id: string }>(`SELECT id FROM posts WHERE id = ANY($1::uuid[]) AND status = 'published'`, [row.questions.map((x) => x.postId)]);
  const ids = new Set(live.map((r) => r.id));
  const kept = row.questions.filter((x) => ids.has(x.postId));
  return kept.length >= MIN_QUESTIONS - 1 ? kept : null;
}

/** La manche jouée : questions dans l'ordre, propositions mélangées par la graine (navigateur et serveur font le même tirage). */
export function weeklyRound(questions: readonly WeeklyQuestion[], seed: string): PlayableQuestion[] {
  const rnd = seededRandom(`hebdo-${seed}`);
  return questions.map((x) => {
    const order = shuffle(x.choices.map((_, i) => i), rnd);
    return {
      prompt: x.question,
      choices: order.map((i) => x.choices[i]),
      answer: order.indexOf(0),
      explain: x.explain,
      theme: "",
      link: { href: `/p/${x.postId}`, label: `Lire l’article (${x.source})` },
    };
  });
}

/** Score du quiz de la semaine déjà joué par ce membre, sinon nul. */
export async function weeklyResult(q: Query, userId: string, week: string): Promise<{ correct: number; total: number } | null> {
  const [row] = await q<{ correct: number; total: number }>(`SELECT correct, total FROM game_scores WHERE user_id = $1 AND game = 'hebdo' AND day = $2::date`, [userId, week]);
  return row ?? null;
}
