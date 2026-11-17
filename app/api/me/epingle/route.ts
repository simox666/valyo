import { z } from "zod";
import { transaction } from "@/lib/db";
import { activeContributor } from "@/lib/community-locks.ts";
import { fail, json, readJson, requireContributor } from "@/lib/http";

const bodySchema = z.object({ postId: z.uuid().nullable() });

/** Épingler une de ses publications en tête de son profil (ou désépingler avec null). */
export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Demande invalide.", 400);
  const { postId } = parsed.data;
  const outcome = await transaction(async (q) => {
    if (!(await activeContributor(q, guard.user.id))) return "forbidden";
    if (postId) {
      const [own] = await q(`SELECT 1 FROM posts WHERE id = $1 AND author_id = $2 AND status = 'published'`, [postId, guard.user.id]);
      if (!own) return "not-own";
    }
    await q(`UPDATE users SET pinned_post_id = $2 WHERE id = $1`, [guard.user.id, postId]);
    return "ok";
  });
  if (outcome === "forbidden") return fail("Modification non autorisée.", 403);
  if (outcome === "not-own") return fail("Vous ne pouvez épingler que vos propres publications.", 403);
  return json({ ok: true, pinnedPostId: postId });
}
