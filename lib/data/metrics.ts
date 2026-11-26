import "server-only";
import { createActivityRecorder } from "../activity";
import { query, queryOne } from "../db";
import {
  ACTIVITY_SPLIT_SQL, CONNECTION_COHORTS_SQL, ROOMS_ACTIVITY_SQL, USAGE_ACTIONS_SQL, USAGE_AI_SQL, USAGE_DAILY_SQL, USAGE_GAMES_SQL,
  USAGE_OVERVIEW_SQL, USAGE_THEMES_SQL, USAGE_TOP_POSTS_SQL,
  type ActivitySplit, type CohortRow, type RoomsActivity, type UsageAction, type UsageAi, type UsageDay, type UsageGame, type UsageOverview,
  type UsageTheme, type UsageTopPost,
} from "../metrics-sql";

export async function connectionCohorts(weeks = 8): Promise<CohortRow[]> {
  return query<CohortRow>(CONNECTION_COHORTS_SQL, [weeks]);
}

export async function activitySplit(): Promise<ActivitySplit> {
  return (await queryOne<ActivitySplit>(ACTIVITY_SPLIT_SQL))!;
}

export async function roomsActivity(): Promise<RoomsActivity> {
  return (await queryOne<RoomsActivity>(ROOMS_ACTIVITY_SQL))!;
}

/** Tout le tableau de bord d'utilisation, en un aller-retour parallèle. */
export async function usageDashboard(days = 30) {
  const [overview, actions, daily, games, themes, topPosts, ai] = await Promise.all([
    queryOne<UsageOverview>(USAGE_OVERVIEW_SQL),
    query<UsageAction>(USAGE_ACTIONS_SQL),
    query<UsageDay>(USAGE_DAILY_SQL, [days]),
    query<UsageGame>(USAGE_GAMES_SQL),
    query<UsageTheme>(USAGE_THEMES_SQL),
    query<UsageTopPost>(USAGE_TOP_POSTS_SQL),
    queryOne<UsageAi>(USAGE_AI_SQL),
  ]);
  return { overview: overview!, actions, daily, games, themes, topPosts, ai: ai! };
}

declare global {
  // eslint-disable-next-line no-var
  var __valyoRecordActivity: ((userId: string) => Promise<void>) | undefined;
}

/** Au plus une écriture par membre et par jour UTC ; ne lève jamais d'erreur. */
export function recordActivity(userId: string): Promise<void> {
  globalThis.__valyoRecordActivity ??= createActivityRecorder(async (id, day) => {
    await query(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, $2::date) ON CONFLICT DO NOTHING`, [id, day]);
    // Rétention (RGPD) : données comportementales limitées à 24 mois. Au plus une purge
    // par membre et par jour (le cache de createActivityRecorder borne les appels).
    await query(`DELETE FROM user_activity_days WHERE day < $1::date - 730`, [day]);
  });
  return globalThis.__valyoRecordActivity(userId);
}
