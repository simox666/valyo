import type { MetadataRoute } from "next";
import { query } from "@/lib/db";

// Plan du site (audit SEO du 17 novembre) : pages stables, thèmes, publications publiées,
// profils publics et salons publics non archivés. Jamais de contenu privé.

export const dynamic = "force-dynamic";

const CAP = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "https://www.valyo.si";
  const at = (path: string, date?: Date | string | null) => ({
    url: `${base}${path}`,
    ...(date ? { lastModified: new Date(date) } : {}),
  });
  const [themes, posts, members, rooms] = await Promise.all([
    query<{ slug: string }>(`SELECT slug FROM themes WHERE active ORDER BY position`),
    query<{ id: string; d: Date }>(
      `SELECT id, COALESCE(edited_at, created_at) AS d FROM posts WHERE status = 'published' ORDER BY created_at DESC LIMIT $1`,
      [CAP],
    ),
    query<{ handle: string }>(
      `SELECT handle FROM users WHERE status = 'active' AND handle IS NOT NULL AND rules_accepted_at IS NOT NULL ORDER BY created_at LIMIT $1`,
      [CAP],
    ),
    query<{ id: string }>(
      `SELECT id FROM rooms WHERE visibility = 'public' AND archived_at IS NULL ORDER BY created_at DESC LIMIT $1`,
      [CAP],
    ),
  ]);
  return [
    at("/"),
    at("/salons"),
    at("/recap"),
    at("/regles"),
    at("/confidentialite"),
    ...themes.map((t) => at(`/theme/${t.slug}`)),
    ...posts.map((p) => at(`/p/${p.id}`, p.d)),
    ...members.map((m) => at(`/m/${m.handle}`)),
    ...rooms.map((r) => at(`/s/${r.id}`)),
  ];
}
