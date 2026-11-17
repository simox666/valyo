# C015 — Salons, chat et notifications

14 novembre 2026 — Codex, reprise demandée par le porteur après C014.

## Résultat visible

- **Salons** : nouvelle présentation, cartes avec activité réelle, recherche par nom/description/thème, filtre de thème, archives, vues Découvrir et Mes salons. Les membres retrouvent leurs discussions avec le nombre de messages non lus. Les salons publics restent visibles dans Découvrir même après adhésion.
- **Page salon** : discussion en colonne principale, informations et membres en colonne secondaire, gestion repliable, accueil et adhésion explicites pour les visiteurs. Messages en bulles, horodatage compact, historique défilant et zone de saisie encadrée. Le composant de chat existant et ses comportements C010 sont conservés.
- **Notifications** : filtres Toutes/Non lues/Réponses/Salons/Modération, cartes différenciées, liens vers le contexte, lecture individuelle et lecture globale. Les filtres portent sur les 50 notifications chargées, limite affichée dans l’interface.

## À ouvrir

- [Annuaire](http://localhost:3217/salons)
- [Salon de démonstration](http://localhost:3217/s/24de8716-f8aa-4ff9-b00d-21736c5d24d9#chat)
- [Notifications — connexion requise](http://localhost:3217/notifications)

Pour voir les écrans membre, utiliser la [connexion locale](http://localhost:3217/connexion)
avec `demo_c014_mwgmvekk_0@example.test`, puis le lien de développement affiché à l’écran.
Compte fictif propriétaire ; aucun e-mail réel envoyé. Les notifications affichent les
données présentes, éventuellement un état vide, sans fabrication d’activité.

L’aperçu reste dans `/private/tmp/valyo-c014-apres-iuvc_7vm`, base distincte `demo-db`,
port 3217. Sources applicatives actualisées depuis le dépôt ; serveur 3000 et base
courante préservés. Sauvegarde avant C015 : `/private/tmp/valyo-c015-avant-7h68i4vp`.

## Fichiers

- `app/salons/page.tsx` et nouveau `RoomDirectory.tsx`.
- `app/s/[id]/page.tsx`, `RoomChat.tsx` et `components/LocalTime.tsx`.
- `app/notifications/page.tsx` et nouveau `NotificationInbox.tsx`.
- `lib/data/rooms.ts` : compteur de messages non lus dans les salons personnels,
  après le curseur de lecture, hors messages propres et supprimés.

Aucune dépendance, migration ou variable supplémentaire. Aucun commit ni nettoyage
des changements locaux préexistants. Pas d’activation publique ou payante.

## Vérification et limites

`npm run typecheck` et `git diff --check` réussis. Les pages `/salons`, le salon de
démonstration et `/notifications` rendent toutes un HTTP 200 sur la copie isolée,
avec la session du compte fictif. L’annuaire visiteur a été observé dans Chrome natif.

[Capture réelle de l’annuaire](recette-interface/C015/salons-ordinateur.png) : ordinateur,
visiteur, données fictives, image native 3420 × 2006 recadrée de 242 pixels en haut
pour retirer l’interface du navigateur, puis réduite à 1500 pixels de large. Elle montre
le haut de page ; elle ne constitue pas une capture complète des cartes ou un avant/après.

À la demande explicite du porteur, aucun nouvel audit général, build ou lancement des
suites complètes sur C015. Les résultats 152/152 de C014 restent historiques. Interactions
de filtre/lecture, chat réorganisé, mobile 390/320 px, clavier et régressions complètes
restent à vérifier ultérieurement, ainsi que les preuves PostgreSQL/charge déjà identifiées.
Cette livraison est une tranche implémentée ; ce n’est pas une recette complète de C011.
