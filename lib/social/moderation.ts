import { createHash, randomBytes } from "node:crypto";
import { activeContributor, lockCommunity } from "../community-locks.ts";
import { purgeSynthesis } from "../actus/synthesis.ts";
import { configuredAdminEmails } from "../admins.ts";
import { logRevision } from "../editorial/config.ts";
import type { Db, Query, Row } from "../editorial/types.ts";
import { appendRoomEvent, emitRevocation } from "../rooms/chat.ts";
import { canReadRoom, loadAccess } from "../rooms/permissions.ts";

// Modération de plateforme (lot d'accélération D32-D35 ; decisions D5).
// Les modérateurs de plateforme sont les administrateurs (rôle dédié à prévoir si
// l'équipe s'élargit). Tout est journalisé (moderation_actions, report_views).
// La CONFIDENTIALITÉ du signalant est structurelle : reporter_id n'est jamais
// renvoyé hors des fonctions réservées à la modération.

const refuse = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });
type Outcome<T = unknown> = ({ ok: true } & T) | { ok: false; code: string; message: string };

export const REPORT_REASONS = ["regles", "spam", "harcelement", "illegal", "autre"] as const;
export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  regles: "Non-respect des règles",
  spam: "Spam ou promotion",
  harcelement: "Harcèlement",
  illegal: "Contenu illégal",
  autre: "Autre motif",
};

// ───────────────────────────── Signalements (D32) ─────────────────────────────

/**
 * Crée un signalement. À appeler via runLimited("report") : limite D6 de 20 par jour.
 * La cible est vérifiée et son auteur capturé (file de traitement).
 */
