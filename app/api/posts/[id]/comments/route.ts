import { transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createComment, getComment, listComments, type Comment } from "@/lib/data/comments";
import { getPost } from "@/lib/data/posts";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { limitMessage, runLimited } from "@/lib/limits";
import { commentSchema, fieldErrors } from "@/lib/validation";

// Forme envoyée au fil (commentaires dépliés sous une carte) : rien de masqué ni de supprimé n'est servi.
function view(c: Comment): unknown {
  return {
    id: c.id,
    author: { handle: c.author.handle, displayName: c.author.displayName, avatarId: c.author.avatarId, isAgent: c.author.isAgent, isDeleted: c.author.isDeleted },
    body: c.isDeleted || c.isMasked ? null : c.body,
    state: c.isDeleted ? "deleted" : c.isMasked ? "masked" : "ok",
    createdAt: c.createdAt,
    replies: c.replies.map(view),
  };
}

/** Commentaires d'une publication, pour les lire et répondre directement depuis le fil. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const post = await getPost((await context.params).id);
  if (!post || post.status !== "published") return fail("Cette publication n'est plus disponible.", 404);
  const user = await getCurrentUser();
  const comments = await listComments(post.id, user?.id ?? null);
  return json({ comments: comments.map(view) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;

  const post = await getPost((await context.params).id);
  if (!post || post.status !== "published") return fail("Cette publication n'est plus disponible.", 404);

  const parsed = commentSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Vérifiez votre commentaire.", 400, { fields: fieldErrors(parsed.error) });

  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await getComment(parsed.data.parentId);
    if (!parent || parent.post_id !== post.id || parent.status !== "published") {
      return fail("Le commentaire auquel vous répondez n'est plus disponible.", 404);
    }
    // Un seul niveau d'imbrication : répondre à une réponse rattache au commentaire d'origine.
    parentId = parent.parent_id ?? parent.id;
  }
  // Comptage et insertion dans la même transaction, sous verrou par membre (A002).
  const limited = await runLimited(transaction, "comment", guard.user.id, (q) =>
    createComment(post.id, guard.user.id, parsed.data.body, parentId, q),
  );
  if (!limited.ok) return fail(limitMessage("comment", limited.rule), 429);
  if (!limited.value) return fail("Cette contribution n’est plus autorisée. Rechargez la page.", 403);
  return json({ id: limited.value }, 201);
}
