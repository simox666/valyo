# Premier essai Claude — protocole préparé le 13 novembre 2026

Statut : préparé, non exécuté. Budget de phase de test rapporté dans CL008 : 20 USD par mois. Aucun changement de configuration réelle ni appel payant effectué par cette préparation.

## Objectif

Vérifier l'intégration API réelle sur un seul sujet, avec trois requêtes au maximum : un tri, une rédaction, une vérification. Aucun récapitulatif public ; le résultat reste dans l'administration. Cet essai technique ne remplace pas la recette éditoriale humaine des 40 éléments.

## Préparation par Claude

Préparer une commande d'essai dédiée avant toute exécution. Elle doit sélectionner explicitement le sujet et les identifiants de tâches autorisés. Ne pas simplement lancer `npm run worker` sur une base contenant d'autres tâches : le worker général peut collecter et soumettre d'autres éléments et relancer des erreurs temporaires.

La commande utilise une base dédiée persistante, sans tâche préexistante ni donnée utilisateur réelle, et un seul document de test public/non sensible. Un document synthétique clairement identifié suffit pour valider le transport ; une source réelle nécessitera sa vérification d'autorisation. Aucun mécanisme de planification automatique pendant cet essai.

Prévoir un mode aperçu sans génération, affichant seulement : modèle, tâches et étapes autorisées, plafond global, devises/prix vérifiés, estimation et réservation maximale, nombre maximal de créations de lot. Aucun secret affiché. Les appels de liste/comptage nécessaires doivent être annoncés comme des appels réseau, même gratuits.

## Limites d'exécution

- Administrateur désigné explicitement par le porteur ; ne pas s'auto-attribuer un compte administrateur ni deviner son adresse.
- Modèle configuré correspondant à l'adaptateur et au modèle retenu ; prix Batch vérifiés au moment de l'essai. Plafond mensuel : 20 USD, en tenant compte du déjà dépensé et réservé sur cette même configuration.
- Plafond supplémentaire propre à l'essai : trois requêtes au total, une par étape, sans retry de génération automatique. Maximum de trois créations de lot ; les consultations de suivi peuvent être répétées de façon bornée.
- Réservation conservatrice par requête calculée avec la limite d'entrée retournée pour le modèle et la sortie maximale. L'ordre de grandeur annoncé dans CL008 est de 2,08 USD par requête, soit 6,24 USD pour trois ; recalculer avant exécution. Ce montant est une réservation au pire cas, pas une prévision de coût réel.
- Chaque étape est soumise puis rapprochée avant la suivante. Refus, résultat invalide, délai dépassé, comptage impossible ou soumission ambiguë : arrêter et conserver l'état nécessaire à l'examen. Ne pas recréer un lot pour contourner un état incertain.
- Mode brouillon obligatoire, aucune publication. Garder la collecte générale et le planificateur désactivés. Pause après la fin de l'essai.

## Preuves à livrer

Dans `docs/essais-agent/`, rapport daté sans clé ni contenu privé : versions du code/SDK, paramètres publics du modèle, document de test, tâches et lots internes, états rencontrés, sorties relues, compteur de requêtes, coûts estimés/réservés/rapprochés et écarts. Les identifiants externes utiles à l'exploitation restent dans la base/console privée, pas dans un rapport public.

Vérifier : format JSONL réel, compteurs complets, jetons d'usage, raisons d'arrêt, aucune double application, fidélité du titre/résumé/statut et sources consultées. Mentionner toute différence entre API réelle et fixtures, même si le parcours termine.

## Conditions de réussite

Trois requêtes au maximum ; aucune publication ; configuration et modèle cohérents ; chaque réservation rapprochée ou explicitement incertaine ; dépenses couvertes ; contenu fidèle ou correctement bloqué en examen ; aucune donnée secrète exposée. Un contenu bloqué peut démontrer un transport correct sans valider la qualité éditoriale. Toute limite constatée est résolue avant élargissement.

Prochaine livraison attendue : commande d'essai et tests synthétiques de ces garde-fous, puis vérification Codex avant lancement de l'essai réel. Le présent document ne lance pas cet essai.
