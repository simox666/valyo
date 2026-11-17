import type { Query } from "../editorial/types.ts";

// « Premiers pas » des nouveaux membres (choix du porteur, 14 novembre 2026).
// But : qu'un nouveau membre échange avec un autre humain dans ses 7 premiers jours
// (indicateur « reliés et revenus », decisions.md §5). Trois leviers, à partir de
// données RÉELLES uniquement — jamais de contenu, de membre ou d'activité inventés :
//   1. des salons publics actifs à rejoindre ;
//   2. des questions récentes qui attendent une réponse ;
//   3. des membres actifs à suivre.
// Les thèmes choisis à l'inscription passent en tête, sans exclure le reste.
// Exclusions systématiques : soi-même, l'agent éditorial, les comptes non actifs ou non
// inscrits, les blocages dans les DEUX sens, les salons privés, archivés ou dont le
// membre est exclu/banni, ce qu'il suit ou a déjà rejoint.

const FRESH_DAYS = 14;

export interface SuggestedRoom {
  id: string;
  name: string;
  description: string;
  themeName: string | null;
  members: number;
  recentMessages: number;
  matchesTheme: boolean;
}

export interface SuggestedQuestion {
  id: string;
  title: string;
  authorName: string;
  createdAt: string;
  replies: number;
  themeNames: string[];
  matchesTheme: boolean;
}

export interface SuggestedMember {
  handle: string;
  displayName: string;
  avatarId: string | null;
  bio: string;
  contributions: number;
  sharedThemes: string[];
}

export interface FirstSteps {
  themeNames: string[];
  rooms: SuggestedRoom[];
  questions: SuggestedQuestion[];
  members: SuggestedMember[];
  /** Déjà relié : a commenté, rejoint un salon ou suit un membre. Sert à la carte d'accueil. */
  progress: { joinedRoom: boolean; repliedOrPosted: boolean; followsMember: boolean };
}

/** Blocage dans un sens ou l'autre entre le lecteur ($1) et un autre compte. */
const notBlocked = (other: string) =>
  `NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = ${other}) OR (b.blocker_id = ${other} AND b.blocked_id = $1))`;

export async function suggestedRooms(q: Query, userId: string, limit = 4): Promise<SuggestedRoom[]> {
  const rows = await q(
    `SELECT r.id, r.name, r.description, t.name AS theme_name,
            (SELECT count(*)::int FROM room_members m WHERE m.room_id = r.id) AS members,
            (SELECT count(*)::int FROM room_messages msg WHERE msg.room_id = r.id AND msg.deleted_at IS NULL
               AND msg.created_at > now() - interval '7 days') AS recent_messages,
            (r.theme_id IS NOT NULL AND EXISTS (SELECT 1 FROM theme_follows tf WHERE tf.user_id = $1 AND tf.theme_id = r.theme_id)) AS matches
     FROM rooms r LEFT JOIN themes t ON t.id = r.theme_id
     WHERE r.visibility = 'public' AND r.archived_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM room_members me WHERE me.room_id = r.id AND me.user_id = $1)
       AND NOT EXISTS (SELECT 1 FROM room_sanctions s WHERE s.room_id = r.id AND s.user_id = $1 AND s.lifted_at IS NULL
         AND ((s.kind = 'ban' AND (s.expires_at IS NULL OR s.expires_at > now())) OR (s.kind = 'kick' AND s.created_at > now() - interval '24 hours')))
       AND ${notBlocked("r.owner_id")}
       AND EXISTS (SELECT 1 FROM room_messages msg WHERE msg.room_id = r.id AND msg.deleted_at IS NULL
         AND msg.created_at > now() - make_interval(days => $3))
     ORDER BY matches DESC, recent_messages DESC, members DESC, r.created_at DESC, r.id
     LIMIT $2`,
    [userId, limit, FRESH_DAYS],
  );
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    themeName: (r.theme_name as string) ?? null,
    members: Number(r.members),
    recentMessages: Number(r.recent_messages),
    matchesTheme: Boolean(r.matches),
  }));
}

