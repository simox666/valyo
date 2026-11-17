# Sources documentaires — API Claude (lot 2B)

Consultées le 12 novembre 2026 dans la documentation officielle d'Anthropic. SDK utilisé : `@anthropic-ai/sdk` 1.8.0.
Rien n'a été déduit du seul nom du modèle. Le modèle `claude-opus-5-5` est apparu dans la liste des modèles du compte du porteur (`GET /v1/models`, sans génération).
Chaque point ci-dessous est relié à l'endroit du code qui en dépend.

## Traitement par lots — <https://platform.claude.com/docs/en/build-with-claude/batch-processing>

- **Modèle et prix.** `claude-opus-5-5` figure parmi les modèles pris en charge. Les tarifs du traitement par lots sont réduits de 50 % sur l'entrée comme sur la sortie.
- **Limites.**
  - 100 000 requêtes ou 256 Mo par lot.
  - La plupart des lots se terminent en moins d'une heure ; un lot non terminé expire à 24 h.
  - Les résultats restent disponibles 29 jours.
  - `max_tokens` doit valoir au moins 1.
- **Paramètres refusés dans un lot :** `stream`, `speed`, `fallbacks` (le repli automatique côté serveur ne s'applique pas aux lots) et `max_tokens: 0`.
- **`custom_id`.** De 1 à 64 caractères, motif `^[a-zA-Z0-9_-]{1,64}$`, unique dans le lot. L'identifiant de tâche (UUID, 36 caractères) convient.
- **États.** `processing_status` vaut `in_progress`, `canceling` ou `ended`. Les résultats se lisent via `results_url`, au format JSONL, dans un ordre quelconque : la correspondance se fait par `custom_id`.
- **Types de résultat.**
  - `succeeded` : message complet, avec son usage.
  - `errored` : non facturé. Erreur de validation (définitive) ou erreur serveur (temporaire).
  - `canceled` et `expired` : non facturés, à resoumettre.
- **Dépassement de plafond.** Un lot peut légèrement dépasser une limite de dépense de l'espace de travail. Le plafond Valyo ne repose donc pas sur ce mécanisme.

## Refus — <https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback>

- **Forme dans un lot.** Un refus revient en `result.type: "succeeded"` avec `stop_reason: "refusal"` et `stop_details`.
- **Facturation.** Un refus survenu avant toute sortie est facturé pour certaines catégories (`bio`, `frontier_llm`, `reasoning_extraction`). La réservation budgétaire reste donc nécessaire.
- **Dans Valyo.** Un refus est traité comme une erreur définitive : le sujet passe en examen, sans relance automatique sur un autre modèle.

## Tarifs — <https://platform.claude.com/docs/en/about-claude/pricing>

- **Claude Opus 5.5, en USD par million de jetons :** entrée 4 $, sortie 20 $, cache (lecture) 0,20 $.
- **Traitement par lots :** entrée **2 $**, sortie **10 $**. Ce sont les valeurs à saisir dans la console quand le porteur aura fixé le budget.
- **Contexte long :** pas de tarif majoré ; le contexte de 1 million de jetons est au prix standard.
- **Résidence des données :** `inference_geo: "us"` multiplie les prix par 1,1. Non utilisé : routage global par défaut.

## Réflexion (thinking) — <https://platform.claude.com/docs/en/build-with-claude/thinking>

- **Toujours active sur Opus 5.5.** `thinking: {"type": "disabled"}` renvoie une erreur 400. Le paramètre `thinking` est omis (mode adaptatif) et la profondeur se règle avec `output_config.effort`.
- **Comptage et facturation.** Les jetons de réflexion sont facturés comme jetons de sortie, même quand le texte n'est pas renvoyé. Ils comptent dans `max_tokens`, qui est une limite stricte. La borne de coût utilise donc `max_tokens` en entier pour la sortie.
- **Autres interdictions.** Pas de préremplissage de réponse et pas d'outil forcé sur Opus 5.5. La sortie JSON passe par les sorties structurées.

## Sorties structurées — <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>

- **Forme.** `output_config.format = { type: "json_schema", schema }`. Le JSON arrive dans le bloc `text` de la réponse.
- **Schéma.** `additionalProperties: false` obligatoire sur les objets. `minLength`, `maxLength`, `minimum` et `maximum` ne sont pas pris en charge ; ces contraintes restent appliquées par la validation serveur (Zod).
- **Validité non garantie** en cas de refus ou de `max_tokens` atteint. On vérifie `stop_reason` avant d'analyser la réponse.
- **Lots.** Compatible avec le traitement par lots.

## Comptage de jetons — <https://platform.claude.com/docs/en/build-with-claude/token-counting>

- **Endpoint.** `POST /v1/messages/count_tokens` accepte la même structure qu'un message (`system`, `messages`, `output_config`).
- **Précision.** Le comptage est une **estimation** qui peut différer légèrement du nombre facturé. Ce n'est donc pas une borne (voir « Fenêtre de contexte » pour la borne garantie).
- **Coût.** Gratuit, avec une limite de requêtes par minute distincte de celle des messages.
- **Usage dans Valyo.** Aucun appel de comptage n'a été fait pendant ce lot : les tests utilisent des réponses HTTP synthétiques.

## Fenêtre de contexte — <https://platform.claude.com/docs/en/build-with-claude/context-windows> (consultée le 13 novembre 2026)

- **Taille.** Claude Opus 5.5 a une fenêtre de contexte de 1 million de jetons. `max_tokens` peut aller jusqu'à 128 000.
- **Dépassement.** « If the input alone already exceeds the model's context window, the API returns a 400 `invalid_request_error` ("prompt is too long") on every model. » Une requête en erreur dans un lot n'est pas facturée (page Batch processing).
- **Conséquence pour Valyo (revue C202) :** l'entrée facturée d'une requête ne peut pas dépasser la limite d'entrée du modèle. La borne garantie réservée avant soumission est donc : limite d'entrée × prix d'entrée + `max_tokens` × prix de sortie. Pour Opus 5.5 au tarif des lots et `max_tokens` = 8 000, cela fait 2,08 $ par requête.
- **Source de la limite.** Elle est lue à chaque soumission via l'API des modèles (champ `max_input_tokens`). Si cette valeur est absente, aucune borne garantie n'est possible et la soumission est refusée.
- **Comptage.** Le comptage officiel avec sa marge reste un indicateur d'estimation, conservé par lot (`estimate_micros`). Il ne sert jamais à la réservation.
- **Frais inclus dans la borne :** jetons d'entrée et de sortie, réflexion comprise. Aucun outil serveur, aucune résidence US (`inference_geo`) et aucun mode rapide ne sont utilisés, donc aucun autre frais.

## Erreurs — <https://platform.claude.com/docs/en/api/errors>

- **Codes renvoyés :** 400 `invalid_request_error` (aussi en cas de limite de dépense atteinte), 401 `authentication_error`, 402 `billing_error`, 403 `permission_error`, 404, 409, 413 `request_too_large`, 429 `rate_limit_error`, 500 `api_error`, 504 `timeout_error`, 529 `overloaded_error`. Chaque réponse porte l'en-tête `request-id`.
- **Nouvelles tentatives du SDK.** Par défaut, le SDK réessaie automatiquement les erreurs transitoires deux fois. L'adaptateur désactive ces tentatives (`maxRetries: 0`) pour la création de lot : une soumission ambiguë n'est jamais renvoyée automatiquement.
- **Classement retenu par Valyo pour une création de lot :**
  - 4xx (400, 401, 402, 403, 404, 409, 413, 429) : demande refusée, lot non créé (`ProviderNotSentError`).
  - 5xx, 529, délai dépassé ou coupure réseau : issue inconnue, donc soumission incertaine (examen).

## Points non couverts par la documentation consultée

- **Recherche d'un lot.** Aucun moyen de retrouver un lot par un identifiant client. Après une soumission ambiguë, l'adaptateur déclare la capacité `findByInternalId` indisponible : le lot passe en état incertain, examiné par un humain.
- **Usage par lot.** L'usage est calculé en additionnant le champ `usage` de chaque résultat `succeeded`. L'addition n'est faite qu'après validation complète de la lecture (revue C201) :
  - un résultat par `custom_id` attendu, sans doublon ni identifiant inconnu ;
  - `request_counts` sans requête en cours, dont la somme vaut le nombre de requêtes et la répartition par type correspond aux résultats lus ;
  - usages entiers et non négatifs.
