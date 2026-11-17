import { z } from "zod";
import { transaction } from "@/lib/db";
import { logRevision } from "@/lib/editorial/config.ts";
import { fail, json, readJson, requireAdmin } from "@/lib/http";
import { parseHttpUrl } from "@/lib/urls";

// Création d'une source : toujours inactive. L'activation exige un contrôle
// d'autorisation daté et sa référence (contrat §3, decisions.md §3.1).

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  feedUrl: z.string().trim().refine((u) => parseHttpUrl(u) !== null, "URL de flux invalide (https://…)."),
  sourceType: z.enum(["primary", "scientific", "press"]),
  priority: z.number().int().min(1).max(3),
  themeIds: z.array(z.uuid()).max(10).default([]),
  fetchArticles: z.boolean().default(true),
});

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Requête invalide.", 400);
  const s = parsed.data;
  try {
    const id = await transaction(async (q) => {
      const [row] = await q<{ id: string }>(
        `INSERT INTO editorial_sources (name, feed_url, source_type, priority, theme_ids, fetch_articles) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [s.name, s.feedUrl, s.sourceType, s.priority, s.themeIds, s.fetchArticles],
      );
      await logRevision(q, { entity: "source", entityId: row.id, after: s, reason: "Source ajoutée (inactive)", actorId: guard.user.id, actorLabel: guard.user.handle ?? "administrateur" });
      return row.id;
    });
    return json({ id }, 201);
  } catch {
    return fail("Ce flux est déjà enregistré.", 409);
  }
}
