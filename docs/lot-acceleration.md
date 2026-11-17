# Lot d’accélération — mission Claude

13 novembre 2026. Cadrage Codex à la demande du porteur. Ce lot élargit C008 : Claude peut avancer sur tous les travaux indépendants ci-dessous sans attendre la revue de chaque sous-lot. Codex conserve architecture, revue et recette indépendante. Les spécifications et décisions validées restent la référence.

L’augmentation de capacité de Claude ne modifie pas le plafond API de Valyo : 20 USD/mois pour les tests. Ce document ne lance aucun appel payant, déploiement ni publication publique. Les tâches de développement ne doivent pas être bloquées par l’attente d’un essai réel ou d’un choix produit sans lien avec elles.

## Organisation et livrables

Exécuter les lots dans l’ordre de leurs dépendances ; consigner chaque livraison dans le journal partagé, puis continuer les travaux indépendants sans attendre une réponse de Codex. Ne pas annoncer « validé par Codex » avant sa revue. Éviter une réécriture générale du socle. Préserver les modifications existantes et ne pas modifier les tests pour contourner une anomalie.

Pour chaque sous-lot : fichiers/migrations, comportements Fxx/Rxx, résultats des contrôles, configuration, limites et prochaine action. Mettre à jour le README et un tableau d’avancement de ce document. Priorité aux parcours utilisables, aux contrôles serveur et aux tests de risque ; pas de tests qui reproduisent simplement l’implémentation.

## A — Terminer l’outillage éditorial et sa livraison (priorité 1)

1. Livrer la commande d’essai borné prévue dans `protocole-premier-essai-claude.md` : aperçu, un sujet, trois étapes maximum, état persistant et reprise sans double soumission.
2. Tester ses limites avec le transport synthétique : deuxième lancement, erreur temporaire, résultat ambigu et tentative de dépasser le nombre de requêtes.
3. Ajouter un rapport d’essai exportable sans clé ni identifiant externe sensible : états, réservations, coûts et sorties à relire.
4. Préparer les fixtures et la grille de lecture des 40 éléments D4 ; ne pas prétendre qu’une fixture ou une autoévaluation remplace une lecture humaine de documents réels.
5. Vérifier et documenter les premières sources indicatives : flux accessible, origine, conditions d’accès et date du contrôle ; garder inactives celles dont l’autorisation reste incertaine. Aucun contournement d’accès.
6. Compléter le regroupement règle 3 (même émetteur, même objet, proximité temporelle) avec preuves et comparaison injectable ; doute = `doublon_incertain`, pas fusion irréversible. Tester faux rapprochements et actualisations distinctes.
7. Préparer une révision éditoriale administrative : correction du brouillon, motif, historique, aperçu et invalidation de la vérification lorsque le texte change.
8. Implémenter la transaction de publication et le retrait/correction éditoriale derrière une capacité désactivée : pause, fraîcheur à l’instant réel, doublons tardifs, unicité et version vérifiées au commit. Tester cette voie sur base dédiée, jamais l’activer sur la base courante.
9. Préparer le rendu public des récapitulatifs : nouvelles structurées, sources/statuts, ancres stables, distinction agent, sans limiter l’ensemble aux cinq sources des membres. Utiliser uniquement des données de démonstration séparées pour la recette.
10. Préparer le développement lié : modèle de données, article, relations réciproques, état « origine indisponible », correction et retrait. Réutiliser tâches, vérification et budget. Tant que D8 reste proposé, désactiver demandes publiques et choix de priorité/plafonds ; tester avec politique de fixture explicite.

Les horaires, taille et déclenchement D8 ne deviennent pas validés du fait de ce lot. Leur absence bloque leur activation concernée uniquement.

## B — Salons et droits (priorité 2, indépendant de l’API Claude)

11. Ajouter migrations salons, appartenances/rôles, invitations, sanctions, transferts, messages et repères de lecture. Contraintes uniques pour prévenir doubles adhésions et doubles envois. Ne pas conserver de jeton d’invitation en clair.
12. Centraliser `canDiscoverRoom`, `canReadRoom`, `canJoinRoom`, `canWriteRoom`, `canManageRoom` et les droits de modération, en réutilisant compte actif et sanctions. Tester la matrice visiteur/non-membre/membre/modérateur/propriétaire/suspendu/banni.
13. Livrer création autonome et depuis une publication, avec thème prérempli, association dans les deux sens et limite de fréquence D6.
14. Ajouter annuaire public et « Mes salons » ; aucune fuite de nom, participant, extrait ou appartenance privée par API, recherche ou profil.
15. Proposer les salons existants avant création, conformément aux décisions : au plus trois sous une publication, puis liste complète.
16. Livrer adhésion/départ et historique selon les droits ; quitter un salon privé supprime immédiatement l’accès à l’historique.
17. Livrer invitations révocables, expirantes, à usage unique, connexion puis acceptation explicite. Consommation atomique ; deux acceptations simultanées ne produisent qu’un usage.
18. Livrer rôles, transfert avec acceptation/expiration, impossibilité pour le propriétaire de partir sans résolution de propriété.
19. Livrer exclusion/bannissement avec durée et retour conformes D5 ; aucune invitation ne contourne un bannissement.
20. Livrer archivage, arrêt des écritures/invitations, historique autorisé et résolution de propriété avant suppression de compte.

