import type { Query } from "../editorial/types.ts";

// Activité PUBLIQUE d'un membre pour son profil. Uniquement ce qui est déjà public :
// publications et commentaires publiés, salons PUBLICS non archivés dont il est membre.
// Jamais un salon privé ni une appartenance privée (spec §4, F02).

export interface PublicActivity {
  posts: number;
  comments: number;
  rooms: { id: string; name: string; role: string; themeName: string | null; members: number }[];
}

export async function publicActivity(q: Query, memberId: string): Promise<PublicActivity> {
  const [[counts], rooms] = await Promise.all([
    q<{ posts: number; comments: number }>(
      `SELECT (SELECT count(*)::int FROM posts WHERE author_id = $1 AND status = 'published') AS posts,
              (SELECT count(*)::int FROM comments c JOIN posts p ON p.id = c.post_id
                 WHERE c.author_id = $1 AND c.status = 'published' AND p.status = 'published') AS comments`,
      [memberId],
    ),
    q(
      `SELECT r.id, r.name, m.role, t.name AS theme_name,
              (SELECT count(*)::int FROM room_members x WHERE x.room_id = r.id) AS members
       FROM room_members m JOIN rooms r ON r.id = m.room_id LEFT JOIN themes t ON t.id = r.theme_id
       WHERE m.user_id = $1 AND r.visibility = 'public' AND r.archived_at IS NULL
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, m.joined_at DESC
       LIMIT 6`,
      [memberId],
    ),
  ]);
  return {
    posts: Number(counts?.posts ?? 0),
    comments: Number(counts?.comments ?? 0),
    rooms: rooms.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      role: r.role as string,
      themeName: (r.theme_name as string) ?? null,
      members: Number(r.members),
    })),
  };
}

// Ce qu'un passionné cherche sur un profil : la réputation (ce que la personne a apporté aux
// autres), ses domaines (contributions par thème) et ce qu'on a en commun avec elle.

export interface ProfileInsights {
  /** Réactions « J'ai appris » reçues sur ses publications. */
  taught: number;
  /** Réactions « Intéressant » reçues. */
  interesting: number;
  /** Commentaires laissés sous les questions des autres. */
  answers: number;
  /** Contributions (publications + commentaires) par thème, du plus fort au plus faible. */
  elements: { slug: string; name: string; count: number }[];
  /** Personnes que le lecteur suit et qui suivent ce membre (3 au plus) et leur nombre total. */
  followedBy: { handle: string; displayName: string; avatarId: string | null }[];
  followedByCount: number;
  /** Thèmes suivis à la fois par le lecteur et par ce membre. */
  commonThemes: string[];
}

export async function profileInsights(q: Query, memberId: string, viewerId: string | null): Promise<ProfileInsights> {
  const [[rep], elements, followedBy, common] = await Promise.all([
    q<{ taught: number; interesting: number; answers: number }>(
      `SELECT
         (SELECT count(*)::int FROM post_reactions r JOIN posts p ON p.id = r.post_id
            WHERE p.author_id = $1 AND p.status = 'published' AND r.kind = 'appris' AND r.user_id <> $1) AS taught,
         (SELECT count(*)::int FROM post_reactions r JOIN posts p ON p.id = r.post_id
            WHERE p.author_id = $1 AND p.status = 'published' AND r.kind = 'interessant' AND r.user_id <> $1) AS interesting,
         (SELECT count(*)::int FROM comments c JOIN posts p ON p.id = c.post_id
            WHERE c.author_id = $1 AND c.status = 'published' AND p.status = 'published' AND p.kind = 'question' AND p.author_id <> $1) AS answers`,
      [memberId],
    ),
    q<{ slug: string; name: string; count: number }>(
      `SELECT t.slug, t.name, count(*)::int AS count FROM (
         SELECT pt.theme_id FROM posts p JOIN post_themes pt ON pt.post_id = p.id WHERE p.author_id = $1 AND p.status = 'published'
         UNION ALL
         SELECT pt.theme_id FROM comments c JOIN posts p ON p.id = c.post_id JOIN post_themes pt ON pt.post_id = p.id
           WHERE c.author_id = $1 AND c.status = 'published' AND p.status = 'published'
       ) x JOIN themes t ON t.id = x.theme_id AND t.active
       GROUP BY t.slug, t.name, t.position ORDER BY count DESC, t.position`,
      [memberId],
    ),
    viewerId && viewerId !== memberId
      ? q<{ handle: string; display_name: string | null; avatar_image_id: string | null; total: number }>(
          `SELECT u.handle, u.display_name, u.avatar_image_id, count(*) OVER ()::int AS total
           FROM member_follows f
           JOIN member_follows mine ON mine.followee_id = f.follower_id AND mine.follower_id = $2
           JOIN users u ON u.id = f.follower_id
           WHERE f.followee_id = $1 AND u.status <> 'deleted' AND u.handle IS NOT NULL
           ORDER BY f.created_at DESC LIMIT 3`,
          [memberId, viewerId],
        )
      : Promise.resolve([]),
    viewerId && viewerId !== memberId
      ? q<{ name: string }>(
          `SELECT t.name FROM theme_follows a JOIN theme_follows b ON b.theme_id = a.theme_id AND b.user_id = $2
           JOIN themes t ON t.id = a.theme_id WHERE a.user_id = $1 AND t.active ORDER BY t.position`,
          [memberId, viewerId],
        )
      : Promise.resolve([]),
  ]);
  return {
    taught: Number(rep?.taught ?? 0),
    interesting: Number(rep?.interesting ?? 0),
    answers: Number(rep?.answers ?? 0),
    elements: elements.map((e) => ({ slug: e.slug, name: e.name, count: Number(e.count) })),
    followedBy: followedBy.map((u) => ({ handle: u.handle, displayName: u.display_name || u.handle, avatarId: u.avatar_image_id })),
    followedByCount: Number(followedBy[0]?.total ?? 0),
    commonThemes: common.map((c) => c.name),
  };
}

