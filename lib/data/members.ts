import "server-only";
import { activeContributor } from "../community-locks.ts";
import { query, queryOne, transaction, type QueryFn } from "../db";
import { eraseAccount, type DeleteAccountResult } from "../social/account.ts";

export interface Member {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  isAgent: boolean;
  createdAt: string;
  followers: number;
  following: number;
  themes: { slug: string; name: string }[];
  headline: string;
  specialties: string[];
  links: string[];
  askMe: string;
  lookingFor: string;
  avatarId: string | null;
  bannerId: string | null;
  pinnedPostId: string | null;
}

export async function getMemberByHandle(handle: string): Promise<Member | null> {
  const row = await queryOne<{
    id: string;
    handle: string;
    display_name: string | null;
    bio: string;
    role: string;
    created_at: Date | string;
    followers: number;
    following: number;
    themes: { slug: string; name: string }[] | string;
    headline: string;
    specialties: string[];
    links: string[];
    ask_me: string;
    looking_for: string;
    avatar_image_id: string | null;
    banner_image_id: string | null;
    pinned_post_id: string | null;
  }>(
    `SELECT u.id, u.handle, u.display_name, u.bio, u.role, u.created_at,
            u.headline, u.specialties, u.links, u.ask_me, u.looking_for, u.avatar_image_id, u.banner_image_id, u.pinned_post_id,
            (SELECT count(*)::int FROM member_follows WHERE followee_id = u.id) AS followers,
            (SELECT count(*)::int FROM member_follows WHERE follower_id = u.id) AS following,
            COALESCE((SELECT json_agg(json_build_object('slug', t.slug, 'name', t.name) ORDER BY t.position)
                      FROM theme_follows tf JOIN themes t ON t.id = tf.theme_id WHERE tf.user_id = u.id AND t.active), '[]'::json) AS themes
     FROM users u
     WHERE lower(u.handle) = lower($1) AND u.status <> 'deleted' AND u.rules_accepted_at IS NOT NULL`,
    [handle],
  );
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name || row.handle,
    bio: row.bio,
    isAgent: row.role === "agent",
    createdAt: new Date(row.created_at).toISOString(),
    followers: row.followers,
    following: row.following,
    themes: typeof row.themes === "string" ? JSON.parse(row.themes) : row.themes,
    headline: row.headline ?? "",
    specialties: row.specialties ?? [],
    links: row.links ?? [],
    askMe: row.ask_me ?? "",
    lookingFor: row.looking_for ?? "",
    avatarId: row.avatar_image_id ?? null,
    bannerId: row.banner_image_id ?? null,
    pinnedPostId: row.pinned_post_id ?? null,
  };
}

export async function isFollowingMember(followerId: string, followeeId: string): Promise<boolean> {
  return Boolean(
    await queryOne(`SELECT 1 FROM member_follows WHERE follower_id = $1 AND followee_id = $2`, [followerId, followeeId]),
  );
}

export async function getOwnProfile(userId: string) {
  return queryOne<{
    handle: string; display_name: string; bio: string; email: string; headline: string; specialties: string[]; links: string[];
    ask_me: string; looking_for: string; avatar_image_id: string | null; banner_image_id: string | null;
  }>(
    `SELECT handle, display_name, bio, email, headline, specialties, links, ask_me, looking_for, avatar_image_id, banner_image_id
     FROM users WHERE id = $1`,
    [userId],
  );
}

export async function isHandleTaken(handle: string, exceptUserId?: string): Promise<boolean> {
  return Boolean(
    await queryOne(`SELECT 1 FROM users WHERE lower(handle) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid)`, [
      handle,
      exceptUserId ?? null,
    ]),
  );
}

export async function writeFollowedThemes(q: QueryFn, userId: string, themeIds: string[]) {
  await q(`DELETE FROM theme_follows WHERE user_id = $1`, [userId]);
  await q(`INSERT INTO theme_follows (user_id, theme_id) SELECT $1, id FROM themes WHERE id = ANY($2::uuid[]) AND active`, [userId, themeIds]);
}

export async function setFollowedThemes(userId: string, themeIds: string[]) {
  return transaction(async (q) => {
    if (!(await activeContributor(q, userId))) return false;
    await writeFollowedThemes(q, userId, themeIds);
    return true;
  });
}

/** Suppression du compte (F02) : effacement réel, détaillé et testé dans lib/social/account.ts. */
export type { DeleteAccountResult };

export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  return transaction((q) => eraseAccount(q, userId));
}

export async function findOrCreateUserByEmail(email: string): Promise<{ id: string; status: string }> {
  const existing = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  if (existing) return existing;
  const created = await queryOne<{ id: string; status: string }>(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO UPDATE SET email = users.email
     RETURNING id, status`,
    [email.trim()],
  );
  return created!;
}

export async function listMembersFollowedBy(userId: string): Promise<string[]> {
  const rows = await query<{ followee_id: string }>(`SELECT followee_id FROM member_follows WHERE follower_id = $1`, [userId]);
  return rows.map((r) => r.followee_id);
}
