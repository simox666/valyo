import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { robots: { index: false }, title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erreur?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const user = await getCurrentUser();
  if (user?.onboarded) redirect(next);
  if (user) redirect(`/bienvenue?next=${encodeURIComponent(next)}`);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold sm:text-[28px]">Se connecter ou créer un compte</h1>
      <p className="mt-2 text-soft">
        Indiquez votre adresse e-mail : vous recevrez un lien de connexion. Pas de mot de passe à retenir.
      </p>
      {params.erreur === "lien" && (
        <p role="alert" className="card mt-4 border-red-200 bg-red-50 p-3 text-red-800">
          Ce lien de connexion est expiré ou a déjà été utilisé. Demandez-en un nouveau.
        </p>
      )}
      {params.erreur === "invitation" && (
        <p role="alert" className="card mt-4 border-red-200 bg-red-50 p-3 text-red-800">
          Cette invitation n’est plus valable (déjà utilisée, révoquée ou expirée). Demandez un nouveau lien à la personne qui vous a invité·e.
        </p>
      )}
      {params.erreur === "banni" && (
        <p role="alert" className="card mt-4 border-red-200 bg-red-50 p-3 text-red-800">
          Ce compte est banni de la plateforme : la connexion est impossible. La décision motivée vous a été notifiée ; une contestation
          était possible dans les 14 jours.
        </p>
      )}
      <LoginForm next={next} />
      <section className="card mt-8 p-5" aria-labelledby="pourquoi">
        <h2 id="pourquoi" className="label-mono text-accent">Avec un compte</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-soft">
          <li><strong className="font-semibold text-ink">Un fil à votre goût</strong> : l’actualité IA, espace, sciences et tech, triée selon vos thèmes.</li>
          <li><strong className="font-semibold text-ink">La discussion</strong> : commentez, réagissez et rejoignez les salons.</li>
          <li><strong className="font-semibold text-ink">Les jeux</strong> : le défi du jour et le classement des Valyors.</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Gratuit. Votre adresse e-mail n’est jamais affichée.</p>
      </section>
    </div>
  );
}