export async function createReport(
  q: Query,
  args: { reporterId: string; targetKind: "post" | "comment" | "message" | "member"; targetId: string; reason: (typeof REPORT_REASONS)[number]; details: string },
): Promise<Outcome<{ reportId: string }>> {
  if (args.targetKind !== "message" && !(await activeContributor(q, args.reporterId))) return refuse("droit", "Compte non autorisé à signaler.");
  let targetUserId: string | null = null;
  let roomId: string | null = null;
  if (args.targetKind === "post") {
    const [row] = await q<{ author_id: string }>(`SELECT author_id FROM posts WHERE id = $1 AND status = 'published'`, [args.targetId]);
    if (!row) return refuse("introuvable", "Publication introuvable.");
    targetUserId = row.author_id;
  } else if (args.targetKind === "comment") {
    const [row] = await q<{ author_id: string }>(`SELECT author_id FROM comments WHERE id = $1 AND status = 'published'`, [args.targetId]);
    if (!row) return refuse("introuvable", "Commentaire introuvable.");
    targetUserId = row.author_id;
  } else if (args.targetKind === "message") {
    const [row] = await q<{ author_id: string; room_id: string }>(`SELECT author_id, room_id FROM room_messages WHERE id = $1 AND deleted_at IS NULL`, [args.targetId]);
    if (!row) return refuse("introuvable", "Message introuvable.");
    // Le signalant doit pouvoir lire le message : être membre du salon.
    const access = await loadAccess(q, row.room_id, { id: args.reporterId, status: "active", onboarded: true }, { forWrite: true });
    if (!canReadRoom(access)) return refuse("introuvable", "Message introuvable.");
    targetUserId = row.author_id;
    roomId = row.room_id;
  } else {
    const [row] = await q<{ id: string }>(`SELECT id FROM users WHERE id = $1 AND status <> 'deleted'`, [args.targetId]);
    if (!row) return refuse("introuvable", "Membre introuvable.");
    targetUserId = row.id;
  }
  if (targetUserId === args.reporterId) return refuse("soi", "On ne se signale pas soi-même.");
  const [report] = await q<{ id: string }>(
    `INSERT INTO reports (reporter_id, target_kind, target_id, target_user_id, room_id, reason, details) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [args.reporterId, args.targetKind, args.targetId, targetUserId, roomId, args.reason, args.details],
  );
  return { ok: true, reportId: report.id };
}

/** File de traitement (modération). Le signalant n'apparaît qu'ici. */
export async function listOpenReports(q: Query, limit = 50): Promise<Row[]> {
  return q(
    `SELECT r.id, r.target_kind, r.target_id, r.room_id, r.reason, r.details, r.created_at,
            tu.handle AS target_handle, tu.display_name AS target_name, rep.handle AS reporter_handle
     FROM reports r
     LEFT JOIN users tu ON tu.id = r.target_user_id
     JOIN users rep ON rep.id = r.reporter_id
     WHERE r.status = 'open' ORDER BY r.created_at LIMIT $1`,
    [limit],
  );
}

// ─────────────── Contexte privé d'un signalement de message (D34) ───────────────

export const CONTEXT_MESSAGES = 10;
export const CONTEXT_WINDOW_MINUTES = 30;

/**
 * Contexte BORNÉ d'un message signalé dans un salon (y compris privé) : le message,
 * plus au maximum 10 messages avant et 10 après, dans une fenêtre de ±30 minutes.
 * Aucune liste de membres, aucun autre historique. Chaque consultation est JOURNALISÉE.
 */
export async function reportContext(db: Db, args: { reportId: string; moderatorId: string }): Promise<Outcome<{ messages: Row[] }>> {
  return db.transaction(async (q) => {
    const [report] = await q(`SELECT * FROM reports WHERE id = $1`, [args.reportId]);
    if (!report || report.target_kind !== "message") return refuse("introuvable", "Signalement de message introuvable.");
    const [message] = await q(`SELECT * FROM room_messages WHERE id = $1`, [report.target_id]);
    if (!message) return refuse("introuvable", "Message disparu.");
    await q(`INSERT INTO report_views (report_id, moderator_id) VALUES ($1, $2)`, [args.reportId, args.moderatorId]);
    const rows = await q(
      `(SELECT m.*, u.display_name FROM room_messages m JOIN users u ON u.id = m.author_id
        WHERE m.room_id = $1 AND m.seq < $2 AND m.created_at >= $3::timestamptz - make_interval(mins => $4)
        ORDER BY m.seq DESC LIMIT $5)
       UNION ALL
       (SELECT m.*, u.display_name FROM room_messages m JOIN users u ON u.id = m.author_id
        WHERE m.room_id = $1 AND m.seq >= $2 AND m.created_at <= $3::timestamptz + make_interval(mins => $4)
        ORDER BY m.seq LIMIT $5 + 1)
       ORDER BY seq`,
      [message.room_id, message.seq, message.created_at, CONTEXT_WINDOW_MINUTES, CONTEXT_MESSAGES],
    );
    return { ok: true, messages: rows.map((m) => ({ id: m.id, seq: m.seq, author: m.display_name, body: m.deleted_at ? null : m.body, created_at: m.created_at, signale: m.id === report.target_id })) };
  });
}

// ─────────────── Actions humaines (D33) ───────────────

export type ModerationKind = "remove_content" | "warn" | "suspend" | "ban" | "lift";

export interface ModerationInput {
  moderatorId: string;
  targetUserId: string;
  reportId?: string | null;
  kind: ModerationKind;
  contentKind?: "post" | "comment" | "message";
  contentId?: string;
  /** Pour `lift` : LA sanction à lever (ACC02 : une levée est individuelle). */
  actionId?: string;
  reason: string;
  durationDays?: 7 | 30 | null;
}

// ─────────────── État effectif des sanctions (ACC02) ───────────────
// Chaque sanction (suspend/ban) vit sa propre vie : elle expire par sa durée ou se lève
// individuellement (revoked_*). Le statut du compte est TOUJOURS recalculé depuis les
// sanctions encore applicables : lever une sanction ancienne ne lève jamais une plus récente.

export interface ActiveSanction {
  id: string;
  kind: "suspend" | "ban";
  until: string | null;
}

export async function activePlatformSanctions(q: Query, userId: string): Promise<ActiveSanction[]> {
  const rows = await q(
    `SELECT id, kind,
            CASE WHEN duration_days IS NULL THEN NULL ELSE created_at + make_interval(days => duration_days) END AS until
     FROM moderation_actions
     WHERE target_user_id = $1 AND kind IN ('suspend', 'ban') AND revoked_at IS NULL
       AND (duration_days IS NULL OR created_at + make_interval(days => duration_days) > now())
     ORDER BY created_at`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id as string, kind: r.kind as "suspend" | "ban", until: r.until ? new Date(r.until as string).toISOString() : null }));
}

/**
 * Recalcule et applique le statut du compte depuis les sanctions applicables, sous verrou
 * de la ligne utilisateur. Bannissement > suspension > actif ; un compte supprimé ne change pas.
 */
export async function applyEffectiveStatus(q: Query, userId: string): Promise<string> {
  await lockCommunity(q, true);
  const [user] = await q<{ status: string }>(`SELECT status FROM users WHERE id = $1 FOR UPDATE`, [userId]);
  if (!user || user.status === "deleted") return user?.status ?? "deleted";
  const sanctions = await activePlatformSanctions(q, userId);
  let status = "active";
  let until: string | null = null;
  if (sanctions.some((s) => s.kind === "ban")) {
    status = "banned";
  } else {
    const suspensions = sanctions.filter((s) => s.kind === "suspend");
    if (suspensions.length > 0) {
      status = "suspended";
      // Sans limite si l'une est sans durée ; sinon la plus lointaine des échéances.
      until = suspensions.some((s) => s.until === null) ? null : suspensions.map((s) => s.until!).sort().at(-1)!;
    }
  }
  await q(`UPDATE users SET status = $2, suspended_until = $3 WHERE id = $1`, [userId, status, until]);
  return status;
}

/**
 * ACC04 (D5 §4.1) : au bannissement de plateforme d'un propriétaire, chaque salon actif
 * possédé passe au modérateur le plus ancien ; sans modérateur, il est archivé et l'équipe
 * de modération en est informée. Les transferts ouverts sont annulés.
 */
async function resolveOwnedRooms(q: Query, bannedOwnerId: string) {
  const rooms = await q<{ id: string; name: string }>(
    `SELECT id, name FROM rooms WHERE owner_id = $1 AND archived_at IS NULL ORDER BY created_at FOR UPDATE`,
    [bannedOwnerId],
  );
  for (const room of rooms) {
    await q(
      `UPDATE room_transfers SET cancelled_at = now() WHERE room_id = $1 AND accepted_at IS NULL AND declined_at IS NULL AND cancelled_at IS NULL`,
      [room.id],
    );
    const [successor] = await q<{ user_id: string }>(
      `SELECT m.user_id FROM room_members m JOIN users u ON u.id = m.user_id
       WHERE m.room_id = $1 AND m.role = 'moderator' AND u.status = 'active'
       ORDER BY m.joined_at, m.user_id LIMIT 1`,
      [room.id],
    );
    if (successor) {
      await q(`UPDATE rooms SET owner_id = $2, updated_at = now() WHERE id = $1`, [room.id, successor.user_id]);
      await q(`UPDATE room_members SET role = 'member' WHERE room_id = $1 AND user_id = $2`, [room.id, bannedOwnerId]);
      await q(`UPDATE room_members SET role = 'owner' WHERE room_id = $1 AND user_id = $2`, [room.id, successor.user_id]);
      await notifyDecision(q, successor.user_id, `Vous devenez propriétaire du salon « ${room.name} » : son ancien propriétaire a été banni de la plateforme.`);
    } else {
      await q(`UPDATE rooms SET archived_at = now(), updated_at = now() WHERE id = $1`, [room.id]);
      const admins = await q<{ id: string }>(`SELECT id FROM users WHERE (role = 'admin' OR lower(email) = ANY($2::text[])) AND status = 'active'
        AND handle IS NOT NULL AND rules_accepted_at IS NOT NULL AND id <> $1`, [bannedOwnerId, configuredAdminEmails()]);
      for (const admin of admins) {
        await notifyDecision(q, admin.id, `Le salon « ${room.name} » a été archivé : son propriétaire est banni et aucun modérateur ne pouvait reprendre.`);
      }
    }
    await logRevision(q, {
      entity: "room",
      entityId: room.id,
      reason: successor ? "Propriété transférée au modérateur le plus ancien (propriétaire banni)" : "Salon archivé (propriétaire banni, aucun modérateur)",
      actorLabel: "modération",
    });
  }
}

/** Notification motivée de la décision (jamais le nom du signalant). */
async function notifyDecision(q: Query, targetUserId: string, body: string) {
  await q(`INSERT INTO notifications (user_id, kind, body) VALUES ($1, 'moderation', $2)`, [targetUserId, body]);
}

/**
 * Révocation immédiate des connexions temps réel : un événement `revoke` par salon du
 * membre (D5 §4.3). La suspension garde la session (lecture publique possible, durée et
 * motif affichés au membre) ; seul le BANNISSEMENT ferme en plus toutes les sessions.
 */
async function revokeStreams(q: Query, userId: string) {
  const rooms = await q<{ room_id: string }>(`SELECT room_id FROM room_members WHERE user_id = $1`, [userId]);
  for (const r of rooms) await emitRevocation(q, r.room_id, userId);
}

export async function moderate(db: Db, input: ModerationInput): Promise<Outcome<{ actionId: string }>> {
  return db.transaction(async (q) => {
    await lockCommunity(q, true);
    if (!(await activeContributor(q, input.moderatorId))) return refuse("droit", "Compte de modération indisponible.");
    // Verrou de la ligne utilisateur : les décisions sur un même compte sont sérialisées,
    // et les écritures métier (qui relisent/verrouillent ce compte, ACC03) attendent le commit.
    const [target] = await q<{ status: string; role: string }>(`SELECT status, role FROM users WHERE id = $1 FOR UPDATE`, [input.targetUserId]);
    if (!target || target.status === "deleted") return refuse("introuvable", "Membre introuvable.");
    if (input.targetUserId === input.moderatorId) return refuse("soi", "On ne se modère pas soi-même.");

    if (input.kind === "remove_content") {
      if (!input.contentKind || !input.contentId) return refuse("contenu", "Contenu à retirer manquant.");
      if (input.contentKind === "post") {
        const rows = await q(`UPDATE posts SET status = 'removed', edited_at = now() WHERE id = $1 AND author_id = $2 AND status = 'published' RETURNING id`, [input.contentId, input.targetUserId]);
        // SEC-04 : le retrait par la modération emporte aussi la synthèse IA dérivée.
        if (rows.length) await purgeSynthesis(q, input.contentId);
        if (!rows.length) return refuse("contenu", "Publication introuvable ou déjà retirée.");
      } else if (input.contentKind === "comment") {
        const rows = await q(`UPDATE comments SET status = 'removed' WHERE id = $1 AND author_id = $2 AND status = 'published' RETURNING id`, [input.contentId, input.targetUserId]);
        if (!rows.length) return refuse("contenu", "Commentaire introuvable ou déjà retiré.");
      } else {
        const rows = await q(
          `UPDATE room_messages SET deleted_at = now(), deleted_by = $3, delete_reason = $4 WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL RETURNING room_id`,
          [input.contentId, input.targetUserId, input.moderatorId, input.reason],
        );
        if (!rows.length) return refuse("contenu", "Message introuvable ou déjà retiré.");
        await appendRoomEvent(q, rows[0].room_id as string, "delete", { messageId: input.contentId, payload: { moderation: true } });
      }
      await notifyDecision(q, input.targetUserId, `Un de vos contenus a été retiré par la modération. Motif : ${input.reason}`);
    } else if (input.kind === "lift") {
      // ACC02 : la levée vise UNE sanction précise ; le statut est ensuite recalculé
      // depuis les sanctions restantes (jamais de retour aveugle à « active »).
      if (!input.actionId) return refuse("sanction", "Indiquer la sanction à lever.");
      const revoked = await q(
        `UPDATE moderation_actions SET revoked_at = now(), revoked_by = $3, revoked_reason = $4
         WHERE id = $1 AND target_user_id = $2 AND kind IN ('suspend', 'ban') AND revoked_at IS NULL RETURNING id`,
        [input.actionId, input.targetUserId, input.moderatorId, input.reason],
      );
      if (!revoked.length) return refuse("etat", "Sanction introuvable, déjà levée, ou d'un autre type.");
      const status = await applyEffectiveStatus(q, input.targetUserId);
      await notifyDecision(
        q,
        input.targetUserId,
        `Une de vos sanctions est levée. ${input.reason}${status !== "active" ? " D'autres sanctions restent applicables." : ""}`,
      );
    }

    // L'action est enregistrée AVANT les effets de statut : l'état effectif se calcule
    // depuis les sanctions persistées, dans la même transaction.
    const [action] = await q<{ id: string }>(
      `INSERT INTO moderation_actions (moderator_id, target_user_id, report_id, kind, content_kind, content_id, reason, duration_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [input.moderatorId, input.targetUserId, input.reportId ?? null, input.kind, input.contentKind ?? null, input.contentId ?? null, input.reason, input.durationDays ?? null],
    );

    if (input.kind === "warn") {
      await notifyDecision(q, input.targetUserId, `Avertissement de la modération : ${input.reason}`);
    } else if (input.kind === "suspend") {
      await applyEffectiveStatus(q, input.targetUserId);
      await revokeStreams(q, input.targetUserId);
      const until = input.durationDays ? new Date(Date.now() + input.durationDays * 86_400_000) : null;
      await notifyDecision(
        q,
        input.targetUserId,
        `Votre compte est suspendu${until ? ` jusqu'au ${until.toISOString().slice(0, 10)}` : ""}. Motif : ${input.reason}. Vous pouvez contester cette décision dans les 14 jours (page Mes sanctions).`,
      );
    } else if (input.kind === "ban") {
      await applyEffectiveStatus(q, input.targetUserId);
      await revokeStreams(q, input.targetUserId);
      // Le bannissement ferme en plus toutes les sessions et empêche toute nouvelle connexion.
      await q(`DELETE FROM sessions WHERE user_id = $1`, [input.targetUserId]);
      // ACC04 (D5 §4.1) : succession ou archivage des salons possédés.
      await resolveOwnedRooms(q, input.targetUserId);
      await notifyDecision(
        q,
        input.targetUserId,
        `Votre compte est banni de la plateforme. Motif : ${input.reason}. Vous pouvez contester cette décision dans les 14 jours via la page de contestation (lien sur l'écran de connexion).`,
      );
    }
    if (input.reportId) {
      await q(`UPDATE reports SET status = 'handled', handled_by = $2, handled_at = now(), decision = $3 WHERE id = $1 AND status = 'open'`, [
        input.reportId,
        input.moderatorId,
        `${input.kind} : ${input.reason}`,
      ]);
    }
    return { ok: true, actionId: action.id };
  });
}

