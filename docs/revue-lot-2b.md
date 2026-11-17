# Revue Codex — lot 2B — 12 novembre 2026

Réponse initiale à CL007. Verdict initial : corrections requises avant acceptation pour essai réel. Voir la contre-revue CL008 ci-dessous. Aucun appel réel à Anthropic ; transports synthétiques uniquement. Clé privée ni lue ni affichée.

## Vérifications

- `npm test` : 64/64, avec autorisation du serveur local des tests réseau.
- `npm run typecheck` : succès.
- Revue adaptateur, fabrique, réservations/soumission et tests de contrat.
- Documentation officielle de comptage et Batch ouverte indépendamment. Build et scénario HTTP non répétés dans cette passe ; pas de modification applicative par Codex.

## C201 — importante — usage incomplet considéré comme définitif

**Reproduction exécutée** sur transport synthétique : création d'un lot d'une requête ; `retrieve` annonce `ended` et `request_counts.succeeded=1`, mais le téléchargement JSONL retourne un flux vide HTTP 200. `getUsage` retourne `{ inputTokens: 0, outputTokens: 0 }`, au lieu d'un usage inconnu. Le rapprochement peut alors clôturer la dépense à zéro et libérer la réservation. Des lignes dupliquées entraînent au contraire une double somme. Les fixtures actuelles renvoient toujours des `request_counts` à zéro, même avec des résultats présents, ce qui masque ces incohérences.

Attendu : valider complétude, unicité des custom_id, types, nombres d'usage finis/non négatifs et correspondance des compteurs avant de déclarer l'usage connu. Rapprocher aussi les identifiants attendus conservés par le lot ; ne pas traiter les résultats manquants comme des requêtes non facturées. Résultats invalides/incomplets = réservation conservée, reprise ou examen, pas resoumission automatique des requêtes possiblement facturées. Appliquer cette protection à la lecture des résultats métier, pas seulement au calcul des coûts.

Tests : flux vide, tronqué sur une frontière JSONL valide, ligne dupliquée, custom_id inconnu, compteur divergent, usage mal formé, puis téléchargement complet au cycle suivant. Aucune libération prématurée ni double génération/coût. Mettre les compteurs de la fausse API en cohérence avec les requêtes et résultats.

Source officielle : [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing), sections résultats et `request_counts` : chaque requête possède un résultat et la somme des compteurs correspond au total.

## C202 — importante — estimation avec marge présentée comme une borne

`boundCostMicros` utilise `ceil(count_tokens × 1,05) + 64`. La documentation décrit le comptage comme une estimation ; elle ne donne pas de garantie numérique que cet écart est toujours inférieur à cette marge. La sortie maximale est bornée, mais l'entrée ne l'est donc pas sur cette seule base. Le blocage après dépassement ne répare pas un plafond déjà dépassé.

Attendu : distinguer estimation et borne défendable dans le contrat fournisseur et l'interface. Pour la voie réelle, fournir une limite supérieure documentée (par exemple limite contractuelle d'entrée/contexte applicable au modèle et à la requête, réservée au pire cas, après vérification de sa pertinence et des frais inclus), ou refuser la soumission faute de borne. Une marge empirique peut rester un indicateur mais ne suffit pas au contrôle strict demandé. Ne pas modifier la promesse de plafond ni adopter une tolérance sans décision du porteur.

Test : simuler une entrée facturée au-delà de l'estimation + marge ; la réservation admise doit néanmoins la couvrir, ou la soumission doit être refusée avant création. Compter toutes les étapes réelles et garder les tarifs figés par lot.

Source officielle : [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting), précision/FAQ : estimation. Aucun seuil de garantie de 5 % + 64 établi par la page consultée.

## C203 — moyenne — configuration fournisseur pouvant diverger de l'adaptateur

Constat de revue dans `submitPending` : le fournisseur est construit avec un modèle, puis la configuration est relue. Seul son `id` est comparé ; le modèle capturé par `createClaudeProvider` n'est pas exposé. Si un administrateur change le modèle après construction du fournisseur, le lot peut être compté/envoyé avec l'ancien modèle et enregistré avec le nouveau. La comparaison `locked.model === config.model` ne détecte pas ce cas si le changement précède la première lecture de submitPending.

Attendu : identité fournisseur incluant modèle/version pertinente, contrôlée avant comptage et réservation ; reconstruire l'adaptateur depuis la configuration retenue ou refuser si divergence. Sous verrou, réévaluer aussi la configuration complète requise (budget, devise, fournisseur, prix), et pas uniquement pause/estimation/prix/modèle. Cela évite par exemple de soumettre après retrait du plafond pendant le comptage.

Tests : changer le modèle entre construction et soumission ; retirer le budget ou modifier devise/configuration pendant count_tokens. Aucun lot mal étiqueté ni appel de génération hors configuration valide.

## Autres décisions

Efforts low/medium/high acceptés comme paramètres techniques initiaux, à évaluer lors de la recette réelle ; aucune garantie de qualité déduite de ce réglage. Bonne séparation de la provenance simulée, absence de retry à la création et absence de repli fournisseur.

Budget mensuel toujours absent : aucune autorisation de génération réelle. Après corrections, protocole proposé : base de test dédiée, un seul sujet et un maximum de trois requêtes (tri, rédaction, vérification), budget d'essai explicitement borné et réservé, aucun mode public, contrôle humain des trois résultats et rapprochement des usages avant élargissement. Cet essai n'est pas lancé par cette revue et ne remplace pas les 40 éléments de recette D4.

## Contre-revue de CL008 — 13 novembre 2026

C201 à C203 acceptées dans le périmètre de développement sur transports synthétiques. Revue de `readBatch`, des identifiants persistés, de la réservation par limite d'entrée du modèle et de la revalidation de configuration sous verrou effectuée. Documentation officielle « Context windows » ouverte indépendamment : limite d'entrée et comptage de la sortie/réflexion cohérents avec l'approche conservatrice retenue. Cette réserve suppose des tarifs correctement configurés et l'absence de fonctions facturées supplémentaires.

Vérifications indépendantes : `npm test` 79/79, TypeScript réussi, HTTP 19/19 sur PGlite isolé `/private/tmp/valyo-codex-cl008-20261113`. Premier lancement HTTP refusé car le serveur s'était arrêté ; relance en terminal persistant puis recette réussie. Serveur arrêté après recette.

Budget de 20 USD/mois pour les tests pris en compte d'après CL008 et les décisions. Aucun appel réel ni changement de configuration effectué. Lot 2B accepté pour préparer un essai réel borné ; intégration fournisseur réelle encore non démontrée. Le protocole est dans `docs/protocole-premier-essai-claude.md`. Une commande dédiée limitant sujets/tâches/tentatives est nécessaire avant cet essai ; ne pas utiliser le worker général sans ces limites. Les réserves de lancement (recette humaine, sources, PostgreSQL multi-connexions et interface) demeurent.
