# Premier essai réel de l'agent éditorial — 18 novembre 2026

Protocole : docs/protocole-premier-essai-claude.md. Détail exportable (sans clé ni
identifiant externe) : `2026-11-18-essai-reel.json`. Code au commit courant de la
branche `reseau-social-v1` ; SDK `@anthropic-ai/sdk` ^1.8.0 ; modèle `claude-opus-5-5`,
traitement par lots, prix revérifiés le jour même sur la page officielle (entrée 2 $,
sortie 10 $ par Mjeton).

## Déroulé

- Base dédiée `.data/pglite-essai` (aucune donnée réelle), document synthétique intégré,
  mode brouillon, agent en pause avant et après.
- Aperçu sans génération d'abord (limite d'entrée du modèle et comptage, appels gratuits).
- **1 lot créé, 1 requête soumise** (tri) : 1 065 jetons d'entrée, 67 de sortie.
- **Le tri a refusé le sujet** (`non_retenu_au_tri`) : le document se déclare lui-même
  fictif, sans institution réelle ni publication — c'est la décision éditoriale attendue.
  L'essai s'est donc arrêté proprement sans rédaction : prévu par le protocole (« un
  contenu bloqué peut démontrer un transport correct »).

## Vérifications

- Réservation au pire cas posée avant soumission (2,08 $), lot rapproché à l'usage réel,
  réservation libérée : **coût réel 0,0028 $**, aucun coût incertain, plafond 20 $ intact.
- Chaîne complète exercée sur l'API réelle : création du lot, soumission, suivi, lecture
  JSONL, application du résultat (une seule fois), rapprochement, remise en pause.
- Aucune publication, aucune donnée de membre transmise, aucune clé dans les rapports.

## Limites et suite

Seule l'étape de tri a généré ; rédaction, développement et vérification n'ont pas été
exercés sur l'API réelle (le sujet étant refusé, à juste titre). Prochain essai utile :
même protocole avec un document public réaliste pour exercer la rédaction (3 requêtes
au plus, mêmes bornes), sur une base d'essai neuve. La recette éditoriale humaine des
40 éléments (contrat §2C) reste due avant toute activation publique.