// Second lot du profil : le meilleur d'un membre et sa régularité. Uniquement du public :
// publications et commentaires publiés (jamais les visites ni les messages privés).

export interface BestContributions {
  posts: { id: string; title: string; reactions: number; comments: number }[];
  comments: { id: string; postId: string; postTitle: string; body: string; replies: number }[];
}

/** Publications les plus appréciées (réactions + 2 × commentaires) et commentaires les plus répondus. */
export async function bestContributions(q: Query, memberId: string, excludePostId: string | null = null): Promise<BestContributions> {
  const [posts, comments] = await Promise.all([
    q<{ id: string; title: string; reactions: number; comments: number }>(
      `SELECT * FROM (
         SELECT p.id, p.title,
                (SELECT count(*)::int FROM post_reactions r WHERE r.post_id = p.id AND r.user_id <> $1) AS reactions,
                (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.status = 'published' AND c.author_id <> $1) AS comments
         FROM posts p WHERE p.author_id = $1 AND p.status = 'published' AND ($2::uuid IS NULL OR p.id <> $2::uuid)
       ) s WHERE reactions + comments > 0
       ORDER BY reactions + 2 * comments DESC, id LIMIT 3`,
      [memberId, excludePostId],
    ),
    q<{ id: string; post_id: string; post_title: string; body: string; replies: number }>(
      `SELECT * FROM (
         SELECT c.id, c.post_id, p.title AS post_title, c.body,
                (SELECT count(*)::int FROM comments r WHERE r.parent_id = c.id AND r.status = 'published' AND r.author_id <> $1) AS replies
         FROM comments c JOIN posts p ON p.id = c.post_id
         WHERE c.author_id = $1 AND c.status = 'published' AND p.status = 'published'
       ) s WHERE replies > 0 ORDER BY replies DESC, id LIMIT 3`,
      [memberId],
    ),
  ]);
  return {
    posts: posts.map((p) => ({ id: p.id, title: p.title, reactions: Number(p.reactions), comments: Number(p.comments) })),
    comments: comments.map((c) => ({ id: c.id, postId: c.post_id, postTitle: c.post_title, body: c.body, replies: Number(c.replies) })),
  };
}

export const ACTIVITY_WEEKS = 18;

/** Contributions publiques par jour (heure de Bruxelles) sur les dernières semaines, du plus ancien au plus récent. */
export async function activityCalendar(q: Query, memberId: string, today = new Date()): Promise<{ day: string; count: number }[]> {
  const rows = await q<{ day: string; n: number }>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(*)::int AS n FROM (
       SELECT (created_at AT TIME ZONE 'Europe/Brussels')::date AS d FROM posts WHERE author_id = $1 AND status = 'published' AND created_at > $2::timestamptz - interval '130 days'
       UNION ALL
       SELECT (created_at AT TIME ZONE 'Europe/Brussels')::date FROM comments WHERE author_id = $1 AND status = 'published' AND created_at > $2::timestamptz - interval '130 days'
     ) x GROUP BY d`,
    [memberId, today.toISOString()],
  );
  const counts = new Map(rows.map((r) => [r.day, Number(r.n)]));
  // Grille complète : semaines du lundi au dimanche, la dernière contient aujourd'hui.
  const brussels = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(d);
  const end = new Date(`${brussels(today)}T12:00:00Z`);
  const weekday = (end.getUTCDay() + 6) % 7; // lundi = 0
  const start = new Date(end.getTime() - (weekday + 7 * (ACTIVITY_WEEKS - 1)) * 86400000);
  const days: { day: string; count: number }[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    days.push({ day, count: counts.get(day) ?? 0 });
  }
  return days;
}
