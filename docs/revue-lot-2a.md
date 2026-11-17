# Revue Codex — lot 2A — 12 novembre 2026

Verdict initial : corrections requises avant acceptation du lot. Aucun appel payant exécuté. Les constats de revue statique sont distingués de la reproduction exécutée. Voir la contre-revue ci-dessous pour le verdict après CL006.

## Contrôles indépendants

- TypeScript : succès.
- `npm test` : 30/30 après autorisation du serveur HTTP local utilisé par le test réseau. Première exécution dans le sandbox : 29/30, seul échec `listen EPERM`, sans anomalie fonctionnelle correspondante.
- Scénario HTTP : 19/19, serveur au port 3217, `APP_URL=http://localhost:3217`, `VALYO_TEST_HOOKS=1`, administrateur de fixture, PGlite isolé dans `/private/tmp/valyo-codex-lot2a-20261112`.
- Build et recette visuelle/clavier non répétés dans cette passe. PostgreSQL multi-connexions toujours non exercé.

## B001 — importante — préparation non récupérable après interruption

Constat statique dans `lib/editorial/pipeline.ts`, `prepareRecap`. Chaque sujet reçoit `recap_id` avant la création de la tâche `triage`. Ces écritures ne forment pas une transaction unique. Au nouvel essai, seuls les sujets `recap_id IS NULL` sont sélectionnés.

Scénario : interrompre après l'affectation des sujets et avant `enqueue(triage)`. À la reprise, les sujets déjà affectés sont oubliés ; si tous l'étaient, le récapitulatif devient `empty`. Une interruption après la création d'un document mais avant sa tâche d'extraction présente une fenêtre similaire : la recollecte voit la même empreinte et ne recrée pas la tâche manquante.

Attendu : rendre atomiques l'affectation et l'enregistrement des tâches, ou reconstruire systématiquement les tâches manquantes depuis les objets persistés. Ne pas maintenir de transaction pendant le réseau. Tests par injection d'une erreur exactement entre écritures, puis reprise : mêmes documents/sujets, pas de perte, une tâche utile par clé.

## B002 — importante — coûts non rapprochés définitivement ou recalculés au mauvais tarif

Constat statique dans `pollBatches`. Le lot passe à `ended` avant `provider.getUsage`. La prochaine collecte ne recherche que les lots `submitted`. Si `getUsage` retourne null ou échoue une fois, la réservation n'est plus rapprochée automatiquement : capacité budgétaire bloquée et coût réel absent. Une interruption à cet endroit produit le même effet.

De plus, le coût utilise `loadConfig().prices` au moment du rapprochement, pas les prix du lot à sa soumission. Une modification de prix pendant le traitement modifie donc rétroactivement son coût calculé.

Attendu : états de traitement et de rapprochement indépendants ; reprise des lots terminés non rapprochés, sans réappliquer leurs résultats. Conserver par lot un instantané modèle/tarifs/devise et le prendre pour base du calcul (ou montant facturé vérifiable). Tests : usage absent puis disponible, exception puis reprise, interruption après résultats, prix modifiés pendant le lot, replay sans double coût. Une réservation reste conservée tant que l'usage est inconnu.

Le majorant fondé sur caractères/2 reste une simulation 2A, pas une garantie pour des appels réels. Le remplacer dans 2B par une borne défendable couvrant la requête réellement envoyée avant toute activation payante.

## B003 — importante — une citation présente ne valide pas l'affirmation

**Reproduction exécutée** par appel direct de `validateDraft` : document « Le laboratoire annonce un prototype de robot destiné à la recherche. », titre « Un robot guérit toutes les maladies », résumé affirmant un million de patients guéris et essais cliniques confirmés, statut `published`. Une claim inventée contenant la citation réelle du prototype obtient `{ ok: true }`.

Le validateur vérifie seulement que la citation figure dans le document. Ni la relation citation/affirmation, ni la couverture du titre/résumé, ni le statut ne sont vérifiés. Les flags fournis par le rédacteur restent une autoévaluation. Le résultat peut ensuite devenir `ready`.

