import "server-only";
import { query } from "../db";

// Recherche (lot d'accélération D28 ; spec F06 partielle) : PostgreSQL seul, aucun
// moteur externe. Exclusions SYSTÉMATIQUES : publications non publiées, profils non
// actifs, salons privés (jamais de nom, d'extrait ni d'appartenance privée), auteurs
// bloqués par le lecteur.

const PAGE = 20;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface SearchPage<T> {
  items: T[];
  hasMore: boolean;
}

export interface SearchResults {
  query: string;
  posts: SearchPage<{ id: string; title: string; kind: string; createdAt: string; authorName: string }>;
  members: SearchPage<{ handle: string; displayName: string; bio: string }>;
  themes: SearchPage<{ slug: string; name: string }>;
  rooms: SearchPage<{ id: string; name: string; description: string; members: number }>;
}

async function page<T>(rows: T[]): Promise<SearchPage<T>> {
  return { items: rows.slice(0, PAGE), hasMore: rows.length > PAGE };
}

export async function searchAll(raw: string, viewerId: string | null, offsets: Partial<Record<"posts" | "members" | "themes" | "rooms", number>> = {}): Promise<SearchResults | null> {
  const text = raw.trim().slice(0, 100);
  if (text.length < 2) return null;
  const term = `%${escapeLike(text)}%`;
  const off = (k: keyof typeof offsets) => Math.max(0, Number(offsets[k] ?? 0)) * PAGE;

  const [posts, members, themes, rooms] = await Promise.all([
    query(
      `SELECT p.id, p.title, p.kind, p.created_at, COALESCE(u.display_name, 'Membre supprimé') AS author_name
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.status = 'published' AND (p.title ILIKE $1 OR p.body ILIKE $1)
         AND ($2::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = $2 AND ub.blocked_id = p.author_id))
       ORDER BY p.created_at DESC LIMIT ${PAGE + 1} OFFSET $3`,
      [term, viewerId, off("posts")],
    ),
    query(
      `SELECT u.handle, u.display_name, u.bio FROM users u
       WHERE u.status = 'active' AND u.handle IS NOT NULL AND (u.handle ILIKE $1 OR u.display_name ILIKE $1 OR u.bio ILIKE $1)
       ORDER BY u.created_at LIMIT ${PAGE + 1} OFFSET $2`,
      [term, off("members")],
    ),
    query(`SELECT slug, name FROM themes WHERE active AND name ILIKE $1 ORDER BY name LIMIT ${PAGE + 1} OFFSET $2`, [term, off("themes")]),
    query(
      `SELECT r.id, r.name, r.description, (SELECT count(*)::int FROM room_members m WHERE m.room_id = r.id) AS members
       FROM rooms r WHERE r.visibility = 'public' AND (r.name ILIKE $1 OR r.description ILIKE $1)
       ORDER BY r.created_at DESC LIMIT ${PAGE + 1} OFFSET $2`,
      [term, off("rooms")],
    ),
  ]);

  return {
    query: text,
    posts: await page(
      posts.map((p) => ({ id: p.id as string, title: p.title as string, kind: p.kind as string, createdAt: new Date(p.created_at as string).toISOString(), authorName: p.author_name as string })),
    ),
    members: await page(members.map((m) => ({ handle: m.handle as string, displayName: (m.display_name as string) ?? "", bio: (m.bio as string) ?? "" }))),
    themes: await page(themes.map((t) => ({ slug: t.slug as string, name: t.name as string }))),
    rooms: await page(
      rooms.map((r) => ({ id: r.id as string, name: r.name as string, description: (r.description as string) ?? "", members: Number(r.members) })),
    ),
  };
}