/** Classement sans suite d'un signalement. */
export async function dismissReport(q: Query, reportId: string, moderatorId: string, reason: string): Promise<boolean> {
  const rows = await q(`UPDATE reports SET status = 'handled', handled_by = $2, handled_at = now(), decision = $3 WHERE id = $1 AND status = 'open' RETURNING id`, [
    reportId,
    moderatorId,
    `sans_suite : ${reason}`,
  ]);
  return rows.length > 0;
}

// ─────────────── Contestation (D35) ───────────────

export const APPEAL_WINDOW_DAYS = 14;

export async function appealSanction(q: Query, args: { actionId: string; userId: string; body: string }): Promise<Outcome<{ appealId: string }>> {
  const [action] = await q(`SELECT * FROM moderation_actions WHERE id = $1`, [args.actionId]);
  if (!action || action.target_user_id !== args.userId) return refuse("introuvable", "Sanction introuvable.");
  if (!["warn", "suspend", "ban", "remove_content"].includes(action.kind as string)) return refuse("etat", "Cette action ne se conteste pas.");
  const ageDays = (Date.now() - new Date(action.created_at as string).getTime()) / 86_400_000;
  if (ageDays > APPEAL_WINDOW_DAYS) return refuse("delai", `Le délai de contestation (${APPEAL_WINDOW_DAYS} jours) est dépassé.`);
  const inserted = await q<{ id: string }>(
    `INSERT INTO sanction_appeals (action_id, user_id, body) VALUES ($1, $2, $3) ON CONFLICT (action_id) DO NOTHING RETURNING id`,
    [args.actionId, args.userId, args.body],
  );
  if (!inserted[0]) return refuse("deja", "Une contestation existe déjà pour cette sanction (une seule par sanction).");
  return { ok: true, appealId: inserted[0].id };
}

