import { activeContributor } from "@/lib/community-locks.ts";
import { z } from "zod";
import { transaction } from "@/lib/db";
import { fail, json, readJson, requireContributor } from "@/lib/http";

const bodySchema = z.object({
  target: z.enum(["member", "theme"]),
  key: z.string().min(1).max(64),
  follow: z.boolean(),
});

export async function POST(request: Request) {
  const guard = await requireContributor(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Requête invalide.", 400);
  const { target, key, follow } = parsed.data;
  const userId = guard.user.id;

  return transaction(async (query) => {
  if (!(await activeContributor(query, userId))) return fail("Ce compte ne peut plus modifier ses suivis.", 403);
  if (target === "member") {
    const [member] = await query<{ id: string }>(`SELECT id FROM users WHERE lower(handle) = lower($1) AND status <> 'deleted' AND rules_accepted_at IS NOT NULL`, [key]);
    if (!member) return fail("Membre introuvable.", 404);
    if (member.id === userId) return fail("Vous ne pouvez pas vous suivre vous-même.", 400);
    if (follow) {
      await query(`INSERT INTO member_follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, member.id]);
    } else {
      await query(`DELETE FROM member_follows WHERE follower_id = $1 AND followee_id = $2`, [userId, member.id]);
    }
  } else {
    const [theme] = await query<{ id: string }>(`SELECT id FROM themes WHERE slug = $1 AND active`, [key]);
    if (!theme) return fail("Thème introuvable.", 404);
    if (follow) {
      await query(`INSERT INTO theme_follows (user_id, theme_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, theme.id]);
    } else {
      await query(`DELETE FROM theme_follows WHERE user_id = $1 AND theme_id = $2`, [userId, theme.id]);
    }
  }
  return json({ ok: true, following: follow });
  });
}