## C — Chat réel (priorité 3, dépend de B)

**Choix d’architecture pour ce lot :** PostgreSQL reste la source de vérité ; envoi/modification/suppression via API, réception via flux serveur SSE reprenable. Les messages d’événements sont persistés dans une table transactionnelle pour permettre une reprise après redémarrage. Pas de nouveau service externe payant. PGlite sert au développement mono-processus ; PostgreSQL à la recette multi-processus.

Le transport SSE est interchangeable derrière un module serveur. Si l’hébergement cible ne permet pas de connexions durables, documenter l’incompatibilité et proposer l’adaptateur approprié avant activation. Ne pas présenter du polling seul comme la validation des objectifs temps réel.

21. Livrer envoi persistant avec identifiant client unique par auteur/salon, acquittement et relance sans doublon.
22. Livrer historique paginé avec ordre stable, modification/suppression par auteur et retrait modérateur tracé.
23. Livrer événements d’ajout/modification/suppression par SSE ; curseur de reprise, récupération des messages manqués et resynchronisation explicite si le curseur est trop ancien.
24. Contrôler les droits à l’ouverture et pendant le flux ; revalidation au plus toutes les cinq minutes et événement serveur de révocation lors d’une exclusion/suspension. Vérifier aussi les droits des messages en cours d’écriture.
25. Livrer états envoi/en échec/reconnexion, non-lus et dernier message lu monotone ; aucune présence ou activité inventée.
26. Séparer adhésion et suivi, créateur suivant par défaut ; limiter messages à 2 000 caractères et 20/minute/salon selon D6, de façon atomique.
27. Tester deux clients distincts, reconnexion, événements rejoués, redémarrage, exclusion pendant flux et révocation avant commit. Mesurer latence dans des conditions documentées.

## D — Recherche, notifications et modération (priorité 4)

28. Livrer recherche des publications, thèmes, profils et salons publics, avec résultats par type, pagination et état vide. Utiliser PostgreSQL sans nouveau moteur externe ; exclure systématiquement ce qui n’est pas autorisé.
29. Livrer notifications persistantes de réponse et messages des salons suivis, regroupement/compteur, absence d’auto-notification et marquage lu/non lu. Ne pas produire encore de notification vocale sans vocal réel.
30. Retirer les références privées lors d’une perte d’accès ; ancienne notification et URL directe ne donnent aucun accès.
31. Livrer blocage : masque publications/commentaires publics, interdit invitations vers le bloqueur, avertit de la limite dans les salons partagés.
32. Livrer signalements et file de traitement, avec motifs et limites D6 ; confidentialité du signalant côté API et interface.
33. Livrer actions humaines de retrait, avertissement, suspension et bannissement ; journal, notification motivée et révocation effective des sessions/flux selon D5. Adapter le modèle de statut si nécessaire sans perdre la distinction suspension/bannissement.
34. Livrer contexte de signalement privé borné aux messages et à la fenêtre D5, avec journal des consultations ; pas d’ouverture générale du salon privé.
35. Livrer contestation de sanction dans les 14 jours, une par sanction, décision motivée et séparation de l’examinateur quand possible.
36. Remplacer les hooks de test de changement de statut par l’outillage de recette approprié une fois la modération disponible ; aucun accès administratif de test déployable par inadvertance.

## E — Qualité, exploitation et préparation du vocal

37. Préparer un environnement PostgreSQL de test isolé et un script de recette multi-connexions (URL dédiée exigée, aucune base de production). Couvrir verrous de budget, tâches, invitations, publications et messages concurrents. Si aucune instance n’est disponible, livrer l’outillage et marquer l’exécution manquante.
38. Vérifier au navigateur et au clavier les parcours connectés, console et nouveaux salons à 320 px et sur ordinateur ; corriger focus, erreurs de formulaire et débordements. Documenter ce qui a effectivement été exercé.
39. Étendre la mesure agrégée aux salons/chat sans copier les conversations dans les statistiques ; distinguer lecture et contribution.
40. Documenter sauvegarde/restauration, migrations, worker, journalisation, coûts et configuration ; préparer un scénario de restauration sur base de test.
41. Préparer un plan de charge reproductible de 100 connexions, dont chat/SSE, et ses métriques. Ne pas annoncer la capacité comme vérifiée sans exécution. La partie 12 participants vocaux attend le vrai vocal.
42. Préparer le contrat d’intégration vocal F13 : permissions identiques au salon, jetons courts, micro coupé à l’entrée, écoute seule si possible, révocation immédiate et aucun enregistrement. Comparer les solutions sur leurs contrats officiels et leurs coûts, puis soumettre la recommandation à Codex. Aucun abonnement ni fournisseur payant à activer dans ce lot ; ne pas livrer un faux vocal.

