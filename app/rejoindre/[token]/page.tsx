import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { validInvitation } from "@/lib/social/invitations.ts";
import { LoginForm } from "@/app/connexion/LoginForm";

export const metadata: Metadata = { title: "Invitation à rejoindre Valyo", robots: { index: false } };

// Arrivée d'une personne invitée à la bêta. L'invitation n'est consommée qu'à la création
// effective du compte (après le clic sur le lien reçu par e-mail).
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/");
  if (user) redirect("/bienvenue");
  const invitation = await validInvitation(db.query, token);

  if (!invitation) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Invitation indisponible</h1>
        <p className="text-neutral-700">
          Ce lien d’invitation a déjà servi, a été révoqué ou a expiré. Demandez-en un nouveau à la personne qui vous l’a envoyé.
        </p>
        <p className="text-sm text-neutral-600">
          Vous avez déjà un compte ? <Link href="/connexion" className="btn-link">Se connecter</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <section className="rounded-2xl bg-accent p-6 text-white sm:p-8">
        <p className="label-mono text-white/70">Invitation</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{invitation.inviterName} vous invite sur Valyo</h1>
        <p className="mt-3 text-white/85">
          Une communauté francophone pour suivre les avancées en IA, robotique et espace, les comprendre, et en discuter — par écrit
          aujourd’hui, à voix haute bientôt.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-white/85">
          <li>✦ Un récapitulatif sourcé trois fois par semaine</li>
          <li>✦ Des publications et des questions de membres curieux</li>
          <li>✦ Des salons pour approfondir à plusieurs</li>
        </ul>
      </section>
      <section className="card p-6">
        <h2 className="text-lg font-extrabold">Créer votre compte</h2>
        <p className="mt-1 text-sm text-neutral-600">Indiquez votre adresse e-mail : vous recevrez un lien pour terminer l’inscription. Pas de mot de passe.</p>
        <LoginForm next="/" invitation={token} />
      </section>
    </div>
  );
}
