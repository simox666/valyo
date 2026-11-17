import type { Query } from "../editorial/types.ts";

// Avis des testeurs de la bêta : bug, idée ou autre, avec la page concernée.
// Ouvert aux membres connectés (même suspendus : un avis n'est pas une contribution publique),
// limité à 10 par jour. Lu et traité par l'administration uniquement.

export const FEEDBACK_KINDS = ["bug", "idee", "autre"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_LABELS: Record<FeedbackKind, string> = { bug: "Quelque chose ne marche pas", idee: "Une idée", autre: "Autre remarque" };
export const FEEDBACK_PER_DAY = 10;

export async function createFeedback(
  q: Query,
  args: { userId: string; kind: FeedbackKind; body: string; page: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  await q(`SELECT pg_advisory_xact_lock(hashtext('feedback:' || $1::text))`, [args.userId]);
  const [{ n }] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM feedback WHERE user_id = $1 AND created_at > now() - interval '1 day'`,
    [args.userId],
  );
  if (Number(n) >= FEEDBACK_PER_DAY) return { ok: false, message: `Merci ! Vous avez déjà envoyé ${FEEDBACK_PER_DAY} avis aujourd’hui ; réessayez demain.` };
  await q(`INSERT INTO feedback (user_id, kind, body, page) VALUES ($1, $2, $3, $4)`, [args.userId, args.kind, args.body.trim(), args.page.slice(0, 300)]);
  return { ok: true };
}

export async function listFeedback(q: Query, status: "nouveau" | "traite" | "tous" = "tous") {
  const rows = await q(
    `SELECT f.*, u.handle, COALESCE(u.display_name, u.handle) AS name FROM feedback f LEFT JOIN users u ON u.id = f.user_id
     WHERE ($1 = 'tous' OR f.status = $1) ORDER BY f.status = 'traite', f.created_at DESC LIMIT 200`,
    [status],
  );
  return rows.map((r) => ({
    id: r.id as string,
    kind: r.kind as FeedbackKind,
    body: r.body as string,
    page: (r.page as string) ?? "",
    status: r.status as "nouveau" | "traite",
    createdAt: new Date(r.created_at as string).toISOString(),
    handle: (r.handle as string) ?? null,
    name: (r.name as string) ?? "Compte supprimé",
  }));
}

export async function setFeedbackStatus(q: Query, id: string, status: "nouveau" | "traite"): Promise<boolean> {
  return (await q(`UPDATE feedback SET status = $2 WHERE id = $1 RETURNING id`, [id, status])).length > 0;
}