## Recette et transmission

Ne pas attendre la fin des 42 tâches pour transmettre. Points de livraison : A, B, C, D, E (ou sous-ensemble cohérent explicitement nommé). À chaque point, exécuter TypeScript, tests pertinents, build et recette HTTP adaptée sur base isolée ; recette navigateur pour les parcours modifiés. Un obstacle sur un fournisseur ou une décision ne suspend pas les lots indépendants.

Si un défaut de sécurité/cohérence est identifié, le corriger avant d’étendre la fonctionnalité concernée. Présenter des écarts précis ; ne pas remplir les écrans avec des simulations non annoncées. Aucun lancement public ni déclaration de conformité complète avant recette indépendante.

## Tableau d’avancement à maintenir par Claude

| Lot | État initial | Livraison / limites |
|---|---|---|
| A | À faire, bases éditoriales 2A/2B acceptées | **Livré le 13 novembre 2026 (CL009)** : A1-A3 commande d'essai borné (`npm run essai`, tests, rapport exportable) ; A4 grille D4 (`docs/recette-editoriale-d4.md`) ; A5 première passe sources (`docs/sources-editoriales-d2.md`, aucune activée) ; A6 regroupement règle 3 (comparateur injectable, fusion non destructrice, `doublon_incertain`) ; A7 révision administrative (motif, historique, vérification invalidée) ; A8 transaction de publication + retrait/correction derrière capacité désactivée ; A9 rendu public structuré (ancres, statuts, distinction agent) ; A10 développement lié (demande admin seulement, D8 proposé). Essai réel et activation restent distincts ; recette Codex attendue |
| B | À faire | **Livré le 13 novembre 2026 (CL010)** : migration `010_salons` (unicité adhésions/messages, jetons hachés) ; droits centralisés `lib/rooms/permissions.ts` (matrice testée) ; création autonome et depuis une publication (thème prérempli, association réciproque, limite D6) ; annuaire + « Mes salons » sans fuite privée ; proposition des salons existants avant création (≤ 3 sous une publication) ; adhésion/départ (historique privé retiré au départ) ; invitations révocables/expirantes/usage unique atomique ; rôles + transfert avec acceptation/expiration + départ propriétaire bloqué ; exclusion 24 h / bannissement D5 (aucune invitation ne contourne) ; archivage + suppression de compte bloquée tant qu'un salon actif est possédé. Chat réel = lot C |
| C | À faire après B | **Livré le 13 novembre 2026 (CL011)** : migration `011_chat_evenements` (événements transactionnels) ; envoi persistant idempotent (identifiant client) ; historique paginé stable ; modification/suppression auteur + retrait modérateur motivé ; flux SSE reprenable par curseur avec `resync` explicite ; droits à l'ouverture + revalidation ≤ 5 min + événement `revoke` transactionnel à la sanction ; états envoi/échec/reconnexion, non-lus, repère monotone ; limite 2 000 car. et 20/min/salon atomique ; e2e 2 clients + exclusion pendant flux, latence mesurée ~2,1 s (dev local). Recette hébergement (connexions durables) à faire avant activation |
| D | À faire ; recherche et blocage peuvent commencer sans C | **Livré le 13 novembre 2026 (CL012)** : recherche par type (PostgreSQL seul, jamais de salon privé) ; notifications persistantes (réponses + salons suivis, regroupées, aucune auto-notification, purge à la perte d'accès) ; blocage (fil/commentaires masqués pour le bloqueur, invitations refusées, limite des salons partagés affichée) ; signalements avec file et confidentialité du signalant ; actions humaines (retrait, avertissement, suspension datée, bannissement distinct, levée) avec journal/notification motivée/révocation ; contexte privé borné ±10/±30 min journalisé ; contestation 14 j, examinateur distinct ; hook de statut retiré (recette via modération réelle). Notification vocale : attend le vrai vocal |
| E | Préparation possible dès maintenant | **Livré le 13 novembre 2026 (CL013)** : E37 outillage de recette concurrence PostgreSQL (`npm run recette:concurrence`, EXÉCUTION MANQUANTE — aucune instance disponible) ; E38 grille navigateur/clavier (`docs/recette-navigateur.md`, À EXÉCUTER) ; E39 mesure salons/chat agrégée (lecture vs contribution, testée) ; E40 `docs/exploitation.md` + restauration PGlite EXERCÉE sur base de test ; E41 plan de charge (`npm run charge`, outil VALIDÉ à 12 clients — capacité non vérifiée) ; E42 comparaison vocale F13 sur contrats officiels (`docs/contrat-vocal-f13.md`), recommandation LiveKit soumise à Codex, aucun abonnement |
