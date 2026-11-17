# Corrections C010 — livraison C013

14 novembre 2026 — Codex, à la demande du porteur de poursuivre les corrections.

## Point de départ et périmètre

CL013 demeure la dernière livraison attestée de Claude. C012 avait identifié une
reprise partielle de C010, déjà présente sans CL014, et huit régressions encore rouges.
Ces modifications sont conservées. Cette livraison complète C010 dans le dépôt actuel ;
elle ne constitue ni CL014 ni une validation indépendante du code écrit par Codex.

Les suppressions indexées de l'ancienne application et les autres modifications locales
ont été préservées. Aucun commit ni changement d'index. Pas de nouvelle migration :
réutilisation de la migration 014 préexistante. Aucun nouveau fournisseur ou paramètre requis.

## Corrections et preuves

| Point | Correction apportée | Vérification / limite |
|---|---|---|
| ACC01 | Les lots SSE contrôlent la session d'origine, le compte et l'adhésion sous les verrous des révocations, jusqu'à l'émission synchrone. Le client ferme le flux et efface messages, brouillon et envois en attente à la perte d'accès. | Tests de service et HTTP de départ/révocation verts. Course réelle multi-connexions et effacement visuel complet encore à exercer. |
| ACC02 | La route conserve et exige `actionId` pour une levée. La console présente les sanctions actives avec motif et confirmation de levée individuelle. | Sanctions superposées et raccordement HTTP verts. |
| ACC03 | Contrôles frais dans les transactions de création de salon, transfert, messages, publications/commentaires, profil, thèmes, suivis, blocages et signalements. Archivage, sanctions et suppression de compte partagent un ordre de verrouillage explicite. Une nouvelle session est refusée pour un compte banni/supprimé. | Identités authentifiées avant suspension refusées dans les régressions. Scénarios PostgreSQL ajoutés, pas exécutés. |
| ACC04 | Succession préexistante conservée, départage stable par ancienneté puis identifiant. Administrateurs actifs résolus par rôle ou `ADMIN_EMAILS`, y compris les destinataires d'un archivage. | Succession/archivage et configuration administrateur testés. Concurrence PostgreSQL non prouvée. |
| ACC05 | La relecture reçoit la version affichée et atteste une empreinte du texte, des sources et du statut scientifique. Une révision invalide cette preuve. Le parent est verrouillé avant de relire l'élément dans un nouveau snapshot, y compris pour la correction publiée. | Ancienne version refusée, relecture valide acceptée, révision suivante invalidante ; contrôles de publication conservés. |
| ACC06 | Curseur au moins égal au watermark après purge complète ; purge bornée aux événements existants. Page/API/client utilisent un snapshot cohérent. `resync` ferme l'ancien flux, recharge puis remplace réellement le curseur. | Purge complète, absence de boucle/faux resync et curseur HTTP testés. |
| ACC07 | Le composant de chat existant propose édition, historique paginé, liens http(s), signalement, multiligne, retour au bas et lecture conditionnée à la visibilité. Envoi IME protégé, relance idempotente et saisie conservée sur erreur récupérable. | Types/build/HTTP verts. Connexion, multiligne, envoi et ouverture d'édition observés dans Chrome ; recette visuelle restante détaillée séparément. |
| ACC08 | Verrou du salon pris avant allocation des séquences de messages et événements, tenu jusqu'au commit. Les lecteurs prennent le verrou partagé pour leurs snapshots/lots. | Script PostgreSQL enrichi avec barrières explicites et inspection de `pg_blocking_pids`. Exécution encore due : PGlite ne prouve pas l'ordre des commits concurrents. |
| ACC09 | Quota commun des liens de connexion/contestation ; dépôt et consommation du jeton atomiques, sans consommation sur refus métier. Envoi dédié par e-mail, pas de lien de développement en production sans clé. Résolution des autres administrateurs centralisée. | Quota, usage unique, absence de session communautaire et refus production 503 vérifiés. Aucun véritable e-mail envoyé. |

## Contrat de verrouillage

`lib/community-locks.ts` définit l'ordre : verrou de limite éventuel, barrière partagée
de communauté, verrou de salon éventuel, puis lignes métier. Une sanction de plateforme,
une fermeture de session ou une suppression de compte prend d'abord la barrière exclusive.
Elle attend la fin des écritures/émissions en cours ; celles qui arrivent après attendent
son commit puis relisent les droits. Les salons distincts conservent leurs propres verrous.

Les verrous sont transactionnels : les services concernés doivent recevoir un `q` de
transaction. Aucun verrou n'est conservé pendant l'attente du polling, un appel fournisseur
ou toute la durée d'un flux. Une révocation ne peut pas rappeler des octets déjà transmis
avant sa validation. Le comportement sous charge de cette barrière commune reste à mesurer
sur PostgreSQL réel ; ne pas extrapoler les résultats PGlite à 100 connexions.

## Contrôles exécutés

| Commande / contrôle | Résultat |
|---|---|
| `npm run typecheck` | Réussi |
| `npm test` | **136/136**, dont trois cas de sécurité C010 et un cas de relecture supplémentaires ; ouverture localhost autorisée pour le test réseau |
| `npm run test:acceptance` | **15/15** ; régressions C010 précédentes conservées sans affaiblissement |
| `BASE_URL=http://localhost:3217 npm run test:e2e` | **32/32** |
| Reproduction SSE `codex-chat-reproduction.mjs` | **2/2** : aucun faux resync, aucun message privé après départ |
| `node --test tests/acceptance/*.http.mjs` sur 3217 | **4/4** |
| `npm run test:acceptance:production` sur build isolé 3218 | **1/1** : 503 sans clé e-mail, aucun `devLink` ni cookie de session, sans base configurée |
| Build Next.js dans la copie isolée | Réussi : compilation, typage, génération et traces terminés |
| TypeScript dédié à `scripts/recette-concurrence.mts` | Réussi ; le script refuse aussi explicitement de démarrer sans `DATABASE_URL_TEST` |
| `git diff --check` | Réussi |

Le script PostgreSQL comporte désormais trois scénarios supplémentaires : transaction A
retenue avant commit et écriture B bloquée, puis reprise du curseur sans omission ; suspension
et archivage validés pendant qu'une écriture déjà authentifiée attend. Le script est livré
et vérifié statiquement, **pas exécuté sur PostgreSQL**.

## Isolation et suite

HTTP, démonstration et build ont utilisé `/private/tmp/valyo-c013-recette-63ocbe3h`,
sans fichiers `.env` ni clés, avec PGlite dédié et comptes `example.test`. Ports 3217 et
3218 arrêtés après recette. Le serveur 3000, son `.next` et sa base n'ont pas été utilisés.
Aucun appel payant, e-mail réel ni publication publique. Sauvegarde préalable des sources
dans `/private/tmp/valyo-c013-avant-io1mmi3o` ; ces chemins temporaires ne sont pas des
artefacts durables de livraison.

Compte rendu navigateur : [recette-interface/C013-chat.md](recette-interface/C013-chat.md).
La recette E38 complète, les captures avant/après aux trois largeurs et la concurrence
PostgreSQL restent dues. C011/UI1 (navigation, accueil, publication) n'est pas implémenté
par cette livraison ; le travail de chat recouvre une partie de UI2 sans valider UI2.
La prochaine tranche peut reprendre UI1 selon le contrat existant, en conservant ces tests.
