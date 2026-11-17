# Lot 2 — Contrat technique de l’agent éditorial

Date : 12 novembre 2026. Auteur : Codex. Destinataire : Claude.

Ce document cadre l’implémentation ; il ne décrit pas une intégration déjà réalisée. Références : spécification F07–F09, R05–R08 et R23 ; décisions D2–D4 et D8. D8 remplace le rythme de cinq publications quotidiennes. Les autres règles de qualité restent applicables.

## 1. Périmètre et décisions ouvertes

Livrer la collecte persistante, le traitement éditorial en brouillon, la console, les récapitulatifs structurés, leurs développements liés et les mécanismes de reprise. Conserver Next.js et PostgreSQL/PGlite ; aucune nouvelle infrastructure de file d’attente nécessaire pour ce lot.

Choix acquis : fournisseur Claude, trois récapitulatifs par semaine, nouvelles sourcées, développements liés, tri par traitement par lots. Aucun appel fournisseur ni activation publique par défaut.

Choix encore ouverts : identifiant du modèle, budget et devise, prix vérifiés, jours/heures, taille des récapitulatifs, membres autorisés à demander un développement, décompte/priorité/plafond des développements et autorisation d’autres publications éditoriales. Ne pas transformer les propositions D8 en règles validées.

Construire les composants et interfaces indépendants de ces choix. Les politiques incomplètes ont l’état `unconfigured` et désactivent leur exécution réelle ; expliquer les paramètres manquants dans la console. Les tests utilisent une politique de fixture explicite. Pas de bouton public actif « Développer » tant que sa règle de déclenchement reste ouverte.

## 2. Architecture et responsabilités

- `lib/editorial/` : services serveur, validation, collecte sécurisée, regroupement, orchestration, publication et coûts.
- Couche métier testable sans Next.js : horloge, transport HTTP et fournisseur injectables. Éviter que l’import d’un module déclenche un appel externe.
- `lib/editorial/providers/` : interface fournisseur et adaptateur Claude. Avant de coder cet adaptateur, vérifier dans la documentation officielle du fournisseur les contrats Batch, les limites, les prix et le modèle réellement disponible. Ne pas reprendre un nom de modèle proposé dans les décisions comme preuve de disponibilité.
- Tâches persistées en base ; exécuteur ponctuel appelé par une commande de worker documentée. Le planificateur de l’hébergement lance cette commande et lui fournit la configuration. Aucun minuteur de collecte dans le processus web, aucune tâche longue exécutée pendant une requête utilisateur.
- Requêtes navigateur : enregistrer une intention courte, retourner l’état/la référence, puis consulter cet état. Une demande de développement n’appelle jamais directement le fournisseur.

Interface fournisseur minimale : soumettre un lot identifié, obtenir son état, récupérer ses résultats corrélés par identifiant de tâche, tenter son annulation et récupérer l’usage facturé. Séparer état technique fournisseur et verdict éditorial. Les capacités non disponibles doivent être explicites.

## 3. Données et migrations

Ajouter des migrations ; ne pas réécrire 001/002. Le détail des noms SQL appartient à Claude, sous réserve des contraintes suivantes :

| Objet | Contenu et contraintes |
|---|---|
| Configuration | version, pause, mode brouillon/public, politique validée, fuseau, jalons de recette, budget ; mises à jour tracées |
| Source | URL et mode d’accès, priorité, thèmes, activation, contrôle d’autorisation daté et référence, dernières collecte/erreur ; inactive par défaut |
| Document | source, URL exacte/finale/normalisée, date connue, collecte, empreinte, texte extrait limité, statut ; identité de collecte unique par source et URL normalisée, versions si contenu changé |
| Sujet | annonce regroupée, documents liés, document principal, thèmes, statut scientifique, raison de blocage, correspondance avec publication membre éventuelle |
| Tâche | étape, clé d’idempotence unique, état, tentatives, prochain essai, bail/expiration, fournisseur et identifiant externe, erreur structurée |
| Lot fournisseur | identifiant interne/externe, tâches associées, état, dates, usage et rapprochement des coûts |
| Récapitulatif | période et créneau logique uniques, version, état, publication associée unique et nullable |
| Nouvelle du récapitulatif | identifiant stable, sujet, position, titre/résumé/statut/sources validés ; unicité du sujet dans le récapitulatif |
| Développement | nouvelle d’origine et sujet, tâche, article associé unique ; au plus un article actif par sujet en V1 |
| Demande | membre et sujet, date ; unicité membre/sujet si cette politique est validée ; suppression/anonymisation cohérente avec la suppression du compte |
| Révision | entité, version précédente/nouvelle, motif, acteur et date ; aucune exposition des documents internes au public |
| Dépense | tâche/lot, réservation maximale, coût rapproché, devise, période budgétaire et état ; calcul décimal exact |

