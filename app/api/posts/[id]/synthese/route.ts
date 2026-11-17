import { db } from "@/lib/db";
import { fail, json, requireContributor } from "@/lib/http";
import { createClaudeSummarizer, estimatedCostMicros } from "@/lib/actus/claude-summarizer.ts";
import { developPost, getSyntheses } from "@/lib/actus/synthesis.ts";
import { createHttpTransport } from "@/lib/editorial/fetch.ts";

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/** État de la synthèse d'une publication (lecture publique) ; 404 si la publication est retirée (SEC-04). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isId(id)) return fail("Publication introuvable.", 404);
  const [published] = await db.query(`SELECT 1 FROM posts WHERE id = $1 AND status = 'published'`, [id]);
  if (!published) return fail("Publication indisponible.", 404);
  const state = (await getSyntheses(db.query, [id])).get(id) ?? { status: "none" };
  return json(state);
}

/** « Développer » : génère la synthèse IA de l'article source si elle n'existe pas encore. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!isId(id)) return fail("Publication introuvable.", 404);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("La synthèse IA n’est pas encore activée sur Valyo.", 503);
  const outcome = await developPost({
    db,
    transport: createHttpTransport(),
    summarize: createClaudeSummarizer({ apiKey, model: process.env.VALYO_SYNTHESE_MODELE }),
    estimateMicros: estimatedCostMicros(process.env.VALYO_SYNTHESE_MODELE),
    userId: guard.user.id,
    postId: id,
  });
  return outcome.ok ? json(outcome.state) : fail(outcome.message, outcome.status);
}
