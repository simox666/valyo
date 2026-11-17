import type { Query } from "../editorial/types.ts";

// Mentions @pseudo dans les publications, commentaires et messages de salon.
// La personne citée reçoit une notification « mention ». Règles :
// - jamais d'auto-notification, jamais vers un compte inactif ou qui a bloqué l'auteur ;
// - dans un salon : seuls les MEMBRES du salon sont notifiés (rien ne fuit d'un salon privé,
//   et on ne peut pas y héler quelqu'un qui n'y est pas) ;
// - au plus 8 mentions par texte (anti-spam).

export const MENTION_RE = /(^|[^\w@/])@([a-z0-9_]{3,24})\b/g;
const MAX_MENTIONS = 8;

/** Pseudos mentionnés dans un texte, en minuscules, sans doublon. */
export function extractMentions(text: string): string[] {
  const found: string[] = [];
  for (const m of text.toLowerCase().matchAll(MENTION_RE)) {
    if (!found.includes(m[2])) found.push(m[2]);
    if (found.length >= MAX_MENTIONS) break;
  }
  return found;
}

export interface MentionContext {
  actorId: string;
  text: string;
  postId?: string | null;
  commentId?: string | null;
  roomId?: string | null;
  /** Déjà notifiés autrement (ex. notification de réponse) : pas de doublon. */
  exclude?: string[];
}

/** Notifie les membres mentionnés. À appeler dans la transaction d'écriture du contenu. */
export async function notifyMentions(q: Query, ctx: MentionContext): Promise<number> {
  const handles = extractMentions(ctx.text);
  if (!handles.length) return 0;
  const recipients = await q<{ id: string }>(
    `SELECT u.id FROM users u
     WHERE u.handle = ANY($1::text[]) AND u.status = 'active' AND u.id <> $2
       AND u.id <> ALL($3::uuid[])
       AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = u.id AND b.blocked_id = $2)
       AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = $4 AND m.user_id = u.id))`,
    [handles, ctx.actorId, ctx.exclude ?? [], ctx.roomId ?? null],
  );
  for (const r of recipients) {
    await q(`INSERT INTO notifications (user_id, kind, post_id, comment_id, room_id, actor_id) VALUES ($1, 'mention', $2, $3, $4, $5)`, [
      r.id,
      ctx.postId ?? null,
      ctx.commentId ?? null,
      ctx.roomId ?? null,
      ctx.actorId,
    ]);
  }
  return recipients.length;
}
