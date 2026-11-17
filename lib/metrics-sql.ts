// Requêtes d'indicateurs, sans dépendance serveur pour pouvoir être testées
// directement (tests/metrics.test.ts). Définitions : docs/decisions.md §5.
// Agrégats uniquement : aucune requête ne lit le texte des contributions.
//
// Anomalie A004 : tous les jours et semaines sont calculés en UTC, explicitement
// (AT TIME ZONE 'UTC'), pour que le résultat ne dépende pas du fuseau de la
// session PostgreSQL. Les jours d'activité sont déjà enregistrés en UTC.

/**
 * Cohortes hebdomadaires (semaine UTC d'inscription, lundi) sur les $1 dernières semaines.
 * - relié : échange avec un autre humain dans les 7 jours suivant l'inscription
 *   (réponse à son commentaire, réponse de sa part, ou commentaire sur sa publication / de sa part) ;
 * - revenu : actif du 8e au 14e jour UTC (jour d'inscription = jour 1) ;
 * - complète : les 14 jours de suivi sont écoulés pour tous les membres de la cohorte.
 * Le compte de l'agent éditorial est exclu des deux côtés de l'échange.
 */
export const CONNECTION_COHORTS_SQL = `
WITH members AS (
  SELECT id,
         rules_accepted_at AS joined_at,
         (rules_accepted_at AT TIME ZONE 'UTC')::date AS joined_day,
         date_trunc('week', rules_accepted_at AT TIME ZONE 'UTC') AS joined_week
  FROM users
  WHERE role IN ('member', 'admin') AND rules_accepted_at IS NOT NULL
    AND (rules_accepted_at AT TIME ZONE 'UTC') >= date_trunc('week', now() AT TIME ZONE 'UTC') - make_interval(weeks => $1::int)
),
exchanges AS (
  SELECT c.author_id AS a, parent.author_id AS b, c.created_at AS at
  FROM comments c JOIN comments parent ON parent.id = c.parent_id
  UNION ALL
  SELECT c.author_id, p.author_id, c.created_at
  FROM comments c JOIN posts p ON p.id = c.post_id
),
human_exchanges AS (
  SELECT e.a, e.b, e.at
  FROM exchanges e JOIN users ua ON ua.id = e.a JOIN users ub ON ub.id = e.b
  WHERE e.a <> e.b AND ua.role <> 'agent' AND ub.role <> 'agent'
),
linked AS (
  SELECT DISTINCT m.id
  FROM members m JOIN human_exchanges h ON h.a = m.id OR h.b = m.id
  WHERE h.at >= m.joined_at AND h.at < m.joined_at + interval '7 days'
),
activity AS (
  SELECT user_id, day FROM user_activity_days
  UNION SELECT author_id, (created_at AT TIME ZONE 'UTC')::date FROM comments
  UNION SELECT author_id, (created_at AT TIME ZONE 'UTC')::date FROM posts
),
returned AS (
  SELECT DISTINCT m.id
  FROM members m JOIN activity a ON a.user_id = m.id
  WHERE a.day BETWEEN m.joined_day + 7 AND m.joined_day + 13
)
SELECT to_char(m.joined_week, 'YYYY-MM-DD') AS week,
       count(*)::int AS new_members,
       count(l.id)::int AS linked,
       count(r.id)::int AS returned,
       count(*) FILTER (WHERE l.id IS NOT NULL AND r.id IS NOT NULL)::int AS linked_and_returned,
       (m.joined_week + interval '21 days' <= now() AT TIME ZONE 'UTC') AS complete
FROM members m
LEFT JOIN linked l ON l.id = m.id
LEFT JOIN returned r ON r.id = m.id
GROUP BY m.joined_week
ORDER BY m.joined_week DESC`;

/** Volumes des 7 derniers jours, en séparant production humaine et production de l'agent. */
export const ACTIVITY_SPLIT_SQL = `
SELECT
  (SELECT count(*)::int FROM posts p JOIN users u ON u.id = p.author_id
    WHERE u.role <> 'agent' AND p.created_at > now() - interval '7 days' AND p.status <> 'deleted') AS human_posts,
  (SELECT count(*)::int FROM posts p JOIN users u ON u.id = p.author_id
    WHERE u.role = 'agent' AND p.created_at > now() - interval '7 days' AND p.status <> 'deleted') AS agent_posts,
  (SELECT count(*)::int FROM comments c JOIN users u ON u.id = c.author_id
    WHERE u.role <> 'agent' AND c.created_at > now() - interval '7 days') AS human_comments,
  (SELECT count(DISTINCT p.id)::int FROM posts p
    WHERE p.created_at > now() - interval '7 days' AND p.status = 'published'
      AND EXISTS (SELECT 1 FROM comments c JOIN users cu ON cu.id = c.author_id
                  WHERE c.post_id = p.id AND c.author_id <> p.author_id AND cu.role <> 'agent')) AS posts_with_human_reply,
  (SELECT count(*)::int FROM posts p WHERE p.created_at > now() - interval '7 days' AND p.status = 'published') AS published_posts,
  (SELECT count(DISTINCT user_id)::int FROM user_activity_days
    WHERE day > (now() AT TIME ZONE 'UTC')::date - 7) AS weekly_active_members`;

/**
 * Salons et chat, 7 derniers jours (lot d'accélération E39). Agrégats UNIQUEMENT :
 * aucune requête ne lit le texte des messages, et rien ne distingue un salon privé
 * d'un salon public dans les totaux. Lecture (membres, suiveurs) et contribution
 * (membres ayant écrit) sont séparées.
 */
export const ROOMS_ACTIVITY_SQL = `
SELECT
  (SELECT count(*)::int FROM rooms WHERE archived_at IS NULL) AS active_rooms,
  (SELECT count(*)::int FROM rooms WHERE created_at > now() - interval '7 days') AS rooms_created,
  (SELECT count(*)::int FROM rooms r WHERE r.archived_at IS NULL AND EXISTS (
     SELECT 1 FROM room_messages m WHERE m.room_id = r.id AND m.deleted_at IS NULL AND m.created_at > now() - interval '7 days')) AS rooms_with_activity,
  (SELECT count(*)::int FROM room_messages WHERE deleted_at IS NULL AND created_at > now() - interval '7 days') AS messages,
  (SELECT count(DISTINCT author_id)::int FROM room_messages WHERE deleted_at IS NULL AND created_at > now() - interval '7 days') AS writers,
  (SELECT count(DISTINCT user_id)::int FROM room_members) AS members,
  (SELECT count(DISTINCT user_id)::int FROM room_members WHERE following) AS followers`;

export interface RoomsActivity extends Record<string, unknown> {
  active_rooms: number;
  rooms_created: number;
  rooms_with_activity: number;
  messages: number;
  writers: number;
  members: number;
  followers: number;
}

export interface CohortRow extends Record<string, unknown> {
  week: string;
  new_members: number;
  linked: number;
  returned: number;
  linked_and_returned: number;
  complete: boolean;
}

export interface ActivitySplit extends Record<string, unknown> {
  human_posts: number;
  agent_posts: number;
  human_comments: number;
  posts_with_human_reply: number;
  published_posts: number;
  weekly_active_members: number;
}
