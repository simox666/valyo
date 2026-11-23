import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listInvitations, memberInviteQuota, registrationMode, type InvitationView } from "@/lib/social/invitations.ts";
import { LocalTime } from "@/components/LocalTime";
import { CreateInvitation, RevokeInvitation } from "./InviteManager";

export const metadata: Metadata = { title: "Inviter des proches", robots: { index: false } };

const STATE: Record<InvitationView["state"], { label: string; cls: string }> = {
  active: { label: "En attente", cls: "bg-accent-soft text-accent" },
  utilisee: { label: "A rejoint Valyo", cls: "bg-accent text-white" },
  revoquee: { label: "Révoquée", cls: "bg-chip text-soft" },
  expiree: { label: "Expirée", cls: "bg-chip text-soft" },
};

function InvitationRow({ inv, showCreator }: { inv: InvitationView; showCreator?: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATE[inv.state].cls}`}>{STATE[inv.state].label}</span>
          <span className="font-semibold">{inv.note || "Sans note"}</span>
        </p>
        <p className="mt-1 text-xs text-soft">
          {showCreator && inv.creatorName ? <>Par {inv.creatorName} · </> : null}
          Créée <LocalTime iso={inv.createdAt} />
          {inv.state === "active" && <> · expire <LocalTime iso={inv.expiresAt} mode="full" /></>}
          {inv.usedByHandle && <> · <Link href={`/m/${inv.usedByHandle}`} className="btn-link">{inv.usedByName}</Link></>}
        </p>
      </div>
      {inv.state === "active" && <RevokeInvitation id={inv.id} />}
    </li>
  );
}

export default async function InvitePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/inviter");
  if (!user.onboarded) redirect("/bienvenue?next=/inviter");
  const [mine, all] = await Promise.all([
    listInvitations(db.query, { creatorId: user.id }),
    user.isAdmin ? listInvitations(db.query) : Promise.resolve([]),
  ]);
  const used = mine.filter((i) => i.state !== "revoquee").length;
  const remaining = user.isAdmin ? null : Math.max(0, memberInviteQuota() - used);
  const joined = mine.filter((i) => i.state === "utilisee").length;
  const mode = registrationMode();

  return (
    <div className="wide-page space-y-6">
      <header className="rounded-card bg-ink p-5 text-white sm:p-6">
        <p className="label-mono text-white/70">Bêta</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Inviter des proches</h1>
        <p className="mt-2 max-w-2xl text-white/85">
          {mode === "invitation"
            ? "Valyo est pour l’instant sur invitation. Invitez des personnes curieuses qui aimeront en discuter : c’est ce qui fera vivre la communauté."
            : "Les inscriptions sont ouvertes, mais une invitation personnelle reste la meilleure façon de faire venir quelqu’un."}
        </p>
        {joined > 0 && <p className="mt-3 text-sm font-semibold">{joined} personne{joined > 1 ? "s ont" : " a"} déjà rejoint Valyo grâce à vous.</p>}
      </header>

      {user.status !== "active" ? (
        <p className="card p-5 text-soft">Votre compte ne peut pas inviter pour le moment.</p>
      ) : (
        <section className="card p-5 sm:p-6" aria-labelledby="nouvelle-invitation">
          <h2 id="nouvelle-invitation" className="mb-3 text-lg font-bold">Nouvelle invitation</h2>
          <CreateInvitation remaining={remaining} />
        </section>
      )}

      <section className="card p-5 sm:p-6" aria-labelledby="mes-invitations">
        <h2 id="mes-invitations" className="text-lg font-bold">Mes invitations</h2>
        {mine.length ? (
          <ul className="mt-1 divide-y divide-line">{mine.map((inv) => <InvitationRow key={inv.id} inv={inv} />)}</ul>
        ) : (
          <p className="mt-2 text-sm text-soft">Vous n’avez encore invité personne.</p>
        )}
      </section>

      {user.isAdmin && (
        <section className="card p-5 sm:p-6" aria-labelledby="toutes-invitations">
          <h2 id="toutes-invitations" className="text-lg font-bold">Toutes les invitations (administration)</h2>
          <p className="mt-1 text-sm text-soft">
            Mode d’inscription : <strong>{mode === "invitation" ? "sur invitation" : "ouvert"}</strong> (variable <code>INSCRIPTIONS</code>). Quota par membre : {memberInviteQuota()}.
          </p>
          {all.length ? (
            <ul className="mt-1 divide-y divide-line">{all.map((inv) => <InvitationRow key={inv.id} inv={inv} showCreator />)}</ul>
          ) : (
            <p className="mt-2 text-sm text-soft">Aucune invitation.</p>
          )}
        </section>
      )}
    </div>
  );
}
