// Limites de fréquence (decisions.md §4.6, D6). Module sans dépendance serveur
// pour être testé directement (tests/limits.test.ts).
//
// Atomicité (anomalie A002) : le comptage et l'écriture se font dans une même
// transaction, après un verrou consultatif par action et par cible
// (pg_advisory_xact_lock). Deux requêtes simultanées pour la même cible sont
// donc sérialisées : la seconde voit l'écriture de la première.

export type LimitAction = "loginLink" | "post" | "comment" | "roomCreate" | "roomInvite" | "roomMessage" | "report" | "directMessage" | "roomAudio";

export interface LimitRule {
  max: number;
  windowMinutes: number;
}

// Valeurs par défaut, modifiables par variable d'environnement sans changer le code.
const DEFAULTS: Record<LimitAction, { env: string; max: number; windowMinutes: number }> = {
  loginLink: { env: "LIMIT_LOGIN_LINKS_PER_HOUR", max: 5, windowMinutes: 60 },
  post: { env: "LIMIT_POSTS_PER_HOUR", max: 10, windowMinutes: 60 },
  comment: { env: "LIMIT_COMMENTS_PER_HOUR", max: 60, windowMinutes: 60 },
  // D6 : 5 créations de salon par jour et par membre ; 20 invitations par jour et par salon.
  roomCreate: { env: "LIMIT_ROOMS_PER_DAY", max: 5, windowMinutes: 24 * 60 },
  roomInvite: { env: "LIMIT_ROOM_INVITES_PER_DAY", max: 20, windowMinutes: 24 * 60 },
  // D6 : 20 messages par minute, par salon et par membre. Cible : "<salon>:<membre>".
  roomMessage: { env: "LIMIT_ROOM_MESSAGES_PER_MINUTE", max: 20, windowMinutes: 1 },
  report: { env: "LIMIT_REPORTS_PER_DAY", max: 20, windowMinutes: 24 * 60 },
  directMessage: { env: "LIMIT_DIRECT_MESSAGES_PER_HOUR", max: 120, windowMinutes: 60 },
  // Messages vocaux : 40 par jour et par membre, tous salons confondus (ils occupent du disque).
  roomAudio: { env: "LIMIT_ROOM_AUDIO_PER_DAY", max: 40, windowMinutes: 24 * 60 },
};

export function limitRule(action: LimitAction): LimitRule {
  const { env, max, windowMinutes } = DEFAULTS[action];
  const configured = Number.parseInt(process.env[env] ?? "", 10);
  return { max: Number.isFinite(configured) && configured > 0 ? configured : max, windowMinutes };
}

// $1 : cible (adresse e-mail ou identifiant du membre), $2 : fenêtre en minutes.
const COUNT_SQL: Record<LimitAction, string> = {
  loginLink: `SELECT count(*)::int AS n FROM (
    SELECT created_at FROM login_tokens WHERE lower(email) = lower($1)
    UNION ALL
    SELECT a.created_at FROM appeal_tokens a JOIN users u ON u.id = a.user_id WHERE lower(u.email) = lower($1)
  ) requests WHERE created_at > now() - make_interval(mins => $2)`,
  post: `SELECT count(*)::int AS n FROM posts WHERE author_id = $1::uuid AND created_at > now() - make_interval(mins => $2)`,
  comment: `SELECT count(*)::int AS n FROM comments WHERE author_id = $1::uuid AND created_at > now() - make_interval(mins => $2)`,
  roomCreate: `SELECT count(*)::int AS n FROM rooms WHERE owner_id = $1::uuid AND created_at > now() - make_interval(mins => $2)`,
  roomInvite: `SELECT count(*)::int AS n FROM room_invitations WHERE room_id = $1::uuid AND created_at > now() - make_interval(mins => $2)`,
  roomMessage: `SELECT count(*)::int AS n FROM room_messages
    WHERE room_id = split_part($1, ':', 1)::uuid AND author_id = split_part($1, ':', 2)::uuid
      AND created_at > now() - make_interval(mins => $2)`,
  report: `SELECT count(*)::int AS n FROM reports WHERE reporter_id = $1::uuid AND created_at > now() - make_interval(mins => $2)`,
  directMessage: `SELECT count(*)::int AS n FROM direct_messages WHERE sender_id = $1::uuid AND created_at > now() - make_interval(mins => $2)`,
  roomAudio: `SELECT count(*)::int AS n FROM room_audio WHERE author_id = $1::uuid AND created_at > now() - make_interval(mins => $2)`,
};

type Row = Record<string, unknown>;
export type Query = <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;
export type Transaction = <R>(fn: (q: Query) => Promise<R>) => Promise<R>;

export type LimitedResult<T> = { ok: true; value: T } | { ok: false; rule: LimitRule };

export async function runLimited<T>(
  transaction: Transaction,
  action: LimitAction,
  subject: string,
  write: (q: Query) => Promise<T>,
): Promise<LimitedResult<T>> {
  const rule = limitRule(action);
  return transaction(async (q) => {
    await q(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`limit:${action}:${subject.toLowerCase()}`]);
    const [row] = await q(COUNT_SQL[action], [subject, rule.windowMinutes]);
    if (Number(row?.n ?? 0) >= rule.max) return { ok: false as const, rule };
    return { ok: true as const, value: await write(q) };
  });
}

export function limitMessage(action: LimitAction, rule: LimitRule): string {
  const what = {
    loginLink: "demandes de lien pour cette adresse",
    post: "publications",
    comment: "commentaires",
    roomCreate: "créations de salon",
    roomInvite: "invitations pour ce salon",
    roomMessage: "messages dans ce salon",
    report: "signalements",
    directMessage: "messages privés",
    roomAudio: "messages vocaux",
  }[action];
  const window = rule.windowMinutes >= 24 * 60 ? "par jour" : rule.windowMinutes <= 1 ? "par minute" : "par heure";
  return `Limite atteinte : ${rule.max} ${what} ${window}. Réessayez plus tard.`;
}
