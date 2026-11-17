import { deleteComment, getComment, updateComment } from "@/lib/data/comments";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { commentEditSchema, fieldErrors } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

async function loadOwnComment(request: Request, context: Context) {
  const guard = await requireContributor(request);
  if (guard.response) return { response: guard.response };
  const comment = await getComment((await context.params).id);
  if (!comment || comment.status !== "published") return { response: fail("Commentaire introuvable.", 404) };
  if (comment.author_id !== guard.user.id) return { response: fail("Vous ne pouvez modifier que vos propres commentaires.", 403) };
  return { comment };
}

export async function PATCH(request: Request, context: Context) {
  const { comment, response } = await loadOwnComment(request, context);
  if (response) return response;
  const parsed = commentEditSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Vérifiez votre commentaire.", 400, { fields: fieldErrors(parsed.error) });
  if (!(await updateComment(comment.id, parsed.data.body, comment.author_id))) return fail("Modification non autorisée.", 403);
  return json({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  const { comment, response } = await loadOwnComment(request, context);
  if (response) return response;
  if (!(await deleteComment(comment.id, comment.author_id))) return fail("Suppression non autorisée.", 403);
  return json({ ok: true });
}
