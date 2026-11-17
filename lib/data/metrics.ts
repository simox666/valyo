import "server-only";
import { createActivityRecorder } from "../activity";
import { query, queryOne } from "../db";
import { ACTIVITY_SPLIT_SQL, CONNECTION_COHORTS_SQL, ROOMS_ACTIVITY_SQL, type ActivitySplit, type CohortRow, type RoomsActivity } from "../metrics-sql";

export async function connectionCohorts(weeks = 8): Promise<CohortRow[]> {
  return query<CohortRow>(CONNECTION_COHORTS_SQL, [weeks]);
}

export async function activitySplit(): Promise<ActivitySplit> {
  return (await queryOne<ActivitySplit>(ACTIVITY_SPLIT_SQL))!;
}

export async function roomsActivity(): Promise<RoomsActivity> {
  return (await queryOne<RoomsActivity>(ROOMS_ACTIVITY_SQL))!;
}

declare global {
  // eslint-disable-next-line no-var
  var __valyoRecordActivity: ((userId: string) => Promise<void>) | undefined;
}

/** Au plus une écriture par membre et par jour UTC ; ne lève jamais d'erreur. */
export function recordActivity(userId: string): Promise<void> {
  globalThis.__valyoRecordActivity ??= createActivityRecorder((id, day) =>
    query(`INSERT INTO user_activity_days (user_id, day) VALUES ($1, $2::date) ON CONFLICT DO NOTHING`, [id, day]),
  );
  return globalThis.__valyoRecordActivity(userId);
}
