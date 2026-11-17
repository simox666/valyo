import "server-only";
import { activeContributor } from "../community-locks.ts";
import { query, queryOne, transaction, type QueryFn } from "../db";
import { normalizeUrl } from "../urls";
import type { PostInput, PostKind } from "../validation";
import { attachImages, type PostImage } from "../media";
import { notifyMentions } from "../social/mentions.ts";
import { purgeSynthesis } from "../actus/synthesis.ts";

export interface Author {
  handle: string | null;
  displayName: string;
  isAgent: boolean;
  isDeleted: boolean;
  avatarId: string | null;
}

export interface Post {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  demoUrl: string | null;
  status: "published" | "pending" | "removed" | "deleted";
  createdAt: string;
  editedAt: string | null;
  authorId: string;
  author: Author;
  themes: { id: string; slug: string; name: string }[];
  sources: string[];
  commentCount: number;
  /** Actus importées : image d'illustration et nom de la source (ex. « NASA »). */
  imageUrl: string | null;
  sourceName: string | null;
  /** Photos jointes par l'auteur (servies par /media/id). */
  images: PostImage[];
  /** Question : commentaire retenu comme meilleure réponse par l'auteur. */
  bestCommentId: string | null;
}

interface PostRow extends Record<string, unknown> {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  demo_url: string | null;
  status: Post["status"];
  created_at: Date | string;
  edited_at: Date | string | null;
  author_id: string;
  handle: string | null;
  display_name: string | null;
  role: string;
  author_status: string;
  themes: Post["themes"] | string;
  sources: string[] | string;
  comment_count: number;
  image_url: string | null;
  source_name: string | null;
  images: PostImage[] | string;
}

const iso = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());
const parseJson = <T>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v);

export function authorFrom(row: { handle: string | null; display_name: string | null; role: string; author_status: string; avatar_image_id?: string | null }): Author {
  const isDeleted = row.author_status === "deleted";
  return {
    avatarId: isDeleted ? null : row.avatar_image_id ?? null,
    handle: isDeleted ? null : row.handle,
    displayName: isDeleted ? "Membre supprimé" : row.display_name || row.handle || "Membre",
    isAgent: row.role === "agent",
    isDeleted,
  };
}

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    demoUrl: row.demo_url,
    status: row.status,
    createdAt: iso(row.created_at)!,
    editedAt: iso(row.edited_at),
    authorId: row.author_id,
    author: authorFrom(row),
    themes: parseJson(row.themes),
    sources: parseJson(row.sources),
    commentCount: row.comment_count,
    imageUrl: row.image_url ?? null,
    sourceName: row.source_name ?? null,
    images: parseJson(row.images ?? "[]"),
    bestCommentId: (row.best_comment_id as string | null) ?? null,
  };
}

const SELECT_POST = `
  SELECT p.id, p.kind, p.title, p.body, p.demo_url, p.status, p.created_at, p.edited_at, p.author_id, p.image_url, p.source_name, p.best_comment_id,
         u.handle, u.display_name, u.role, u.status AS author_status, u.avatar_image_id,
         COALESCE((SELECT json_agg(json_build_object('id', t.id, 'slug', t.slug, 'name', t.name) ORDER BY t.position)
                   FROM post_themes pt JOIN themes t ON t.id = pt.theme_id WHERE pt.post_id = p.id), '[]'::json) AS themes,
         COALESCE((SELECT json_agg(ps.url ORDER BY ps.position) FROM post_sources ps WHERE ps.post_id = p.id), '[]'::json) AS sources,
         (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.status = 'published') AS comment_count,
         COALESCE((SELECT json_agg(json_build_object('id', pi.id, 'width', pi.width, 'height', pi.height) ORDER BY pi.position)
                   FROM post_images pi WHERE pi.post_id = p.id), '[]'::json) AS images
  FROM posts p JOIN users u ON u.id = p.author_id`;

export const FEED_PAGE = 20;

