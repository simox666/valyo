import type { Db, Query, Row } from "./types.ts";

// Moteur de tâches persistantes (contrat §4, revue B004) :
// - clé d'idempotence unique : réenregistrer une tâche ne la duplique jamais ;
// - réclamation atomique (FOR UPDATE SKIP LOCKED) qui attribue un JETON DE BAIL
//   unique et une expiration ; aucune transaction ouverte pendant le réseau ;
// - toute écriture métier d'une tâche se fait dans la transaction qui vérifie
//   ce jeton et l'expiration (assertLease), puis clôture la tâche (commitTask).
//   Un worker dont le bail a expiré ou a été repris n'écrit donc rien ;
// - reprises bornées avec délai croissant ; erreurs permanentes vers l'examen.

export const PROVIDER_KINDS = ["triage", "draft", "develop", "verify"] as const;
export const LOCAL_KINDS = ["collect_source", "extract_document", "prepare_recap"] as const;
export type TaskKind = (typeof PROVIDER_KINDS)[number] | (typeof LOCAL_KINDS)[number];

export interface Task {
  id: string;
  kind: TaskKind;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  state: string;
  attempts: number;
  maxAttempts: number;
  batchId: string | null;
  leaseOwner: string | null;
  leaseToken: string | null;
}

export function toTask(row: Row): Task {
  return {
    id: row.id as string,
    kind: row.kind as TaskKind,
    idempotencyKey: row.idempotency_key as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    state: row.state as string,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    batchId: (row.batch_id as string) ?? null,
    leaseOwner: (row.lease_owner as string) ?? null,
    leaseToken: (row.lease_token as string) ?? null,
  };
}

export interface TaskError {
  code: string;
  message: string;
  permanent: boolean;
  /** Motif D4 si l'erreur relève de l'examen éditorial. */
  reason?: string;
}

/** Bail expiré ou repris par un autre worker : aucune écriture ne doit être faite. */
export class LeaseLostError extends Error {
  constructor(taskId: string) {
    super(`Bail perdu pour la tâche ${taskId}`);
  }
}