Ne pas détourner `posts.kind`, qui représente les contributions `news/question/experience`. Garder `kind=news` pour les publications éditoriales et ajouter une relation/métadonnée `recap` ou `development`. Conserver les publications humaines et leurs validations actuelles.

Un récapitulatif peut contenir plus de cinq sources : la limite humaine de cinq sources ne s’applique pas à son ensemble. Chaque nouvelle possède ses sources structurées ; le rendu public et la détection des doublons doivent les prendre en compte. Le corps rendu est dérivé des éléments validés, sans HTML arbitraire du modèle.

## 4. États, reprises et publication

Documents : `collected → extracted → grouped`, ou erreur expliquée. Sujets : `candidate → drafting → ready`, avec branches `review_required`, `duplicate`, `ignored`, `rejected`. Récapitulatifs/développements : `draft → ready → published`, ou `review_required`, puis correction/retrait tracés. Conserver les codes de motifs D4.

Les tâches sont réclamées atomiquement sous transaction, avec un bail expirant. Ne pas garder une transaction SQL ouverte pendant HTTP ou génération. Reprises bornées avec délai croissant ; erreurs permanentes orientées vers examen. Une source en erreur n’arrête pas les autres.

En cas de soumission fournisseur dont la réponse est perdue, ne pas soumettre aveuglément une seconde fois : rapprocher l’identifiant stable si possible, sinon marquer l’état incertain et demander examen. Une réponse en retard ou rejouée ne crée ni article ni coût comptabilisé deux fois.

La publication est une transaction courte : verrouiller la configuration et l’objet, revérifier pause/mode/validation, politique et doublons, créer publication/sources/thèmes/liens, puis marquer publié. Clés uniques en base pour résister à deux workers. Le doublon membre est contrôlé aussi juste avant publication ; ne jamais modifier le texte du membre. Si découvert tardivement, retirer le sujet du récapitulatif proposé et conserver le motif. Un récapitulatif vide n’est pas publié.

La pause bloque immédiatement toute nouvelle soumission et tout commit de publication. Les résultats des lots déjà payés peuvent être récupérés et conservés en brouillon. La désactivation d’une source empêche de nouvelles collectes et impose une revérification des brouillons qui en dépendent.

## 5. Temps et fraîcheur

Stocker les instants en UTC. La planification utilise explicitement `Europe/Brussels` si ce fuseau est confirmé ; les changements d’heure n’engendrent pas de doublon. La clé d’un créneau représente une occurrence locale unique. Une panne ne doit pas publier plusieurs éditions anciennes en rafale : conserver les créneaux manqués et proposer une reprise administrative explicite.

Le tri Batch doit finir avant la publication visée : prévoir une échéance et afficher les traitements retardés. Aucun résultat incomplet n’est publié pour respecter l’horaire.

**Conflit à traiter sans inventer une règle :** trois éditions par semaine peuvent laisser un intervalle de 72 h ; le traitement par lots ajoute du délai, alors que D4 limite les nouvelles à 72 h. Stocker séparément date de source, découverte et date de publication. En attendant une décision sur l’instant de mesure, appliquer la règle conservatrice : réexaminer la fraîcheur à la publication, écarter ce qui dépasse la limite, et signaler le risque de perdre certaines nouvelles. Ne pas élargir silencieusement la fenêtre.

## 6. Sources, fidélité et sécurité

Collecte uniquement depuis les sources activées et autorisées. Limites explicites de durée, taille, redirections et types MIME. Refuser ressources locales/privées, loopback, link-local et métadonnées, IPv4 et IPv6, y compris après résolution DNS et à chaque redirection. Prévoir la protection contre le changement d’adresse entre résolution et connexion ; le simple contrôle textuel de l’URL ne suffit pas. Ne pas faire récupérer arbitrairement une URL proposée par un membre.

Les documents sont des données non fiables. Aucun outil, secret ou capacité de publication n’est donné au modèle rédacteur. Une sortie structurée est validée côté serveur ; les URL doivent provenir des documents effectivement consultés. Pour chaque affirmation clé, conserver une référence au document et au passage qui l’étaye. L’autoévaluation du rédacteur ne constitue pas à elle seule une vérification. Les contradictions, dates/statuts incertains et instructions suspectes conduisent à examen selon D4.

Le mode local utilise un fournisseur déterministe de test, explicitement identifié dans l’administration, sans publications visibles comme réelles. Aucun repli vers ce fournisseur si une clé réelle manque ou si Claude est indisponible. Les documents complets et détails techniques restent réservés aux administrateurs ; conserver des extraits limités plutôt que recopier intégralement des articles.

