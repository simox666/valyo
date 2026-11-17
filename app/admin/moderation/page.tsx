import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { REPORT_REASON_LABELS, listOpenAppeals, listOpenReports } from "@/lib/social/moderation.ts";
import { LocalTime } from "@/components/LocalTime";
import { AppealDecision, LiftSanction, ReportActions } from "./ModerationForms";

export const metadata: Metadata = { title: "Modération", robots: { index: false } };

const KIND_LABELS: Record<string, string> = { post: "Publication", comment: "Commentaire", message: "Message de salon", member: "Membre" };

// File de modération (D32-D35). Réservée aux administrateurs (modérateurs de plateforme).
// Le nom du signalant n'apparaît qu'ici, jamais côté public.
export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  const [reports, appeals, reportsForTargets, sanctions] = await Promise.all([
    listOpenReports(db.query),
    listOpenAppeals(db.query),
    db.query(`SELECT r.id, r.target_user_id FROM reports r WHERE r.status = 'open'`),
    db.query(`SELECT a.id, a.target_user_id, a.kind, a.reason, u.display_name FROM moderation_actions a
      JOIN users u ON u.id = a.target_user_id WHERE a.kind IN ('suspend', 'ban') AND a.revoked_at IS NULL
      AND u.status <> 'deleted' AND (a.duration_days IS NULL OR a.created_at + make_interval(days => a.duration_days) > now())
      ORDER BY a.created_at DESC LIMIT 50`),
  ]);
  const targetByReport = new Map(reportsForTargets.map((r) => [r.id as string, (r.target_user_id as string) ?? null]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Modération</h1>
        <p className="mt-1 text-neutral-600">
          Signalements et contestations. Chaque action est journalisée et notifiée avec son motif ; l’identité du signalant reste confidentielle.
        </p>
        <Link href="/admin/editorial" className="btn-link mt-1 inline-block">Console de l’agent éditorial →</Link>
      </div>

      <section className="card p-5" aria-labelledby="signalements">
        <h2 id="signalements" className="text-lg font-bold">Signalements ouverts ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-neutral-600">Aucun signalement en attente.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {reports.map((r) => (
              <li key={r.id as string} className="py-3">
                <p>
                  <span className="chip">{KIND_LABELS[r.target_kind as string] ?? (r.target_kind as string)}</span>{" "}
                  <span className="font-semibold">{REPORT_REASON_LABELS[r.reason as keyof typeof REPORT_REASON_LABELS]}</span>
                  {r.target_name ? <> — visé : {r.target_name as string} (@{r.target_handle as string})</> : null}
                  <span className="ml-2 text-sm text-neutral-500">
                    signalé par @{r.reporter_handle as string} · <LocalTime iso={new Date(r.created_at as string).toISOString()} mode="full" />
                  </span>
                </p>
                {r.details ? <p className="mt-1 text-sm text-neutral-700">« {r.details as string} »</p> : null}
                {(r.target_kind === "post" || r.target_kind === "comment") && (
                  <p className="text-sm">
                    <Link href={`/p/${r.target_kind === "post" ? (r.target_id as string) : ""}`} className="btn-link">
                      Voir le contenu public
                    </Link>
                  </p>
                )}
                <ReportActions
                  reportId={r.id as string}
                  targetUserId={targetByReport.get(r.id as string) ?? null}
                  targetKind={r.target_kind as string}
                  targetId={r.target_id as string}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="sanctions-actives">
        <h2 id="sanctions-actives" className="text-lg font-bold">Sanctions actives (50 dernières au maximum)</h2>
        {!sanctions.length ? <p className="mt-2 text-neutral-600">Aucune sanction active.</p> : <ul className="divide-y divide-line">
          {sanctions.map((s) => <li className="py-3" key={s.id as string}>
            <p className="font-semibold">{s.display_name as string} · {s.kind === "ban" ? "Bannissement" : "Suspension"}</p>
            <p className="text-sm">{s.reason as string}</p>
            <LiftSanction actionId={s.id as string} targetUserId={s.target_user_id as string} />
          </li>)}
        </ul>}
      </section>

      <section className="card p-5" aria-labelledby="contestations">
        <h2 id="contestations" className="text-lg font-bold">Contestations ouvertes ({appeals.length})</h2>
        <p className="mt-1 text-sm text-neutral-600">
          À examiner par une autre personne que l’auteur de la sanction quand c’est possible ; la sanction reste active pendant l’examen.
        </p>
        {appeals.length === 0 ? (
          <p className="mt-2 text-neutral-600">Aucune contestation en attente.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {appeals.map((a) => (
              <li key={a.id as string} className="py-3">
                <p>
                  <span className="font-semibold">{a.target_name as string}</span> conteste : {a.kind as string} — motif initial : {a.sanction_reason as string}
                </p>
                <p className="mt-1 text-sm text-neutral-700">« {a.body as string} »</p>
                <AppealDecision appealId={a.id as string} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
