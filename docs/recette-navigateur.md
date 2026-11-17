# Recette navigateur et clavier — grille E38

Préparée le 13 novembre 2026 (lot d'accélération, tâche E38). **Statut : À EXÉCUTER.**
Complément du 14 novembre : quelques interactions du chat ont été observées dans Chrome
(connexion, composition multiligne, envoi, ouverture de l'édition). Voir
[recette-interface/C013-chat.md](recette-interface/C013-chat.md). Cela ne valide pas
la grille complète ci-dessous ni les largeurs mobiles.

Les parcours ci-dessous ont été exercés en HTTP (scénario e2e, 32 pas) mais pas encore
au navigateur réel ni au clavier : aucun poste de développement avec navigateur piloté
n'était disponible pendant ce lot. Ce document dit précisément ce qui a été exercé et
ce qui reste dû — rien n'est annoncé comme vérifié sans l'avoir été.

## Déjà exercé (HTTP, base isolée)

- Tous les parcours d'API et le HTML rendu des pages (assertions sur le contenu).
- Codes d'état, redirections de connexion, non-fuite des salons privés.

## À exécuter au navigateur — à 320 px de large ET sur ordinateur

Pour chaque écran : aucun débordement horizontal, focus visible au clavier (Tab),
formulaires soumis à Entrée, messages d'erreur annoncés (role alert/status).

| # | Parcours | 320 px | Clavier | Notes |
|---|---|---|---|---|
| 1 | Connexion par lien, retour au contexte (`next`) | ☐ | ☐ | |
| 2 | Inscription (pseudonyme, règles) et erreurs de formulaire | ☐ | ☐ | |
| 3 | Fil, filtre par thème, pagination | ☐ | ☐ | |
| 4 | Publication : création, doublon confirmé, modification | ☐ | ☐ | |
| 5 | Commentaires : réponse, suppression, commentaire masqué (blocage) | ☐ | ☐ | |
| 6 | **Console éditoriale** : configuration, motifs, journal | ☐ | ☐ | nouveaux formulaires A7/A10 |
| 7 | Aperçu d'un récapitulatif + révision (motif) + demande de développement | ☐ | ☐ | |
| 8 | **Salons** : annuaire, création (avec suggestion de salons existants) | ☐ | ☐ | |
| 9 | Page de salon : rejoindre, suivre, inviter (lien affiché une fois) | ☐ | ☐ | |
| 10 | **Chat** : envoi, états envoi/échec/reconnexion, non-lus, retrait modérateur | ☐ | ☐ | couper le réseau pour tester la reprise |
| 11 | Invitation : ouverture du lien, connexion, acceptation explicite | ☐ | ☐ | |
| 12 | Transfert de propriété : bannière, accepter/refuser | ☐ | ☐ | |
| 13 | Notifications : liste, badge, marquage lu | ☐ | ☐ | |
| 14 | Recherche : formulaire, résultats par type, état vide | ☐ | ☐ | |
| 15 | Signalement (publication, profil) et confirmation | ☐ | ☐ | |
| 16 | `/sanctions` : sanction motivée, contestation | ☐ | ☐ | |
| 17 | File de modération : actions, contexte borné | ☐ | ☐ | |
| 18 | Profil : suivre, bloquer (avertissement sur la limite) | ☐ | ☐ | |

## Procédure

1. Serveur de test : `ADMIN_EMAILS=… PGLITE_DIR=.data/pglite-recette PORT=3100 npm run dev`.
2. Navigateur en fenêtre de 320 px (outils de développement, mode responsive), puis plein écran.
3. Parcours clavier : Tab/Maj+Tab/Entrée/Échap uniquement, lecteur d'écran si possible sur 2 ou 3 écrans.
4. Consigner chaque case cochée avec la date et les anomalies dans ce fichier (ou un rapport daté à côté).
5. Corriger focus, erreurs de formulaire et débordements avant de cocher.