/** Enregistre une tâche ; si la clé existe déjà, renvoie la tâche existante sans rien modifier. */
export async function enqueue(
  q: Query,
  task: { kind: TaskKind; key: string; payload?: Record<string, unknown>; maxAttempts?: number },
): Promise<{ id: string; created: boolean }> {
  const inserted = await q<{ id: string }>(
    `INSERT INTO editorial_tasks (kind, idempotency_key, payload, max_attempts) VALUES ($1, $2, $3, $4)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [task.kind, task.key, JSON.stringify(task.payload ?? {}), task.maxAttempts ?? 5],
  );
  if (inserted[0]) return { id: inserted[0].id, created: true };
  const [existing] = await q<{ id: string }>(`SELECT id FROM editorial_tasks WHERE idempotency_key = $1`, [task.key]);
  return { id: existing.id, created: false };
}

/**
 * Réclame une tâche locale prête : en attente et échue, ou en cours avec un bail expiré
 * (worker interrompu). Chaque réclamation reçoit un nouveau jeton de bail.
 * Au-delà du nombre maximal de tentatives, la tâche passe en examen.
 */
export async function claim(db: Db, owner: string, kinds: readonly TaskKind[], leaseSeconds = 300): Promise<Task | null> {
  return db.transaction(async (q) => {
    const [row] = await q(
      `SELECT * FROM editorial_tasks
       WHERE kind = ANY($1::text[]) AND (
         (state = 'pending' AND next_attempt_at <= now()) OR (state = 'running' AND lease_expires_at < now())
       )
       -- La préparation d'un récapitulatif passe après les collectes et extractions prêtes.
       ORDER BY CASE kind WHEN 'prepare_recap' THEN 1 ELSE 0 END, next_attempt_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [kinds],
    );
    if (!row) return null;
    if (Number(row.attempts) >= Number(row.max_attempts)) {
      await q(
        `UPDATE editorial_tasks SET state = 'review_required', lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
           updated_at = now(), error = $2 WHERE id = $1`,
        [row.id, JSON.stringify({ code: "max_attempts", message: "Nombre maximal de tentatives atteint", permanent: true })],
      );
      return null;
    }
    const [claimed] = await q(
      `UPDATE editorial_tasks SET state = 'running', attempts = attempts + 1, lease_owner = $2, lease_token = gen_random_uuid(),
         lease_expires_at = now() + make_interval(secs => $3), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [row.id, owner, leaseSeconds],
    );
    return toTask(claimed);
  });
}

/** Verrouille la tâche et vérifie jeton, état et expiration. À appeler en tête de transaction. */
export async function assertLease(q: Query, task: Task): Promise<void> {
  const rows = await q(
    `SELECT id FROM editorial_tasks WHERE id = $1 AND lease_token = $2 AND state = 'running' AND lease_expires_at > now() FOR UPDATE`,
    [task.id, task.leaseToken],
  );
  if (rows.length !== 1) throw new LeaseLostError(task.id);
}

/** Prolonge le bail d'une étape longue, sans remplacer le contrôle final de commitTask. */
export async function renewLease(q: Query, task: Task, seconds = 300): Promise<boolean> {
  const rows = await q(
    `UPDATE editorial_tasks SET lease_expires_at = now() + make_interval(secs => $3), updated_at = now()
     WHERE id = $1 AND lease_token = $2 AND state = 'running' AND lease_expires_at > now() RETURNING id`,
    [task.id, task.leaseToken, seconds],
  );
  return rows.length === 1;
}

/**
 * Applique les écritures métier puis clôture la tâche, dans UNE transaction protégée par le bail.
 * Si le bail est perdu, rien n'est écrit (LeaseLostError).
 */
export async function commitTask<R>(db: Db, task: Task, apply: (q: Query) => Promise<R>): Promise<R> {
  return db.transaction(async (q) => {
    await assertLease(q, task);
    const result = await apply(q);
    await q(
      `UPDATE editorial_tasks SET state = 'done', result = $2, error = NULL, lease_owner = NULL, lease_token = NULL,
         lease_expires_at = NULL, updated_at = now() WHERE id = $1`,
      [task.id, JSON.stringify(result ?? null)],
    );
    return result;
  });
}

/** Écritures métier protégées par le bail, sans clôturer la tâche (par exemple, consigner une erreur de source). */
export async function withLease<R>(db: Db, task: Task, apply: (q: Query) => Promise<R>): Promise<R> {
  return db.transaction(async (q) => {
    await assertLease(q, task);
    return apply(q);
  });
}

/** Termine une tâche sans écriture métier, si le bail est toujours valide ; false sinon. */
export async function complete(q: Query, task: Task, result: unknown = null): Promise<boolean> {
  const rows = await q(
    `UPDATE editorial_tasks SET state = 'done', result = $3, error = NULL, lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, updated_at = now()
     WHERE id = $1 AND state = 'running' AND lease_token = $2 AND lease_expires_at > now() RETURNING id`,
    [task.id, task.leaseToken, JSON.stringify(result)],
  );
  return rows.length === 1;
}

export function backoffSeconds(attempts: number): number {
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), 6 * 3600);
}

/** Échec : nouvel essai différé si l'erreur est temporaire et qu'il reste des tentatives, sinon examen. */
export async function fail(q: Query, task: Task, error: TaskError): Promise<"retry" | "review_required" | "lost"> {
  const toReview = error.permanent || task.attempts >= task.maxAttempts;
  const rows = await q(
    `UPDATE editorial_tasks SET state = $3, error = $4, lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, updated_at = now(),
       next_attempt_at = now() + make_interval(secs => $5)
     WHERE id = $1 AND state = 'running' AND lease_token = $2 RETURNING id`,
    [task.id, task.leaseToken, toReview ? "review_required" : "pending", JSON.stringify(error), toReview ? 0 : backoffSeconds(task.attempts)],
  );
  if (rows.length === 0) return "lost";
  return toReview ? "review_required" : "retry";
}

/** Action administrateur : relancer une tâche en examen ou annulée, ou annuler une tâche en attente. */
export async function adminAction(q: Query, taskId: string, action: "retry" | "cancel"): Promise<boolean> {
  const rows =
    action === "retry"
      ? await q(
          `UPDATE editorial_tasks SET state = 'pending', attempts = 0, next_attempt_at = now(), error = NULL, updated_at = now()
           WHERE id = $1 AND state IN ('review_required', 'cancelled') RETURNING id`,
          [taskId],
        )
      : await q(
          `UPDATE editorial_tasks SET state = 'cancelled', updated_at = now() WHERE id = $1 AND state IN ('pending', 'review_required') RETURNING id`,
          [taskId],
        );
  return rows.length === 1;
}