/**
 * Décision sur une contestation : par une AUTRE personne que l'auteur de la sanction
 * quand c'est possible (refusé si un autre administrateur actif existe). Réponse motivée,
 * tracée, notifiée. La sanction restait active pendant l'examen.
 */
export async function decideAppeal(
  db: Db,
  args: { appealId: string; moderatorId: string; decision: "maintenue" | "levee"; reason: string; adminEmails?: string[] },
): Promise<Outcome> {
  return db.transaction(async (q) => {
    await lockCommunity(q, true);
    if (!(await activeContributor(q, args.moderatorId))) return refuse("droit", "Compte de modération indisponible.");
    const [appeal] = await q(
      `SELECT a.*, act.moderator_id AS sanction_author, act.target_user_id, act.kind FROM sanction_appeals a
       JOIN moderation_actions act ON act.id = a.action_id WHERE a.id = $1 FOR UPDATE`,
      [args.appealId],
    );
    if (!appeal) return refuse("introuvable", "Contestation introuvable.");
    if (appeal.decided_at) return refuse("etat", "Contestation déjà tranchée.");
    if (appeal.sanction_author === args.moderatorId) {
      // ACC09 : les administrateurs se résolvent par rôle ET par ADMIN_EMAILS, comme à l'authentification.
      const emails = (args.adminEmails ?? configuredAdminEmails()).map((e) => e.trim().toLowerCase()).filter(Boolean);
      const [other] = await q(
        `SELECT id FROM users WHERE status = 'active' AND id <> $1 AND handle IS NOT NULL AND rules_accepted_at IS NOT NULL
           AND (role = 'admin' OR (email IS NOT NULL AND lower(email) = ANY($2::text[]))) LIMIT 1`,
        [args.moderatorId, emails],
      );
      if (other) return refuse("examinateur", "La contestation doit être examinée par une autre personne que l'auteur de la sanction.");
    }
    await q(`UPDATE sanction_appeals SET decided_by = $2, decided_at = now(), decision = $3, decision_reason = $4 WHERE id = $1`, [
      args.appealId,
      args.moderatorId,
      args.decision,
      args.reason,
    ]);
    let residual = false;
    if (args.decision === "levee" && (appeal.kind === "suspend" || appeal.kind === "ban")) {
      // ACC02 : seule LA sanction contestée est levée ; le statut est recalculé depuis
      // les sanctions restantes (une sanction plus récente reste pleinement applicable).
      await q(
        `UPDATE moderation_actions SET revoked_at = now(), revoked_by = $2, revoked_reason = $3 WHERE id = $1 AND revoked_at IS NULL`,
        [appeal.action_id, args.moderatorId, `Contestation acceptée : ${args.reason}`],
      );
      residual = (await applyEffectiveStatus(q, appeal.target_user_id as string)) !== "active";
    }
    await notifyDecision(
      q,
      appeal.target_user_id as string,
      `Votre contestation est ${args.decision === "levee" ? "acceptée : la sanction contestée est levée" : "rejetée : la sanction est maintenue"}. ${args.reason}${residual ? " D'autres sanctions restent applicables." : ""}`,
    );
    return { ok: true };
  });
}

