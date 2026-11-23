import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Règles de la communauté",
  description: "Les règles de la communauté Valyo : ce qui est attendu des membres, ce qui est interdit et comment fonctionne la modération.",
  alternates: { canonical: "/regles" },
};

// Version provisoire : les règles définitives restent à valider par le porteur du projet avant la mise en production.
export default function RulesPage() {
  return (
    <article className="space-y-4 leading-relaxed">
      <h1 className="text-2xl font-bold">Règles de la communauté</h1>
      <p className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm">
        Version provisoire, en attente de validation avant l’ouverture publique.
      </p>
      <ol className="list-decimal space-y-3 pl-5">
        <li>
          <strong>Citez vos sources.</strong> Une actualité renvoie toujours vers son origine. Ne présentez pas une annonce commerciale comme un
          résultat vérifié.
        </li>
        <li>
          <strong>Débattez des idées, pas des personnes.</strong> Pas d’insultes, de harcèlement, de discrimination ni de menaces.
        </li>
        <li>
          <strong>Pas de spam ni d’autopromotion répétée.</strong> Partager son propre travail est bienvenu s’il apporte quelque chose à la
          discussion.
        </li>
        <li>
          <strong>Respectez la vie privée.</strong> Ne publiez pas d’informations personnelles sur autrui.
        </li>
        <li>
          <strong>Respectez le droit d’auteur.</strong> Résumez et citez brièvement, ne recopiez pas des articles entiers.
        </li>
        <li>
          <strong>Pas de contenu illégal ou dangereux.</strong>
        </li>
      </ol>
      <p>Les contenus qui ne respectent pas ces règles peuvent être retirés, et les comptes concernés suspendus.</p>
      <p>L’inscription est réservée aux personnes de 15 ans et plus.</p>
    </article>
  );
}
