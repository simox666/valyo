import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confidentialité" };

// Version provisoire : la politique définitive (exploitant, durées de conservation, base légale) reste à valider avant la mise en production.
export default function PrivacyPage() {
  return (
    <article className="space-y-4 leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Confidentialité</h1>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
        Version provisoire, en attente de validation avant l’ouverture publique. L’identité de l’exploitant et les durées de conservation restent à
        préciser.
      </p>
      <h2 className="text-lg font-bold">Ce que nous conservons</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Votre adresse e-mail, pour vous connecter. Elle n’est jamais affichée publiquement.</li>
        <li>Votre profil public : pseudonyme, nom affiché, présentation et thèmes suivis.</li>
        <li>Vos publications, commentaires et abonnements.</li>
        <li>Un cookie de session, nécessaire pour rester connecté.</li>
      </ul>
      <h2 className="text-lg font-bold">Suppression du compte</h2>
      <p>
        Depuis les paramètres, vous pouvez supprimer votre compte à tout moment. Vos sessions sont fermées, votre adresse e-mail, votre profil et vos
        abonnements sont effacés. Vos publications et commentaires restent visibles pour la continuité des discussions, attribués à « Membre
        supprimé » sans lien vers vous. Vous pouvez les supprimer vous-même avant.
      </p>
    </article>
  );
}
