import "server-only";
import { activeContributor } from "../community-locks.ts";
import { query, queryOne, transaction, type QueryFn } from "../db";
import { blockedIdsFor } from "../social/blocks.ts";
import { notifyMentions } from "../social/mentions.ts";
import { notifyReply } from "../social/notifications.ts";
import { authorFrom, type Author } from "./posts";

export interface Comment {
  id: string;
  parentId: string | null;
  authorId: string;
  author: Author;
  body: string;
  isDeleted: boolean;
  /** Masqué pour CE lecteur parce qu'il a bloqué l'auteur (D31) ; le texte n'est pas servi. */
  isMasked: boolean;
  createdAt: string;
  editedAt: string | null;
  replies: Comment[];
}

interface CommentRow extends Record<string, unknown> {
  id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  status: string;
  created_at: Date | string;
  edited_at: Date | string | null;
  handle: string | null;
  display_name: string | null;
  role: string;
  author_status: string;
}

/**
 * Un seul niveau de réponses. Un commentaire supprimé qui a des réponses
 * reste en place sous la mention « Commentaire supprimé » pour que les
 * réponses restent lisibles ; sans réponse, il disparaît.
 */
export async function listComments(postId: string, viewerId: string | null = null): Promise<Comment[]> {
  const rows = await query<CommentRow>(
    `SELECT c.id, c.parent_id, c.author_id, c.body, c.status, c.created_at, c.edited_at,
            u.handle, u.display_name, u.role, u.status AS author_status, u.avatar_image_id
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.post_id = $1 ORDER BY c.created_at ASC, c.id ASC`,
    [postId],
  );
  const blocked = new Set(viewerId ? await blockedIdsFor(query, viewerId) : []);
  const byId = new Map<string, Comment>();
  const top: Comment[] = [];
  for (const row of rows) {
    const deleted = row.status !== "published";
    const masked = !deleted && blocked.has(row.author_id);
    const comment: Comment = {
      id: row.id,
      parentId: row.parent_id,
      authorId: row.author_id,
      author: authorFrom(row),
      body: deleted || masked ? "" : row.body,
      isDeleted: deleted,
      isMasked: masked,
      createdAt: new Date(row.created_at).toISOString(),
      editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
      replies: [],
    };
    byId.set(row.id, comment);
    if (!row.parent_id) top.push(comment);
    else byId.get(row.parent_id)?.replies.push(comment);
  }
  return top
    .map((c) => ({ ...c, replies: c.replies.filter((r) => !r.isDeleted) }))
    .filter((c) => !c.isDeleted || c.replies.length > 0);
}

export async function getComment(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return queryOne<{ id: string; post_id: string; author_id: string; parent_id: string | null; status: string; body: string }>(
    `SELECT id, post_id, author_id, parent_id, status, body FROM comments WHERE id = $1`,
    [id],
  );
}

/** `q` permet d'écrire dans la transaction de la limite de fréquence (lib/limits.ts). */
export async function createComment(
  postId: string,
  authorId: string,
  body: string,
  parentId: string | null,
  q: QueryFn = query,
): Promise<string | null> {
  if (!(await activeContributor(q, authorId))) return null;
  const [post] = await q(`SELECT id FROM posts WHERE id = $1 AND status = 'published'`, [postId]);
  if (!post) return null;
  const [row] = await q<{ id: string }>(
    `INSERT INTO comments (post_id, author_id, parent_id, body) VALUES ($1, $2, $3, $4) RETURNING id`,
    [postId, authorId, parentId, body],
  );
  // Notification de réponse (D29), dans la même transaction : auteur du commentaire
  // parent, sinon auteur de la publication. Jamais d'auto-notification.
  const [recipient] = parentId
    ? await q<{ author_id: string }>(`SELECT author_id FROM comments WHERE id = $1`, [parentId])
    : await q<{ author_id: string }>(`SELECT author_id FROM posts WHERE id = $1`, [postId]);
  if (recipient) await notifyReply(q, { recipientId: recipient.author_id, actorId: authorId, postId, commentId: row.id });
  // Mentions @pseudo : la personne déjà notifiée de la réponse n'est pas notifiée deux fois.
  await notifyMentions(q, { actorId: authorId, text: body, postId, commentId: row.id, exclude: recipient ? [recipient.author_id] : [] });
  return row.id;
}

export async function updateComment(id: string, body: string, authorId: string) {
  return transaction(async (q) => {
    if (!(await activeContributor(q, authorId))) return false;
    const rows = await q(`UPDATE comments SET body = $2, edited_at = now() WHERE id = $1 AND author_id = $3 AND status = 'published' RETURNING id`, [id, body, authorId]);
    return rows.length > 0;
  });
}

export async function deleteComment(id: string, authorId: string) {
  return transaction(async (q) => {
    if (!(await activeContributor(q, authorId))) return false;
    const rows = await q(`UPDATE comments SET status = 'deleted', deleted_at = now(), body = '' WHERE id = $1 AND author_id = $2 AND status = 'published' RETURNING id`, [id, authorId]);
    return rows.length > 0;
  });
}