export interface FeedOptions {
  view: "recent" | "foryou";
  viewerId?: string | null;
  themeId?: string | null;
  authorId?: string | null;
  /** Liste « À creuser » de ce membre : publications marquées de la loupe, la plus récemment marquée d'abord. */
  diggerId?: string | null;
  limit: number;
}

/**
 * « Les plus récentes » : tout le fil, ordre strict de publication.
 * « Pour vous » : UNIQUEMENT les publications des thèmes suivis, des membres suivis (y compris
 * celles qu'ils RELAIENT) et les siennes ; jour par jour, celles où le plus de membres distincts
 * ont échangé, puis la date.
 * Sans aucun suivi, « Pour vous » revient au fil complet : jamais d'écran vide faute de choix.
 */
export async function listFeed(opts: FeedOptions): Promise<{ posts: Post[]; hasMore: boolean }> {
  const params: unknown[] = [];
  const where = [`p.status = 'published'`];
  // Blocage (D31) : les publications des auteurs bloqués par le lecteur sont masquées du fil.
  if (opts.viewerId) {
    params.push(opts.viewerId);
    where.push(`NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = $${params.length} AND ub.blocked_id = p.author_id)`);
  }
  if (opts.themeId) {
    params.push(opts.themeId);
    where.push(`EXISTS (SELECT 1 FROM post_themes ptf WHERE ptf.post_id = p.id AND ptf.theme_id = $${params.length})`);
  }
  if (opts.authorId) {
    params.push(opts.authorId);
    where.push(`p.author_id = $${params.length}`);
  }
  let order = `p.created_at DESC, p.id DESC`;
  if (opts.view === "foryou" && opts.viewerId) {
    params.push(opts.viewerId);
    const v = `$${params.length}`;
    where.push(`(
      (NOT EXISTS (SELECT 1 FROM theme_follows tf0 WHERE tf0.user_id = ${v})
       AND NOT EXISTS (SELECT 1 FROM member_follows mf0 WHERE mf0.follower_id = ${v}))
      OR EXISTS (SELECT 1 FROM post_themes pt JOIN theme_follows tf ON tf.theme_id = pt.theme_id AND tf.user_id = ${v} WHERE pt.post_id = p.id)
      OR EXISTS (SELECT 1 FROM member_follows mf WHERE mf.follower_id = ${v} AND mf.followee_id = p.author_id)
      OR EXISTS (SELECT 1 FROM post_relays pr JOIN member_follows mfr ON mfr.followee_id = pr.user_id AND mfr.follower_id = ${v} WHERE pr.post_id = p.id)
      OR p.author_id = ${v}
    )`);
    order = `
      date_trunc('day', p.created_at) DESC,
      (SELECT count(DISTINCT c.author_id) FROM comments c WHERE c.post_id = p.id AND c.status = 'published') DESC,
      p.created_at DESC, p.id DESC`;
  }
  if (opts.diggerId) {
    params.push(opts.diggerId);
    const d = `$${params.length}`;
    where.push(`EXISTS (SELECT 1 FROM post_reactions dig WHERE dig.post_id = p.id AND dig.user_id = ${d} AND dig.kind = 'a_creuser')`);
    order = `(SELECT dig.created_at FROM post_reactions dig WHERE dig.post_id = p.id AND dig.user_id = ${d} AND dig.kind = 'a_creuser') DESC, p.id DESC`;
  }
  params.push(opts.limit + 1);
  const rows = await query<PostRow>(
    `${SELECT_POST} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT $${params.length}`,
    params,
  );
  return { posts: rows.slice(0, opts.limit).map(toPost), hasMore: rows.length > opts.limit };
}

export async function getPost(id: string): Promise<Post | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await queryOne<PostRow>(`${SELECT_POST} WHERE p.id = $1`, [id]);
  return row ? toPost(row) : null;
}

export interface DuplicateMatch {
  id: string;
  title: string;
}

