import type { Query } from "./editorial/types.ts";

// Verrous transactionnels C010. Une opération ordinaire prend la barrière partagée,
// puis le salon éventuel, puis les lignes métier. Une sanction de plateforme ou une
// fermeture de session prend d'abord la barrière exclusive : elle ne peut couper une
// écriture/émission en cours, et aucune nouvelle ne passe avant son commit.
// Des salons distincts restent concurrents. Aucun verrou n'est tenu pendant le polling,
// un appel réseau ou la durée entière d'un flux SSE. Toujours utiliser une transaction.
export async function lockCommunity(q: Query, exclusive = false) {
  await q(`SELECT ${exclusive ? "pg_advisory_xact_lock" : "pg_advisory_xact_lock_shared"}(731021, 1)`);
}

export async function lockRoom(q: Query, roomId: string, readOnly = false) {
  await lockCommunity(q);
  await q(`SELECT ${readOnly ? "pg_advisory_xact_lock_shared" : "pg_advisory_xact_lock"}(hashtext('room-events:' || $1::text))`, [roomId]);
}

export async function activeContributor(q: Query, userId: string, allowOnboarding = false): Promise<boolean> {
  await lockCommunity(q);
  const [user] = await q<{ status: string; onboarded: boolean }>(
    `SELECT status, (handle IS NOT NULL AND rules_accepted_at IS NOT NULL) AS onboarded
     FROM users WHERE id = $1 FOR NO KEY UPDATE`, [userId],
  );
  return Boolean(user?.status === "active" && (allowOnboarding || user.onboarded));
}