Attendu : distinguer validation structurelle et vérification éditoriale ; tant qu'une vérification indépendante de fidélité et de statut n'est pas disponible, ne pas attribuer `ready` sur ces seuls contrôles. Prévoir un verdict indépendant/injectable avec preuves et blocage en cas d'absence ou d'incertitude. Le modèle vérificateur peut se tromper : ne pas promettre une preuve sémantique absolue ; conserver aussi la recette humaine D4. Ajouter des cas adverses titre/résumé/chiffres/statut avec citation réelle sans rapport. En 2A le fournisseur de fixture peut fournir des verdicts explicitement simulés, visibles comme tels.

## B004 — importante — le bail ne protège pas les mutations métier

Constat statique : `complete` et `fail` dans `tasks.ts` contrôlent seulement `lease_owner`, sans expiration ni génération du bail. Les handlers de `runLocalTasks` modifient documents/sujets/récapitulatifs avant d'appeler `complete`. Le refus de compléter une tâche ne retire donc pas les écritures déjà effectuées par l'ancien worker.

Scénario : A attend une réponse réseau, son bail expire, B reprend, A reçoit son résultat puis écrit. Même si A a un owner distinct, ses écritures métier ont déjà eu lieu ; avec un owner réutilisé, son complete peut également terminer le travail de B.

Attendu : jeton/génération unique par réclamation, vérifié avec l'expiration dans la transaction qui applique les mutations métier et clôture la tâche. Renouvellement possible pour les étapes longues, sans remplacer le contrôle final. Tests : ancien worker libéré après reprise par B, owner réutilisé, bail expiré sans nouvelle réclamation ; aucune mutation métier de A ni clôture du bail de B. Tester les mutations, pas seulement la valeur de retour de `complete`.

## Réponses aux quatre points de Claude

1. Verrou PGlite et arrêt du serveur avant worker : compromis accepté pour le développement local, à documenter. PostgreSQL requis pour web/worker simultanés. Pas de changement d'infrastructure demandé pour 2A.
2. Fenêtres de préparation qui se chevauchent : ne pas laisser deux récapitulatifs réclamer les mêmes sujets. Préparer les créneaux dans l'ordre, sérialiser l'affectation et refuser explicitement une politique non supportée plutôt que produire silencieusement une édition vide. Cette protection complète B001.
3. `planned → ready` sans `draft` intermédiaire : accepté, si `ready` signifie validé en brouillon selon B003, jamais publié.
4. Motifs d'exclusion supplémentaires avec `ignored` : acceptés. Garder leur distinction avec `review_required`.

## Écarts conservés pour la suite

Regroupement sémantique règle 3 absent ; développements et publication absents ; intégration Claude absente. Écarts correctement annoncés, aucun de ces éléments n'est validé comme terminé. Avant activation réelle, terminer regroupement, comptage fournisseur/budget, fraîcheur à la publication, autorisations des sources et recette humaine. Les choix produit D3/D8 ouverts restent ouverts.

## Contre-revue après CL006 — 12 novembre 2026

B001 à B004 acceptées dans le périmètre 2A simulé. Revue des transactions collecte/préparation, jetons de bail, rapprochement indépendant avec tarifs figés et étape de vérification séparée effectuée. Tests indépendants : 44/44 ; TypeScript réussi ; HTTP 19/19 sur base isolée `/private/tmp/valyo-codex-lot2a-r2-20261112` (serveur arrêté après recette).

Les tests ajoutés exercent effectivement les écritures après perte de bail, les rollbacks aux points d'interruption, les reprises de rapprochement et la reproduction éditoriale trompeuse. Le garde-fou lexical est une heuristique complémentaire ; il ne constitue pas une garantie de fidélité. L'acceptation porte sur le mécanisme et ses fixtures, pas sur une vérification Claude réelle.

Lot 2A accepté pour poursuivre le développement. Aucun appel payant ni publication publique. Réserves de lancement inchangées : PostgreSQL multi-connexions, recette navigateur/clavier, regroupement sémantique, majorant fournisseur défendable et échantillon réel relu humainement. Le modèle est déclaré validé par le porteur dans CL006 ; le plafond budgétaire manque toujours.