export async function suggestedQuestions(q: Query, userId: string, limit = 4): Promise<SuggestedQuestion[]> {
  const rows = await q(
    `SELECT p.id, p.title, p.created_at, COALESCE(u.display_name, u.handle) AS author_name,
            (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.status = 'published') AS replies,
            COALESCE((SELECT array_agg(t.name ORDER BY t.name) FROM post_themes pt JOIN themes t ON t.id = pt.theme_id WHERE pt.post_id = p.id), '{}') AS theme_names,
            EXISTS (SELECT 1 FROM post_themes pt JOIN theme_follows tf ON tf.theme_id = pt.theme_id AND tf.user_id = $1 WHERE pt.post_id = p.id) AS matches
     FROM posts p JOIN users u ON u.id = p.author_id
     WHERE p.kind = 'question' AND p.status = 'published' AND p.author_id <> $1
       AND u.role <> 'agent' AND u.status = 'active'
       AND p.created_at > now() - make_interval(days => $3)
       AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.author_id = $1)
       AND ${notBlocked("p.author_id")}
     ORDER BY matches DESC, replies ASC, p.created_at DESC, p.id
     LIMIT $2`,
    [userId, limit, FRESH_DAYS],
  );
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    authorName: (r.author_name as string) ?? "Un membre",
    createdAt: new Date(r.created_at as string).toISOString(),
    replies: Number(r.replies),
    themeNames: (r.theme_names as string[]) ?? [],
    matchesTheme: Boolean(r.matches),
  }));
}

export async function suggestedMembers(q: Query, userId: string, limit = 5): Promise<SuggestedMember[]> {
  const rows = await q(
    `WITH activity AS (
       SELECT author_id AS id, count(*)::int AS n FROM (
         SELECT author_id FROM posts WHERE status = 'published' AND created_at > now() - make_interval(days => $3)
         UNION ALL
         SELECT author_id FROM comments WHERE status = 'published' AND created_at > now() - make_interval(days => $3)
       ) a GROUP BY author_id
     )
     SELECT u.handle, COALESCE(u.display_name, u.handle) AS display_name, u.avatar_image_id, u.bio, a.n AS contributions,
            COALESCE((SELECT array_agg(t.name ORDER BY t.name) FROM theme_follows mine
                      JOIN theme_follows theirs ON theirs.theme_id = mine.theme_id AND theirs.user_id = u.id
                      JOIN themes t ON t.id = mine.theme_id WHERE mine.user_id = $1), '{}') AS shared
     FROM users u JOIN activity a ON a.id = u.id
     WHERE u.id <> $1 AND u.role <> 'agent' AND u.status = 'active'
       AND u.handle IS NOT NULL AND u.rules_accepted_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM member_follows f WHERE f.follower_id = $1 AND f.followee_id = u.id)
       AND ${notBlocked("u.id")}
     ORDER BY cardinality(COALESCE((SELECT array_agg(1) FROM theme_follows mine
                JOIN theme_follows theirs ON theirs.theme_id = mine.theme_id AND theirs.user_id = u.id WHERE mine.user_id = $1), '{}')) DESC,
              a.n DESC, u.created_at, u.id
     LIMIT $2`,
    [userId, limit, FRESH_DAYS],
  );
  return rows.map((r) => ({
    handle: r.handle as string,
    displayName: r.display_name as string,
    avatarId: (r.avatar_image_id as string) ?? null,
    bio: (r.bio as string) ?? "",
    contributions: Number(r.contributions),
    sharedThemes: (r.shared as string[]) ?? [],
  }));
}

