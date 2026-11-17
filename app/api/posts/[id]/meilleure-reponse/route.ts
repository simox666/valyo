import { z } from "zod";
import { transaction } from "@/lib/db";
import { activeContributor } from "@/lib/community-locks.ts";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { notifyBestAnswer } from "@/lib/social/notifications.ts";

const bodySchema = z.object({ commentId: z.uuid().nullable() });
const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/**
 * L'auteur d'une QUESTION retient un commentaire comme meilleure réponse (ou la retire avec null).
 * Un seul choix à la fois ; jamais son propre commentaire ; l'auteur retenu est notifié.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!isId(id)) return fail("Publication introuvable.", 404);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Demande invalide.", 400);
  const { commentId } = parsed.data;

  const outcome = await transaction(async (q) => {
    if (!(await activeContributor(q, guard.user.id))) return "forbidden";
    const [post] = await q<{ author_id: string; kind: string }>(
      `SELECT author_id, kind FROM posts WHERE id = $1 AND status = 'published' FOR UPDATE`,
      [id],
    );
    if (!post) return "not-found";
    if (post.author_id !== guard.user.id) return "not-author";
    if (post.kind !== "question") return "not-question";
    if (commentId) {
      const [comment] = await q<{ author_id: string }>(
        `SELECT author_id FROM comments WHERE id = $1 AND post_id = $2 AND status = 'published'`,
        [commentId, id],
      );
      if (!comment) return "no-comment";
      if (comment.author_id === guard.user.id) return "own-comment";
      await q(`UPDATE posts SET best_comment_id = $2 WHERE id = $1`, [id, commentId]);
      await notifyBestAnswer(q, { recipientId: comment.author_id, actorId: guard.user.id, postId: id, commentId });
    } else {
      await q(`UPDATE posts SET best_comment_id = NULL WHERE id = $1`, [id]);
    }
    return "ok";
  });

  if (outcome === "forbidden") return fail("Ce compte ne peut pas faire cette action pour le moment.", 403);
  if (outcome === "not-found") return fail("Publication indisponible.", 404);
  if (outcome === "not-author") return fail("Seul l’auteur de la question choisit la meilleure réponse.", 403);
  if (outcome === "not-question") return fail("Cette publication n’est pas une question.", 400);
  if (outcome === "no-comment") return fail("Ce commentaire n’existe pas sous cette question.", 404);
  if (outcome === "own-comment") return fail("Votre propre commentaire ne peut pas être la meilleure réponse.", 400);
  return json({ ok: true, bestCommentId: commentId });
}
