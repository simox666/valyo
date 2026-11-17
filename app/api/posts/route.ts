import { transaction } from "@/lib/db";
import { findDuplicates, insertPost, validThemeCount } from "@/lib/data/posts";
import { fail, json, readJson, requireContributor } from "@/lib/http";
import { limitMessage, runLimited } from "@/lib/limits";
import { fieldErrors, postSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const { user } = guard;

  const parsed = postSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Vérifiez les champs indiqués.", 400, { fields: fieldErrors(parsed.error) });
  const input = parsed.data;

  if ((await validThemeCount(input.themeIds)) !== new Set(input.themeIds).size) {
    return fail("Thème inconnu.", 400, { fields: { themeIds: "Choisissez des thèmes dans la liste." } });
  }
  if (input.kind === "news" && !input.allowDuplicate) {
    const duplicates = await findDuplicates(input.sources);
    if (duplicates.length > 0) {
      return fail("Cette source a déjà été partagée.", 409, { duplicates });
    }
  }

  // Comptage et insertion dans la même transaction, sous verrou par membre (A002).
  const limited = await runLimited(transaction, "post", user.id, (q) => insertPost(q, user.id, input));
  if (!limited.ok) return fail(limitMessage("post", limited.rule), 429);
  if (!limited.value) return fail("Cette contribution n’est plus autorisée. Rechargez la page.", 403);
  return json({ id: limited.value }, 201);
}
