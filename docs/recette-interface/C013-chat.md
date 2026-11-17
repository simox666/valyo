# C013 — observations navigateur du chat

14 novembre 2026. Recette partielle, pas une validation de C011 ou d'E38.

Chrome sur macOS, fenêtre privée séparée, ordinateur. La capture native observée mesurait
3420 × 2006 pixels physiques, chrome du navigateur inclus ; ce n'est pas une mesure de
viewport CSS ni un contrôle mobile. Le pilote natif a fonctionné après les échecs du
navigateur intégré, avec des interruptions et changements de fenêtre empêchant de terminer
la série de gestes. Les captures de la fenêtre entière incluaient la barre de favoris :
aucune n'est versée au dépôt. Aucun avant/après complet n'est annoncé.

## Données et URL

Base exclusivement de recette, quatre comptes fictifs « DÉMONSTRATION — Camille/Nour/Alex/Lou ».
Salon public « DÉMONSTRATION — Recette du chat C010 », 54 messages initiaux marqués comme
démonstration, adresses de sources `example.test`. Aucun peuplement de la base courante.

- Page testée : `http://localhost:3217/s/dcac39d9-ffd8-4d15-b4c0-367f7efefed5`.
- Rôle : Lou, membre sans privilège de modération.
- Connexion : `/connexion`, lien local de développement ; aucun e-mail envoyé.
- Serveur de recette arrêté après les vérifications ; cette URL n'est pas un service publié.

## Observé dans le navigateur

| Interaction | Observation |
|---|---|
| Demande de connexion, Tab puis Entrée | Lien local affiché, connexion ouverte sur le compte fictif |
| Ouverture du salon | Titre et quatre membres fictifs, état « Discussion en direct » |
| Historique initial | Messages 5 à 54 présents dans l'arbre d'accessibilité, bouton « Charger les messages précédents », liens de sources et boutons « Signaler » |
| Composition | Maj+Entrée conserve une deuxième ligne dans le champ |
| Envoi par Entrée | Nouveau message de Lou affiché sur deux lignes ; champ vidé ; actions Modifier/Supprimer disponibles |
| Clic Modifier | Champ prérempli sur deux lignes, boutons Enregistrer et Annuler visibles |

## À terminer sans considérer les cases comme acquises

- Enregistrement effectif de l'édition puis rechargement ; suppression confirmée et signalement soumis.
- Clic sur l'historique précédent, récupération des quatre messages et ancrage du défilement.
- Nouvelle arrivée pendant la lecture en haut, compteur et position conservée.
- Onglet caché, échec du repère de lecture puis nouvelle tentative ; reconnexion/resync visuels.
- Révocation du salon privé : disparition effective du contenu et du composeur dans l'interface.
- Recette clavier complète, focus après les actions, IME et lecteur d'écran.
- Captures avant/après homogènes ordinateur, 390 px et 320 px, pour les rôles de C011.

Les tests HTTP et de services couvrent séparément droits, persistance et reprise ; ils ne
remplacent pas ces observations d'interface. Reprendre la grille dans `../recette-navigateur.md`
et le contrat `../lot-interface-parcours.md` lors de la prochaine tranche.
