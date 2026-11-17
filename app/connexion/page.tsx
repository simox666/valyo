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
      <h1 className="text-2xl font-extrabold tracking-tight">Se connecter ou créer un compte</h1>
      <p className="mt-2 text-neutral-700">
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
    </div>
  );
}
