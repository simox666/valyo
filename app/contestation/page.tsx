import type { Metadata } from "next";
import { db } from "@/lib/db";
import { appealTokenUser, mySanctions } from "@/lib/social/moderation.ts";
import { LocalTime } from "@/components/LocalTime";
import { AccessRequestForm, TokenAppealForm } from "./ContestationForms";

export const metadata: Metadata = { title: "Contester une sanction", robots: { index: false } };

const KIND_LABELS: Record<string, string> = {
  warn: "Avertissement",
  suspend: "Suspension",
  ban: "Bannissement",
  remove_content: "Retrait d'un contenu",
};

// Contestation d'un compte BANNI (ACC09, D35) : accès par jeton dédié à durée courte,
// qui n'ouvre aucune session et ne montre QUE les sanctions du compte. Les comptes
// actifs ou suspendus passent par /sanctions avec leur session.
export default async function ContestationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const holder = token ? await appealTokenUser(db.query, token) : null;
  const sanctions = holder ? await mySanctions(db.query, holder.userId) : [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-[28px]">Contester une sanction</h1>
      {!holder ? (
        <div className="card space-y-3 p-5">
          <p className="text-soft">
            Un compte banni ne peut plus se connecter, mais garde le droit de contester sa sanction dans les 14 jours (une fois par
            sanction). Indiquez l’adresse e-mail du compte : un lien de contestation à durée limitée lui sera envoyé. Ce lien n’ouvre
            aucune session et ne rétablit aucun accès.
          </p>
          {token && <p role="alert" className="error-text">Lien de contestation expiré ou déjà utilisé : demandez-en un nouveau.</p>}
          <AccessRequestForm />
          <p className="text-sm text-soft">Compte actif ou suspendu : utilisez plutôt la page « Mes sanctions » après connexion.</p>
        </div>
      ) : (
        <div className="card p-5">
          <p className="text-soft">Sanctions de votre compte. La sanction reste active pendant l’examen d’une contestation.</p>
          {sanctions.length === 0 ? (
            <p className="mt-3 text-soft">Aucune décision de modération ne concerne ce compte.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {sanctions.map((s) => (
                <li key={s.id as string} className="py-3">
                  <p className="font-semibold">
                    {KIND_LABELS[s.kind as string] ?? (s.kind as string)}
                    {s.duration_days ? ` (${s.duration_days} jours)` : ""} — <LocalTime iso={new Date(s.created_at as string).toISOString()} mode="full" />
                  </p>
                  <p className="text-sm text-soft">Motif : {s.reason as string}</p>
                  {s.appeal_id ? (
                    <p className="mt-1 text-sm">
                      Contestation déjà déposée —{" "}
                      {s.decision
                        ? `décision : ${s.decision === "levee" ? "sanction levée" : "sanction maintenue"} (${s.decision_reason as string})`
                        : "en cours d'examen"}
                    </p>
                  ) : (
                    <TokenAppealForm actionId={s.id as string} token={token!} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
