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

// ───────────────────────── Tableau de bord d'utilisation ─────────────────────────
// Agrégats uniquement, comme le reste : aucun contenu n'est lu, les comptes de l'agent éditorial
// sont écartés. « Actif » = membre connecté qui a ouvert le site ce jour-là (user_activity_days).
// Les visiteurs non connectés ne sont pas mesurés : Valyo n'a pas d'outil d'audience.

const MEMBER = `u.role <> 'agent' AND u.rules_accepted_at IS NOT NULL AND u.status <> 'deleted'`;
const ACTIVE = (where: string) => `(SELECT count(DISTINCT a.user_id)::int FROM user_activity_days a JOIN users u ON u.id = a.user_id WHERE u.role <> 'agent' AND ${where})`;
const TODAY = `(now() AT TIME ZONE 'UTC')::date`;

export const USAGE_OVERVIEW_SQL = `
SELECT
  (SELECT count(*)::int FROM users u WHERE ${MEMBER}) AS members,
  (SELECT count(*)::int FROM users u WHERE ${MEMBER} AND u.rules_accepted_at > now() - interval '7 days') AS new_7d,
  (SELECT count(*)::int FROM users u WHERE ${MEMBER} AND u.rules_accepted_at <= now() - interval '7 days' AND u.rules_accepted_at > now() - interval '14 days') AS new_prev_7d,
  ${ACTIVE(`a.day = ${TODAY}`)} AS active_today,
  ${ACTIVE(`a.day > ${TODAY} - 7`)} AS active_7d,
  ${ACTIVE(`a.day <= ${TODAY} - 7 AND a.day > ${TODAY} - 14`)} AS active_prev_7d,
  ${ACTIVE(`a.day > ${TODAY} - 30`)} AS active_30d,
  (SELECT count(DISTINCT s.user_id)::int FROM push_subscriptions s) AS push_members`;

export interface UsageOverview extends Record<string, unknown> {
  members: number;
  new_7d: number;
  new_prev_7d: number;
  active_today: number;
  active_7d: number;
  active_prev_7d: number;
  active_30d: number;
  push_members: number;
}

// Toutes les actions des membres sur 30 jours, ramenées à (type, date, auteur).
const EVENTS = `
  SELECT 'publications' AS kind, p.created_at AS at, p.author_id AS uid FROM posts p WHERE p.status <> 'deleted'
  UNION ALL SELECT 'commentaires', c.created_at, c.author_id FROM comments c WHERE c.status <> 'deleted'
  UNION ALL SELECT 'reactions', r.created_at, r.user_id FROM post_reactions r
  UNION ALL SELECT 'relais', r.created_at, r.user_id FROM post_relays r
  UNION ALL SELECT 'messages_salon', m.created_at, m.author_id FROM room_messages m WHERE m.deleted_at IS NULL
  UNION ALL SELECT 'messages_prives', d.created_at, d.sender_id FROM direct_messages d
  UNION ALL SELECT 'abonnements', f.created_at, f.follower_id FROM member_follows f
  UNION ALL SELECT 'parties', g.created_at, g.user_id FROM game_scores g
  UNION ALL SELECT 'syntheses', s.created_at, s.user_id FROM synthesis_attempts s WHERE s.user_id IS NOT NULL`;

/** Par type d'action : volume sur 7 et 30 jours, et nombre de membres différents sur 30 jours. */
export const USAGE_ACTIONS_SQL = `
WITH events AS (${EVENTS})
SELECT e.kind,
       count(*) FILTER (WHERE e.at > now() - interval '7 days')::int AS d7,
       count(*)::int AS d30,
       count(DISTINCT e.uid)::int AS members_30d
FROM events e JOIN users u ON u.id = e.uid
WHERE u.role <> 'agent' AND e.at > now() - interval '30 days'
GROUP BY e.kind`;

export interface UsageAction extends Record<string, unknown> {
  kind: string;
  d7: number;
  d30: number;
  members_30d: number;
}

/** Série quotidienne sur $1 jours (UTC) : membres actifs, inscriptions, actions de membres. */
export const USAGE_DAILY_SQL = `
WITH days AS (SELECT generate_series(${TODAY} - ($1::int - 1), ${TODAY}, interval '1 day')::date AS day),
events AS (${EVENTS})
SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
  (SELECT count(*)::int FROM user_activity_days a JOIN users u ON u.id = a.user_id WHERE a.day = d.day AND u.role <> 'agent') AS active,
  (SELECT count(*)::int FROM users u WHERE ${MEMBER} AND (u.rules_accepted_at AT TIME ZONE 'UTC')::date = d.day) AS signups,
  (SELECT count(*)::int FROM events e JOIN users u ON u.id = e.uid WHERE u.role <> 'agent' AND (e.at AT TIME ZONE 'UTC')::date = d.day) AS actions
FROM days d ORDER BY d.day`;

