import { deletePost, findDuplicates, getPost, updatePost, validThemeCount } from "@/lib/data/posts";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { fieldErrors, postSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

async function loadOwnPost(request: Request, context: Context) {
  const guard = await requireContributor(request);
  if (guard.response) return { response: guard.response };
  const post = await getPost((await context.params).id);
  if (!post || post.status === "deleted" || post.status === "removed") return { response: fail("Publication introuvable.", 404) };
  // Contrôle côté serveur : masquer le bouton ne suffit pas.
  if (post.authorId !== guard.user.id) return { response: fail("Vous ne pouvez modifier que vos propres publications.", 403) };
  return { post };
}

export async function PATCH(request: Request, context: Context) {
  const { post, response } = await loadOwnPost(request, context);
  if (response) return response;

  const raw = (await readJson(request)) as Record<string, unknown> | null;
  // Le type est fixé à la création.
  const parsed = postSchema.safeParse({ ...raw, kind: post.kind });
  if (!parsed.success) return fail("Vérifiez les champs indiqués.", 400, { fields: fieldErrors(parsed.error) });
  if ((await validThemeCount(parsed.data.themeIds)) !== new Set(parsed.data.themeIds).size) {
    return fail("Thème inconnu.", 400, { fields: { themeIds: "Choisissez des thèmes dans la liste." } });
  }
  if (post.kind === "news" && !parsed.data.allowDuplicate) {
    const added = parsed.data.sources.filter((s) => !post.sources.includes(s.trim()));
    const duplicates = await findDuplicates(added, post.id);
    if (duplicates.length > 0) return fail("Cette source a déjà été partagée.", 409, { duplicates });
  }

  if (!(await updatePost(post, parsed.data))) return fail("Modification non autorisée.", 403);
  return json({ id: post.id });
}

export async function DELETE(request: Request, context: Context) {
  const { post, response } = await loadOwnPost(request, context);
  if (response) return response;
  if (!(await deletePost(post.id, post.authorId))) return fail("Suppression non autorisée.", 403);
  return json({ ok: true });
}
