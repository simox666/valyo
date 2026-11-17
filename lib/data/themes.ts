import "server-only";
import { query, queryOne } from "../db";

export interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export async function listActiveThemes(): Promise<Theme[]> {
  return query<Theme & Record<string, unknown>>(
    `SELECT id, slug, name, description FROM themes WHERE active ORDER BY position, name`,
  );
}

export async function getThemeBySlug(slug: string): Promise<Theme | null> {
  return queryOne<Theme & Record<string, unknown>>(
    `SELECT id, slug, name, description FROM themes WHERE slug = $1 AND active`,
    [slug],
  );
}

export async function followedThemeIds(userId: string): Promise<string[]> {
  const rows = await query<{ theme_id: string }>(`SELECT theme_id FROM theme_follows WHERE user_id = $1`, [userId]);
  return rows.map((r) => r.theme_id);
}