// ─────────────── Contestation d'un compte banni, sans session (ACC09) ───────────────
// Un bannissement ferme toutes les sessions et interdit la connexion ; la contestation
// reste pourtant un droit (14 jours). Un JETON DE CONTESTATION dédié, demandé par
// l'adresse e-mail du compte, à durée courte et haché en base, donne accès à la SEULE
// page de contestation — il n'ouvre aucune session et ne rétablit aucun accès communautaire.

export const APPEAL_TOKEN_MINUTES = 60;

const hashAppealToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Jeton de contestation pour un compte BANNI uniquement ; null sinon (la route répond de façon générique). */
export async function createAppealToken(q: Query, email: string): Promise<{ token: string } | null> {
  const [user] = await q<{ id: string; status: string }>(`SELECT id, status FROM users WHERE lower(email) = lower($1)`, [email.trim()]);
  if (!user || user.status !== "banned") return null;
  const token = randomBytes(24).toString("base64url");
  // Rétention (RGPD) : 7 jours de marge pour la limite de fréquence (lib/limits.ts), puis purge.
  await q(`DELETE FROM appeal_tokens WHERE expires_at < now() - interval '7 days'`);
  await q(`INSERT INTO appeal_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`, [
    user.id,
    hashAppealToken(token),
    APPEAL_TOKEN_MINUTES,
  ]);
  return { token };
}

