import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Quelles données Valyo collecte, pourquoi, combien de temps, et comment exercer vos droits (accès, rectification, suppression).",
  alternates: { canonical: "/confidentialite" },
};

const EXPLOITANT = "M2S Consulting";
const CONTACT = "rgpd@valyo.si";

const MAJ = "23 novembre 2026";

export default function PrivacyPage() {
  return (
    <article className="space-y-5 leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Confidentialité</h1>
      <p className="text-sm text-muted">Dernière mise à jour : {MAJ}. Valyo est en bêta sur invitation ; cette politique s’applique dès maintenant.</p>

      <h2 className="text-lg font-bold">Qui est responsable</h2>
      <p>
        Valyo est édité par {EXPLOITANT}. Pour toute question ou demande concernant vos données :{" "}
        <a href={`mailto:${CONTACT}`} className="btn-link">{CONTACT}</a>.
      </p>

      <h2 className="text-lg font-bold">Ce que nous collectons, et pourquoi</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Votre adresse e-mail</strong>, pour vous envoyer le lien de connexion et, si vous êtes sanctionné, les informations de recours.
          Elle n’est jamais affichée publiquement et ne sert à aucune prospection. Base : exécution du service.
        </li>
        <li>
          <strong>Votre profil public</strong> (pseudonyme, nom affiché, présentation, photo, bannière, liens, thèmes suivis), que vous
          renseignez vous-même et que les autres membres voient. Base : exécution du service.
        </li>
        <li>
          <strong>Vos contenus</strong> : publications, commentaires, réactions, messages de salon (écrits et vocaux), messages privés,
          signalements. Un message vocal est l’enregistrement de votre voix, tel que vous l’avez envoyé ; il n’est ni transcrit ni analysé.
          Base : exécution du service.
        </li>
        <li>
          <strong>Vos scores aux jeux</strong>, si vous jouez en étant connecté (la date, le jeu, le score et les points), pour le classement
          entre membres, où votre pseudonyme apparaît. Sans compte, rien n’est enregistré chez nous. Base : exécution du service.
        </li>
        <li>
          <strong>L’abonnement aux notifications push</strong>, uniquement si vous les activez sur un appareil : l’adresse technique que le
          service de notification de votre navigateur (Apple, Google ou Mozilla) attribue à cet appareil. Elle est supprimée quand vous
          désactivez les notifications, à la déconnexion et à la suppression du compte. Base : votre consentement.
        </li>
        <li>
          <strong>Un jour de présence</strong> par membre (la date, rien d’autre : ni pages vues, ni durée), pour mesurer la santé de la
          communauté. Conservé 24 mois. Base : intérêt légitime.
        </li>
        <li>
          <strong>L’historique de modération</strong> (signalements, sanctions, contestations), pour protéger la communauté, y compris en cas de
          récidive. Base : intérêt légitime.
        </li>
      </ul>
      <p>
        Et c’est tout : pas d’outil d’analyse d’audience, pas de traceur publicitaire, pas de script tiers, et l’application n’enregistre pas vos
        adresses IP. Les photos sont ré-encodées à l’envoi, ce qui supprime leurs métadonnées (position GPS comprise). Le seul cookie est le
        cookie de session, strictement nécessaire pour rester connecté (60 jours).
      </p>

      <h2 className="text-lg font-bold">Combien de temps</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Votre compte, vos contenus et vos scores aux jeux : tant que le compte existe.</li>
        <li>Lien de connexion : 15 minutes, et sa trace est purgée sous 7 jours.</li>
        <li>Sessions : 60 jours ; les sessions expirées sont purgées.</li>
        <li>Notifications : 12 mois.</li>
        <li>Jours de présence : 24 mois.</li>
      </ul>

      <h2 className="text-lg font-bold">Où vont vos données</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Railway</strong> (hébergement) : les données sont stockées en Union européenne (Pays-Bas). Railway est une société américaine ;
          le transfert est encadré par des clauses contractuelles types.
        </li>
        <li>
          <strong>Resend</strong> (envoi des e-mails de connexion, États-Unis) : reçoit votre adresse e-mail à chaque lien envoyé, uniquement
          pour l’acheminer.
        </li>
        <li>
          <strong>Anthropic</strong> (synthèses d’actualités par IA) : ne reçoit <em>aucune</em> donnée de membre — uniquement des articles de
          presse publics à résumer.
        </li>
        <li>
          <strong>Le service de notification de votre navigateur</strong> (Apple, Google ou Mozilla), si vous activez les notifications
          push : il achemine jusqu’à votre appareil un message chiffré indiquant qui vous a écrit ou répondu et où. Le contenu des messages
          privés n’y figure jamais.
        </li>
      </ul>
      <p>Vos données ne sont ni vendues ni partagées avec qui que ce soit d’autre.</p>

      <h2 className="text-lg font-bold">Vos droits</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Rectifier</strong> : votre profil se modifie à tout moment dans les paramètres.</li>
        <li>
          <strong>Supprimer</strong> : la suppression du compte, dans les paramètres, efface immédiatement votre adresse e-mail (partout, y
          compris des traces de connexion), votre profil, vos abonnements, vos messages privés, vos notifications, vos messages vocaux et
          votre historique de présence. Vos publications, commentaires et messages de salon écrits restent visibles pour la continuité des discussions, attribués à
          « Membre supprimé » sans lien vers vous — supprimez-les d’abord si vous ne voulez pas qu’ils restent. La personne propriétaire
          d’un salon peut par ailleurs supprimer celui-ci définitivement, messages compris, pour tous ses membres.
        </li>
        <li>
          <strong>Accéder et emporter</strong> : écrivez à <a href={`mailto:${CONTACT}`} className="btn-link">{CONTACT}</a> pour obtenir une
          copie de vos données ; réponse sous 30 jours.
        </li>
        <li>
          <strong>Réclamer</strong> : vous pouvez saisir la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="btn-link">cnil.fr</a>).
        </li>
      </ul>

      <h2 className="text-lg font-bold">Âge minimum</h2>
      <p>L’inscription est réservée aux personnes de 15 ans et plus.</p>
    </article>
  );
}