export async function firstSteps(q: Query, userId: string): Promise<FirstSteps> {
  const [themes, rooms, questions, members, [progress]] = await Promise.all([
    q<{ name: string }>(`SELECT t.name FROM theme_follows tf JOIN themes t ON t.id = tf.theme_id WHERE tf.user_id = $1 ORDER BY t.name`, [userId]),
    suggestedRooms(q, userId),
    suggestedQuestions(q, userId),
    suggestedMembers(q, userId),
    q<{ joined: boolean; contributed: boolean; follows: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM room_members WHERE user_id = $1) AS joined,
              (EXISTS (SELECT 1 FROM comments WHERE author_id = $1) OR EXISTS (SELECT 1 FROM posts WHERE author_id = $1)) AS contributed,
              EXISTS (SELECT 1 FROM member_follows WHERE follower_id = $1) AS follows`,
      [userId],
    ),
  ]);
  return {
    themeNames: themes.map((t) => t.name),
    rooms,
    questions,
    members,
    progress: { joinedRoom: Boolean(progress.joined), repliedOrPosted: Boolean(progress.contributed), followsMember: Boolean(progress.follows) },
  };
}

/**
 * Carte d'accueil des nouveaux : progression seulement (lecture légère), pour un membre
 * inscrit depuis moins de 7 jours. Null s'il n'est plus nouveau ou a tout fait.
 */
export async function newcomerProgress(q: Query, userId: string): Promise<{ done: number; total: 3 } | null> {
  const [row] = await q<{ fresh: boolean; joined: boolean; contributed: boolean; follows: boolean }>(
    `SELECT u.rules_accepted_at > now() - interval '7 days' AS fresh,
            EXISTS (SELECT 1 FROM room_members WHERE user_id = u.id) AS joined,
            (EXISTS (SELECT 1 FROM comments WHERE author_id = u.id) OR EXISTS (SELECT 1 FROM posts WHERE author_id = u.id)) AS contributed,
            EXISTS (SELECT 1 FROM member_follows WHERE follower_id = u.id) AS follows
     FROM users u WHERE u.id = $1`,
    [userId],
  );
  if (!row?.fresh) return null;
  const done = [row.joined, row.contributed, row.follows].filter(Boolean).length;
  return done === 3 ? null : { done, total: 3 };
}

export interface Newcomer {
  handle: string;
  displayName: string;
  avatarId: string | null;
  joinedAt: string;
  sharedThemes: string[];
  headline: string;
}

/**
 * Nouveaux membres à accueillir (inscrits depuis moins de 7 jours), pour les membres
 * installés : partager un thème met en tête. Jamais soi-même, ni l'agent, ni un blocage.
 */
export async function newcomersToWelcome(q: Query, viewerId: string, limit = 3): Promise<Newcomer[]> {
  const rows = await q(
    `SELECT u.handle, u.display_name, u.avatar_image_id, u.rules_accepted_at, u.headline,
            COALESCE((SELECT json_agg(t.name ORDER BY t.position) FROM theme_follows tf
                      JOIN theme_follows mine ON mine.theme_id = tf.theme_id AND mine.user_id = $1
                      JOIN themes t ON t.id = tf.theme_id AND t.active
                      WHERE tf.user_id = u.id), '[]'::json) AS shared
     FROM users u
     WHERE u.rules_accepted_at > now() - interval '7 days' AND u.status = 'active' AND u.role <> 'agent'
       AND u.handle IS NOT NULL AND u.id <> $1 AND ${notBlocked("u.id")}
     ORDER BY json_array_length(COALESCE((SELECT json_agg(1) FROM theme_follows tf
                      JOIN theme_follows mine ON mine.theme_id = tf.theme_id AND mine.user_id = $1
                      WHERE tf.user_id = u.id), '[]'::json)) DESC, u.rules_accepted_at DESC
     LIMIT $2`,
    [viewerId, limit],
  );
  return rows.map((r) => ({
    handle: r.handle as string,
    displayName: (r.display_name as string) || (r.handle as string),
    avatarId: (r.avatar_image_id as string) ?? null,
    joinedAt: new Date(r.rules_accepted_at as string).toISOString(),
    sharedThemes: (typeof r.shared === "string" ? JSON.parse(r.shared) : r.shared) as string[],
    headline: (r.headline as string) ?? "",
  }));
}

/** Membre inscrit depuis moins de 7 jours (fenêtre de l'indicateur « relié »). */
export async function isNewcomer(q: Query, userId: string): Promise<boolean> {
  const [row] = await q<{ fresh: boolean }>(
    `SELECT rules_accepted_at > now() - interval '7 days' AS fresh FROM users WHERE id = $1`,
    [userId],
  );
  return Boolean(row?.fresh);
}