/** Publications visibles qui citent déjà l'une de ces adresses (forme normalisée). */
export async function findDuplicates(urls: string[], excludePostId?: string): Promise<DuplicateMatch[]> {
  const normalized = urls.map(normalizeUrl).filter((u): u is string => Boolean(u));
  if (normalized.length === 0) return [];
  return query<DuplicateMatch & Record<string, unknown>>(
    `SELECT DISTINCT p.id, p.title, p.created_at FROM post_sources ps JOIN posts p ON p.id = ps.post_id
     WHERE ps.normalized_url = ANY($1::text[]) AND p.status = 'published' AND ($2::uuid IS NULL OR p.id <> $2::uuid)
     ORDER BY p.created_at ASC LIMIT 5`,
    [normalized, excludePostId ?? null],
  );
}

async function writeSourcesAndThemes(q: QueryFn, postId: string, input: PostInput) {
  await q(`DELETE FROM post_sources WHERE post_id = $1`, [postId]);
  await q(`DELETE FROM post_themes WHERE post_id = $1`, [postId]);
  const seen = new Set<string>();
  let position = 0;
  for (const url of input.sources) {
    const normalized = normalizeUrl(url)!;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    await q(`INSERT INTO post_sources (post_id, position, url, normalized_url) VALUES ($1, $2, $3, $4)`, [
      postId, position++, url.trim(), normalized,
    ]);
  }
  await q(
    `INSERT INTO post_themes (post_id, theme_id) SELECT $1, id FROM themes WHERE id = ANY($2::uuid[]) AND active`,
    [postId, input.themeIds],
  );
}

export async function validThemeCount(themeIds: string[]): Promise<number> {
  const row = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM themes WHERE id = ANY($1::uuid[]) AND active`, [themeIds]);
  return row?.n ?? 0;
}

/** À appeler dans une transaction : celle de la limite de fréquence (lib/limits.ts). */
export async function insertPost(q: QueryFn, authorId: string, input: PostInput): Promise<string | null> {
  if (!(await activeContributor(q, authorId))) return null;
  const [row] = await q<{ id: string }>(
    `INSERT INTO posts (author_id, kind, title, body, demo_url) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [authorId, input.kind, input.title, input.body, input.demoUrl || null],
  );
  await writeSourcesAndThemes(q, row.id, input);
  await attachImages(q, row.id, authorId, input.imageIds ?? []);
  await notifyMentions(q, { actorId: authorId, text: `${input.title}\n${input.body}`, postId: row.id });
  return row.id;
}

/** Modification par l'auteur. « Modifié » n'apparaît que si le titre, le texte ou les sources changent. */
export async function updatePost(post: Post, input: PostInput): Promise<boolean> {
  const significant =
    post.title !== input.title ||
    post.body !== input.body ||
    JSON.stringify(post.sources) !== JSON.stringify(input.sources.map((s) => s.trim()));
  return transaction(async (q) => {
    if (!(await activeContributor(q, post.authorId))) return false;
    const rows = await q(
      `UPDATE posts SET title = $2, body = $3, demo_url = $4, edited_at = CASE WHEN $5 THEN now() ELSE edited_at END
       WHERE id = $1 AND status = 'published' RETURNING id`,
      [post.id, input.title, input.body, input.demoUrl || null, significant],
    );
    if (!rows.length) return false;
    await writeSourcesAndThemes(q, post.id, input);
    return true;
  });
}

/** Le contenu est effacé, la page affiche ensuite un état indisponible. */
export async function deletePost(postId: string, authorId: string): Promise<boolean> {
  return transaction(async (q) => {
    if (!(await activeContributor(q, authorId))) return false;
    const rows = await q(
      `UPDATE posts SET status = 'deleted', deleted_at = now(), title = '', body = '', demo_url = NULL
       WHERE id = $1 AND author_id = $2 AND status = 'published' RETURNING id`, [postId, authorId],
    );
    if (!rows.length) return false;
    await q(`DELETE FROM post_sources WHERE post_id = $1`, [postId]);
    // SEC-04 : la synthèse IA est un contenu dérivé, elle disparaît avec la publication.
    await purgeSynthesis(q, postId);
    return true;
  });
}
