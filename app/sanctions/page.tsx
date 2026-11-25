import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mySanctions } from "@/lib/social/moderation.ts";
import { LocalTime } from "@/components/LocalTime";
import { AppealForm } from "./AppealForm";

export const metadata: Metadata = { title: "Mes sanctions", robots: { index: false } };

const KIND_LABELS: Record<string, string> = {
  warn: "Avertissement",
  suspend: "Suspension",
  ban: "Bannissement",
  remove_content: "Retrait d'un contenu",
};

// Sanctions du compte connecté (D33, D35) : motif affiché, contestation possible
// dans les 14 jours, une seule fois par sanction. Accessible à un compte suspendu.
export default async function SanctionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/sanctions");
  const sanctions = await mySanctions(db.query, user.id);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-[28px]">Mes sanctions</h1>
      {user.status === "suspended" && (
        <p role="alert" className="card border-amber-300 bg-amber-50 p-3">
          Votre compte est actuellement suspendu : la lecture reste possible, pas la contribution.
        </p>
      )}
      {sanctions.length === 0 ? (
        <p className="card p-5 text-soft">Aucune décision de modération ne concerne votre compte.</p>
      ) : (
        <ul className="card divide-y divide-line p-5">
          {sanctions.map((s) => (
            <li key={s.id as string} className="py-3">
              <p className="font-semibold">
                {KIND_LABELS[s.kind as string] ?? (s.kind as string)}
                {s.duration_days ? ` (${s.duration_days} jours)` : ""} — <LocalTime iso={new Date(s.created_at as string).toISOString()} mode="full" />
              </p>
              <p className="text-sm text-soft">Motif : {s.reason as string}</p>
              {s.appeal_id ? (
                <p className="mt-1 text-sm">
                  Contestation envoyée le <LocalTime iso={new Date(s.appeal_at as string).toISOString()} mode="full" /> —{" "}
                  {s.decision ? (
                    <>décision : <span className="font-semibold">{s.decision === "levee" ? "sanction levée" : "sanction maintenue"}</span> ({s.decision_reason as string})</>
                  ) : (
                    "en cours d'examen (la sanction reste active pendant l'examen)"
                  )}
                </p>
              ) : (
                <div className="mt-1">
                  <AppealForm actionId={s.id as string} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
