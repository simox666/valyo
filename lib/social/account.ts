import { lockCommunity } from "../community-locks.ts";
import type { Query } from "../editorial/types.ts";
import { cleanupRoomsForDeletedAccount, ownedActiveRooms } from "../rooms/service.ts";

/**
 * Suppression du compte (F02, revue RGPD du 18 novembre 2026) : tout ce qui est
 * promis comme effacé l'est réellement, partout. Publications, commentaires et
 * messages de salon restent pour la continuité des discussions, attribués à
 * « Membre supprimé ». Les messages privés, eux, deviennent invisibles pour tout
 * le monde une fois le compte supprimé : les conserver n'aurait aucune finalité,
 * donc ils sont effacés. Les traces de modération (signalements, sanctions)
 * restent : elles protègent la communauté, y compris contre les récidives.
 */
export type DeleteAccountResult = { ok: true } | { ok: false; rooms: { id: string; name: string }[] };

export async function eraseAccount(q: Query, userId: string): Promise<DeleteAccountResult> {
  await lockCommunity(q, true);
  // D5 §4.1 : pas de suppression tant qu'un salon actif est possédé (transférer ou archiver d'abord).
  const owned = await ownedActiveRooms(q, userId);
  if (owned.length > 0) return { ok: false as const, rooms: owned };
  await cleanupRoomsForDeletedAccount(q, userId);
  const [me] = await q<{ email: string | null }>(`SELECT email FROM users WHERE id = $1`, [userId]);
  if (me?.email) await q(`DELETE FROM login_tokens WHERE lower(email) = lower($1)`, [me.email]);
  await q(`DELETE FROM conversations WHERE user_a = $1 OR user_b = $1`, [userId]);
  await q(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  await q(`DELETE FROM theme_follows WHERE user_id = $1`, [userId]);
  await q(`DELETE FROM member_follows WHERE follower_id = $1 OR followee_id = $1`, [userId]);
  await q(`DELETE FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1`, [userId]);
  await q(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
  await q(`DELETE FROM appeal_tokens WHERE user_id = $1`, [userId]);
  await q(`DELETE FROM user_activity_days WHERE user_id = $1`, [userId]);
  await q(`DELETE FROM game_scores WHERE user_id = $1`, [userId]);
  await q(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
  await q(`DELETE FROM editorial_dev_requests WHERE member_id = $1`, [userId]);
  await q(`UPDATE feedback SET user_id = NULL WHERE user_id = $1`, [userId]);
  await q(
    `UPDATE users SET email = NULL, handle = NULL, display_name = NULL, bio = '', headline = '', specialties = '{}', links = '{}',
       ask_me = '', looking_for = '', avatar_image_id = NULL, banner_image_id = NULL, status = 'deleted', deleted_at = now()
     WHERE id = $1`,
    [userId],
  );
  return { ok: true as const };
}