export interface UsageDay extends Record<string, unknown> {
  day: string;
  active: number;
  signups: number;
  actions: number;
}

/** Jeux sur 30 jours : parties comptées, joueurs différents, part de bonnes réponses. Les quiz par thème sont regroupés. */
export const USAGE_GAMES_SQL = `
SELECT split_part(g.game, ':', 1) AS game,
       count(*)::int AS plays,
       count(DISTINCT g.user_id)::int AS players,
       round(100.0 * sum(g.correct) / NULLIF(sum(g.total), 0))::int AS success
FROM game_scores g
WHERE g.created_at > now() - interval '30 days'
GROUP BY 1 ORDER BY plays DESC`;

export interface UsageGame extends Record<string, unknown> {
  game: string;
  plays: number;
  players: number;
  success: number | null;
}

/** Thèmes : abonnés, articles publiés sur 7 jours, réactions et commentaires de membres sur 30 jours. */
export const USAGE_THEMES_SQL = `
SELECT t.name,
  (SELECT count(*)::int FROM theme_follows f WHERE f.theme_id = t.id) AS followers,
  (SELECT count(*)::int FROM post_themes pt JOIN posts p ON p.id = pt.post_id
    WHERE pt.theme_id = t.id AND p.status = 'published' AND p.created_at > now() - interval '7 days') AS posts_7d,
  (SELECT count(*)::int FROM post_themes pt JOIN post_reactions r ON r.post_id = pt.post_id
    WHERE pt.theme_id = t.id AND r.created_at > now() - interval '30 days')
  + (SELECT count(*)::int FROM post_themes pt JOIN comments c ON c.post_id = pt.post_id JOIN users u ON u.id = c.author_id
    WHERE pt.theme_id = t.id AND u.role <> 'agent' AND c.status <> 'deleted' AND c.created_at > now() - interval '30 days') AS engagement_30d
FROM themes t
ORDER BY engagement_30d DESC, followers DESC, t.name`;

export interface UsageTheme extends Record<string, unknown> {
  name: string;
  followers: number;
  posts_7d: number;
  engagement_30d: number;
}

/** Les publications qui ont le plus fait réagir sur 30 jours (réactions + commentaires de membres). */
export const USAGE_TOP_POSTS_SQL = `
SELECT p.id, p.title, p.source_name,
  (SELECT count(*)::int FROM post_reactions r WHERE r.post_id = p.id) AS reactions,
  (SELECT count(*)::int FROM comments c JOIN users u ON u.id = c.author_id WHERE c.post_id = p.id AND u.role <> 'agent' AND c.status <> 'deleted') AS comments
FROM posts p
WHERE p.status = 'published' AND p.created_at > now() - interval '30 days'
ORDER BY (SELECT count(*) FROM post_reactions r WHERE r.post_id = p.id)
       + (SELECT count(*) FROM comments c JOIN users u ON u.id = c.author_id WHERE c.post_id = p.id AND u.role <> 'agent' AND c.status <> 'deleted') DESC,
       p.created_at DESC
LIMIT 5`;

export interface UsageTopPost extends Record<string, unknown> {
  id: string;
  title: string;
  source_name: string | null;
  reactions: number;
  comments: number;
}

/** Dépense d'IA estimée sur 30 jours (jetons consommés × tarif), et lectures audio générées. */
export const USAGE_AI_SQL = `
SELECT
  (SELECT coalesce(sum(cost_micros), 0)::float FROM synthesis_attempts WHERE created_at > now() - interval '30 days') AS syntheses_micros,
  (SELECT count(*)::int FROM synthesis_attempts WHERE created_at > now() - interval '30 days') AS syntheses,
  (SELECT coalesce(sum(cost_micros), 0)::float FROM weekly_quiz WHERE created_at > now() - interval '30 days') AS quiz_micros,
  (SELECT count(*)::int FROM post_audio WHERE created_at > now() - interval '30 days') AS audio,
  (SELECT coalesce(sum(chars), 0)::int FROM post_audio WHERE created_at > now() - interval '30 days') AS audio_chars`;

export interface UsageAi extends Record<string, unknown> {
  syntheses_micros: number;
  syntheses: number;
  quiz_micros: number;
  audio: number;
  audio_chars: number;
}