/** Compte derrière un jeton de contestation encore valide (non utilisé, non expiré), sinon null. */
export async function appealTokenUser(q: Query, token: string): Promise<{ userId: string } | null> {
  const [row] = await q<{ user_id: string }>(
    `SELECT user_id FROM appeal_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hashAppealToken(token)],
  );
  return row ? { userId: row.user_id } : null;
}

/** Consomme le jeton après une contestation déposée (usage unique). */
export async function consumeAppealToken(q: Query, token: string) {
  await q(`UPDATE appeal_tokens SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL`, [hashAppealToken(token)]);
}

/** Lecture, dépôt et consommation atomiques ; un refus métier conserve le jeton. */
export async function appealWithToken(db: Db, args: { token: string; actionId: string; body: string }): Promise<Outcome<{ appealId: string }>> {
  return db.transaction(async (q) => {
    const [holder] = await q<{ user_id: string }>(
      `SELECT user_id FROM appeal_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
      [hashAppealToken(args.token)],
    );
    if (!holder) return refuse("jeton", "Lien de contestation expiré ou déjà utilisé : demandez-en un nouveau.");
    const result = await appealSanction(q, { actionId: args.actionId, userId: holder.user_id, body: args.body });
    if (result.ok) await consumeAppealToken(q, args.token);
    return result;
  });
}

/** Contestations ouvertes (modération). */
export async function listOpenAppeals(q: Query): Promise<Row[]> {
  return q(
    `SELECT a.id, a.body, a.created_at, act.kind, act.reason AS sanction_reason, act.moderator_id AS sanction_author,
            u.handle AS target_handle, u.display_name AS target_name
     FROM sanction_appeals a
     JOIN moderation_actions act ON act.id = a.action_id
     JOIN users u ON u.id = a.user_id
     WHERE a.decided_at IS NULL ORDER BY a.created_at`,
  );
}

/** Sanctions du membre connecté, avec l'état de leur contestation (page personnelle). */
export async function mySanctions(q: Query, userId: string): Promise<Row[]> {
  return q(
    `SELECT act.id, act.kind, act.reason, act.duration_days, act.created_at,
            a.id AS appeal_id, a.created_at AS appeal_at, a.decision, a.decision_reason
     FROM moderation_actions act
     LEFT JOIN sanction_appeals a ON a.action_id = act.id
     WHERE act.target_user_id = $1 AND act.kind IN ('warn', 'suspend', 'ban', 'remove_content')
     ORDER BY act.created_at DESC LIMIT 50`,
    [userId],
  );
}