## 7. Budget

Aucun appel payant sans modèle, prix vérifiés, budget et devise configurés. Par défaut : désactivé. La recommandation monétaire de D3 n’est pas une autorisation.

Avant soumission, réserver atomiquement un majorant du coût du lot (entrée, sortie maximale et éventuelle vérification comprise). Refuser si dépensé + réservé + nouvelle réservation dépasse le plafond mensuel UTC documenté. Rapprocher avec l’usage réel une seule fois ; ne libérer une réservation qu’après confirmation, jamais sur un simple timeout. Les tentatives incertaines gardent leur réservation. Les lots traversant un changement de mois restent imputés à leur période de réservation afin de ne pas contourner le plafond. Les erreurs d’estimation sont visibles et bloquent les nouvelles soumissions jusqu’au rapprochement.

Afficher dépensé, réservé, plafond, période, devise et éventuels coûts non encore connus. Les prix ne sont pas dispersés dans le code. Pas de promesse de plafond fournisseur absolu si des frais externes ne peuvent pas être majorés ; documenter ces frais et limiter le service concerné séparément.

## 8. Interfaces et permissions

Console `/admin/editorial` : configuration, sources, collecte, tâches/lots, sujets et motifs, aperçu des récapitulatifs, corrections/retraits, pause et budget. Réutiliser les droits administrateur existants côté serveur ; toutes les mutations navigateur contrôlent origine et compte actif. Tester aussi les URL et API directes. Identifiants fournisseur/secrets absents des réponses publiques.

Les publications publiées réutilisent `/p/[id]`, commentaires et fil. Récapitulatif : ancres stables par nouvelle, statut et sources propres. Développement : lien réciproque avec la nouvelle d’origine. Si l’origine est retirée, afficher « origine indisponible » sans recopier son texte. Un retrait du récapitulatif ne retire pas automatiquement un article indépendant : afficher son propre état et garder ses preuves éditoriales pour examen.

Pour les demandes futures : utiliser un POST avec garde membre actif et idempotence, jamais un GET à effet de bord. Tant que la politique D8 n’est pas validée, masquer l’action publique ou l’indiquer indisponible ; ne pas afficher un compteur fictif.

## 9. Livraison et recette

**2A — sans appel payant :** migrations, sources/collecte sur fixtures, moteur de tâches, fournisseur de test, console, brouillons structurés, pause, reprises et réservations simulées. Configuration publique désactivée.

**2B — intégration réelle :** adaptateur fournisseur documenté, sources vérifiées, worker planifiable et rapprochement réel. Dépend des choix D3 et de la configuration ; livrer les autres éléments sans les annoncer comme connectés.

**2C — activation :** politiques D8 complètes, échantillon humain d’au moins 40 éléments réels et seuils D4 atteints, résultats dans `docs/essais-agent/`, vérifications de déploiement. Ne pas remplacer cette lecture humaine par une note produite par un modèle.

| Test | Résultat attendu |
|---|---|
| Deux workers réclament/publient le même objet | Une seule tâche active et une seule publication, y compris PostgreSQL multi-connexions |
| Interruption avant/après soumission ou commit | Reprise explicite, aucune double publication ni double comptabilisation |
| Pause pendant génération, juste avant commit | Aucun nouveau commit publié ; résultat conservé en brouillon |
| Doublon humain avant collecte ou avant publication | Aucun sujet republié, texte humain intact (R07) |
| Dates absentes, source inaccessible, contradiction | Motif d’examen exact, aucune invention (R06) |
| Injection dans page, URL interne, redirection privée | Aucune modification des permissions, aucun accès réseau interne (R23) |
| Sortie invalide ou URL inventée du modèle | Brouillon bloqué, jamais affiché comme vérifié |
| Réponse Batch partielle, tardive ou rejouée | État exact par tâche, pas de publication incomplète ni doublon |
| Deux réservations concurrentes près du plafond | Seule la réservation compatible passe ; timeout ne libère pas le coût |
| Changement de mois, fuseau et heure d’été | Coûts et occurrences stables, pas de double édition |
| Plus de cinq sources dans un récapitulatif | Sources accessibles par nouvelle ; validations humaines inchangées |
| Visiteur/membre appelle une API admin | Refus serveur ; aucune donnée interne exposée |
| Fournisseur absent ou indisponible | État explicite ; publications humaines toujours fonctionnelles (R08) |

Claude transmettra fichiers/migrations, configuration, commandes worker, tests exécutés, preuves d’intégration et écarts. Codex assure la revue et la recette indépendante. Aucune configuration réelle n’est nécessaire pour démarrer 2A.
