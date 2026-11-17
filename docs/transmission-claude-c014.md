# Transmission à Claude — C014

14 novembre 2026. Le porteur demande de clôturer cette tranche, de compléter les Markdown
et de reprendre avec Claude sur des résultats plus visibles. Aucun nouvel agent n'a été lancé.

## Ce qui est livré

C011/UI1 est implémenté, dans le prolongement des corrections C010/C013 :

- **Navigation** : Accueil, Salons, Recherche et Notifications ; destination courante mise en évidence. Profil, paramètres, sanctions, administration autorisée et déconnexion regroupés dans « Compte ». Menu natif au clavier, fermeture par Échap, sortie de focus ou clic extérieur. Navigation compacte sur petit écran prévue dans le CSS.
- **Accueil** : introduction courte, colonne de publications et colonne communauté. « Mes discussions » expose uniquement les salons accessibles du membre, avec non-lus persistés ; « Salons publics actifs » montre au plus quatre salons non archivés ayant des messages sur sept jours. États vides explicites. Tri du fil, thèmes et pagination existants conservés.
- **Cartes** : titre plus visible, distinction des récapitulatifs de l'agent, auteur, source, thèmes, commentaires, « Lire et discuter » et nombre de salons associés autorisés. Aucun contenu fictif ajouté à la base courante.
- **Publication** : lecture et commentaires dans la colonne principale ; salons associés dans une zone dédiée. Actions Commenter, Rejoindre un salon et Partager le lien. « Rejoindre et discuter » utilise l'API existante puis ouvre `/s/:id#chat` ; un membre voit « Ouvrir la discussion ». Connexion avec retour au salon ; création avec publication et thème préremplis conservée. Les salons supplémentaires se déplient sur place.
- **Compteur de notifications** : valeur serveur à l'affichage, actualisation à la navigation/au retour de focus et toutes les 30 secondes quand l'onglet est visible ; actualisation après marquage lu ou lecture du chat. Une erreur de marquage est affichée au lieu d'un succès silencieux.

Les lectures sont sans cache partagé et contrôlent compte actif, inscription, appartenance
et sanction de salon. Les droits de mutation restent côté serveur. La barre de navigation
transmet au client uniquement les propriétés nécessaires, sans adresse e-mail.

## À ouvrir maintenant

Aperçu isolé laissé démarré sur **http://localhost:3217** :

- [Accueil](http://localhost:3217/)
- [Publication et salons associés](http://localhost:3217/p/e6e9f504-6232-4bd4-bbbf-072e912eab19)
- [Salon de démonstration](http://localhost:3217/s/24de8716-f8aa-4ff9-b00d-21736c5d24d9)

Pour essayer l'adhésion : `/connexion`, adresse fictive `demo_c014_mwgmvekk_3@example.test`
(Lou), puis le lien local affiché. Lou est initialement extérieur au salon. Aucun e-mail
réel n'est envoyé. Le compte propriétaire de démonstration utilise
`demo_c014_mwgmvekk_0@example.test` ; son accueil permet de voir les discussions privées.

Copie servie : `/private/tmp/valyo-c014-apres-iuvc_7vm`. Base fictive : `demo-db` dans cette
copie. Les données des tests HTTP sont conservées séparément dans `recette-http-db` ;
la démonstration a été restaurée depuis le même jeu initial que les captures avant.
Source avant conservée dans `/private/tmp/valyo-c014-avant-ge5nrkp7`.
Ces dossiers sont temporaires : les sources durables sont celles du dépôt actuel.
Le serveur 3000, son `.next`, les secrets et sa base ont été préservés.

## Contrôles et limites

- TypeScript et build réussis dans la copie isolée.
- **152/152 tests** : 137 tests de suite, dont le nouveau `interface-discovery.test.ts`, et 15 régressions C010.
- HTTP existant **32/32** ; HTTP C010 **4/4** ; assertions SSE **2/2**.
- HTML réel UI1 **5/5** : accueil visiteur/propriétaire/tiers, publication membre/propriétaire ; cartes et actions attendues, salon privé absent pour le tiers.
- Le nouveau test de découverte couvre activité réelle, exclusion des messages propres/supprimés des non-lus, repère lu, confidentialité pour visiteur/tiers puis après suspension/départ.
- Captures réelles **avant** sur ordinateur : [index C014](recette-interface/C014/README.md). Le pilote Chrome a continué à renvoyer l'ancien écran pendant les tentatives de rechargement : aucune capture « après » périmée n'a été retenue. La recette visuelle finale, le menu au clavier et les largeurs 390/320 px ne sont donc pas déclarés validés.
- PostgreSQL multi-connexions, charge 100 clients et véritable envoi fournisseur : limites antérieures conservées, pas réexécutées ou validées par cette tranche.

## Fichiers à relire

`components/Header{,Navigation}.tsx`, `CommunitySidebar.tsx`, `PostCard.tsx`,
`PostRooms.tsx`, `CopyLinkButton.tsx` ; `app/(fil)/page.tsx`, `app/p/[id]/page.tsx`,
`app/layout.tsx`, `app/globals.css` ; `lib/rooms/discovery.ts`, `lib/data/rooms.ts` ;
`app/s/[id]/RoomActions.tsx`, `RoomChat.tsx` (seulement le signal de mise à jour du compteur),
`app/notifications/MarkReadButton.tsx` et `tests/interface-discovery.test.ts`.

Aucune dépendance, migration ou variable ajoutée. Aucun commit, reset ou changement de
l'index : les suppressions indexées de l'ancienne application et la refonte locale restent
intactes. Ne pas comparer seulement à HEAD pour déduire ce qui appartient à C014 : la majorité
de la refonte est encore non suivie par Git.

## Suite demandée

Lire C013/C014, puis travailler par tranches visibles et démontrables. Le contrat C011
autorise encore **UI2 : salons, chat et notifications** ; C013 a déjà complété une partie
du chat, à conserver. Le répertoire des salons doit notamment éviter une liste vide lorsque
tous les salons affichés appartiennent déjà au membre, et la page salon doit mettre le chat
au premier plan. Montrer le résultat au porteur avant de consacrer une nouvelle longue session
aux preuves non bloquantes.

Ne pas repartir dans un audit général de C010 : garder ses tests et corriger une régression
si elle apparaît. Les autres fonctionnalités visibles seront cadrées avec le porteur dans
la session Claude. Aucun élargissement implicite à la messagerie privée, au vocal réel,
aux API payantes ou à la publication éditoriale publique.
