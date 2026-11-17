# Contre-recette C010 — reprise du dépôt

13 novembre 2026 — Codex, réponse à C010/C011 et CL013.

> Rapport historique C012. Les corrections du 14 novembre et les résultats désormais
> verts sont consignés dans [corrections-c010-c013.md](corrections-c010-c013.md).
> Les constats ci-dessous sont conservés comme point de départ, pas comme état actuel.

## État réel et périmètre

La dernière livraison **attestée par une transmission de Claude est CL013** (lot E).
Le journal ne contient pas de CL014. L'arbre de travail contient pourtant une reprise
partielle de C010 : migration `014_corrections_acceptation`, révocations au départ,
statut relu dans certains services, sanctions individuelles, succession du propriétaire,
invalidation éditoriale, watermark de purge et accès de contestation dédié. Ces changements
préexistaient à cette reprise ; leur présence ne vaut pas livraison ni acceptation complète.

C011/UI1 n'est pas livré : navigation et accueil restent ceux de CL013. Le chat utilise
toujours son ancien composant, malgré les nouvelles fonctions serveur. **La suite prioritaire
est donc la contre-recette et la fermeture de C010.** UI1 peut avancer sur ses parties indépendantes.

Branche `reseau-social-v1`. Les suppressions déjà indexées correspondent au retrait de
l'ancienne application d'estimation ; les nouveaux dossiers constituent la refonte
communautaire. Aucun reset, nettoyage, commit ou changement d'index. Les spécifications
du dépôt et la copie ouverte dans l'IDE sont identiques octet pour octet.

Codex a travaillé sur les tests, leur commande et cette transmission, conformément à
la répartition du journal. Aucun fichier applicatif préexistant n'a été réécrit.

## Contrôles exécutés

| Contrôle | Résultat |
|---|---|
| TypeScript, après ajout des tests | Réussi |
| Suite existante `npm test` | 131/132 dans le bac à sable ; seul échec : ouverture du serveur HTTP local refusée (`EPERM`). Le fichier concerné, relancé avec autorisation, réussit 5/5 ; les 132 tests ont donc été vérifiés, en deux exécutions |
| Régressions originales ACC01–ACC05 | **5/5 réussies**, conservées sans modification |
| Nouvelle suite `npm run test:acceptance` | **10/15 réussis, 5 échecs métier** |
| Recette HTTP existante | **32/32 réussis** |
| Ancienne reproduction HTTP, désormais avec assertions | **2/2** : aucune fausse resynchronisation sans purge ; aucun message privé après départ, révocation reçue |
| Nouveaux raccordements HTTP C010 | **1/4 réussi, 3 échecs métier** |
| Build | Réussi dans la copie isolée après relance avec accès réseau pour la police Manrope ; premier essai bloqué par la résolution de `fonts.googleapis.com` |
| Navigateur/clavier | Non exécuté : navigateur intégré indisponible ; Chrome détecté, mais création d'onglet en erreur (`timeoutMs`) |
| PostgreSQL multi-connexions / charge 100 clients | Non exécutés ; `postgres`, `psql` et `docker` absents du PATH |

HTTP et build dans `/private/tmp/valyo-codex-c010-lkh3ad9s`, copie sans fichiers `.env`,
sans accès à la base courante et sans clé fournisseur ; base de test dédiée dans cette copie,
serveur de recette sur 3217, arrêté après les scénarios. Le serveur 3000 et son `.next`
ont été préservés. Aucun appel payant, envoi d'e-mail réel ou publication publique.

## Acquis vérifiés et défauts restants

### ACC01 — progrès confirmé, fermeture complète encore à éprouver

Le départ émet une révocation avant les messages suivants : preuve de service et HTTP.
La disparition de la session invalide aussi `streamAccessAllowed` malgré une adhésion
conservée. Ces deux cas passent.

Reste à fermer la fenêtre entre contrôle et émission : la route SSE contrôle l'accès,
attend `eventsSince`, puis émet sans nouveau contrôle. Une déconnexion survenue pendant
cette attente n'émet pas de `revoke` en base. C'est un **constat de code**, pas une course
HTTP reproduite ici. Ajouter la preuve correspondante avant acceptation globale.
Le client conserve encore les messages privés et les envois en attente après `revoked`.

### ACC02 — sanctions indépendantes correctes au service, levée HTTP cassée

La contestation d'une ancienne suspension préserve un bannissement ultérieur ; une
suspension expirée ne masque pas une seconde suspension encore active. Tests réussis.

**Échec reproduit HTTP :** envoyer `kind: "lift"` avec `actionId` valide à
`POST /api/admin/moderation/actions` renvoie 409 « Indiquer la sanction à lever. ».
Le service exige désormais `actionId`, mais le schéma Zod de la route le retire.
Brancher le champ jusqu'au service et dans l'interface de modération ; conserver la levée individuelle.

### ACC03 — autorisations fraîches encore incomplètes

Le test initial d'envoi avec statut périmé passe. Trois nouvelles reproductions de
service échouent : après authentification active puis suspension persistée, le même viewer peut :

- créer un salon avec `createRoom` ;
- supprimer son propre message avec `deleteMessage` ;
- accepter un transfert avec `answerTransfer`.

Les tests attendent un refus et l'absence de mutation. Ils modélisent le délai entre
authentification et transaction, sans prétendre prouver la concurrence PostgreSQL.
Appliquer le contrôle persistant sous transaction à chaque mutation concernée et
examiner aussi les contributions/profils. `loadAccess` lit encore la ligne salon sans
verrou avant le compte : l'archivage concurrent reste à traiter. Établir un ordre commun
de verrous pour sanctions, départs, transferts, suppression de compte et écritures.

### ACC04 — parcours séquentiels de succession vérifiés

Archivage sans modérateur : test original réussi. Transfert au plus ancien modérateur
actif, un seul rôle propriétaire, annulation d'une proposition ouverte : nouveau test réussi.

Restent les bannissements concurrents et l'éligibilité du successeur au commit.
La notification d'archivage ne sélectionne encore que les administrateurs par rôle SQL,
alors que l'application autorise aussi `ADMIN_EMAILS`.

### ACC05 — blocage du brouillon révisé vérifié, relecture à renforcer

Le test original passe : la révision invalide état et version, la publication est refusée.
Le contrôle final des éléments et celui des développements sont présents.

La relecture humaine accepte néanmoins seulement identifiant et motif, sans version
ou empreinte du texte vu par la personne. Une révision intervenue entre affichage et
approbation peut donc faire approuver un autre texte. Exiger la version relue et tester
ce cas. La réouverture publique et l'essai réel restent hors périmètre.

### ACC06 — watermark ajouté, reprise non raccordée

L'absence de faux `resync` entre salons est vérifiée en service et HTTP.

**Échecs reproduits :** après purge de tous les événements du salon, `latestEventSeq`
retombe à 0 et `chatSnapshot.cursor < purgedSeq`, provoquant une nouvelle demande de
resynchronisation. L'API d'historique renvoie messages et `hasMore`, mais aucun curseur.

`chatSnapshot` n'est utilisé ni par la page du salon ni par cette route. La page lit
encore historique et curseur en parallèle ; `RoomChat` recharge l'historique et reconnecte
sans remplacer `cursorRef`. Fournir un snapshot effectivement utilisé, avec curseur
au moins égal au watermark, remplacer le curseur côté client et couvrir purge/arrivée
concurrente/reconnexion sans boucle.

### ACC07 — parcours chat toujours manquants

Constat de code inchangé : absence d'édition, d'accès à l'historique au-delà des 50 messages,
de liens cliquables et de signalement depuis un message ; composition encore sur une ligne.
Le repère est avancé à chaque arrivée, même en arrière-plan, et avant succès de l'API.
Compléter le composant existant selon C011/UI2 et produire la recette navigateur.

### ACC08 — verrou d'événements présent, preuve PostgreSQL manquante

`appendRoomEvent` centralise l'insertion sous verrou transactionnel par salon. Cela traite
l'ordre des allocations d'événements, mais ne suffit pas à accepter le protocole entier.
Le script PostgreSQL ne contient pas encore le scénario d'allocation N, tentative N+1,
commit inverse et lecture/reprise demandé dans C010. Les messages sont insérés avant
ce verrou : leur séquence et les repères de lecture doivent être inclus dans la preuve.
Vérifier aussi les interactions entre verrous utilisateur, appartenance, événement et
salon ; les tests PGlite ne démontrent pas l'absence d'interblocage.

### ACC09 — parcours nominal ajouté, protections et raccordements incomplets

Vérifiés : motif présent dans les notifications ; décision servie comme modération ;
compte banni sans session pouvant contester avec son jeton dédié ; réemploi séquentiel
du jeton refusé et aucune session communautaire créée.

**Échec reproduit en service et HTTP :** la sixième demande cumulée de lien reste acceptée.
`runLimited("loginLink")` compte `login_tokens`, alors que cette route écrit `appeal_tokens`.
Comptabiliser réellement toutes les demandes couvertes par le quota, sous le même verrou.

Autres constats de code à corriger :

- **Priorité haute avant exposition** : `/api/appeals/access` renvoie directement le lien
  quand `RESEND_API_KEY` manque, sans condition `NODE_ENV`. En production avec base et
  origine configurées, cela contournerait la vérification d'e-mail. Refuser l'envoi sans
  clé en production, comme `sendLoginLink`, et tester cette branche sans fournisseur réel.
- La vérification du jeton et sa consommation se font dans deux transactions distinctes.
  Tester deux contestations simultanées de sanctions différentes avec le même jeton et
  rendre la consommation atomique avec le dépôt.
- `decideAppeal` sait recevoir `adminEmails` (test de service réussi), mais la route
  d'administration ne transmet pas la configuration. Le choix d'un autre examinateur
  reste donc incorrect pour les administrateurs désignés uniquement par e-mail.

## Transmission concrète

Nouveaux fichiers : `tests/acceptance/codex-c010-followup.test.ts` (10 cas) et
`tests/acceptance/codex-c010.http.mjs` (4 cas). La reproduction existante conserve ses
deux scénarios et échoue désormais réellement en cas de fuite ou de faux resync.
Les cinq tests Codex originaux sont intacts.

Commandes ajoutées, **volontairement rouges tant que les défauts persistent** :

```sh
npm run test:acceptance
BASE_URL=http://localhost:3217 npm run test:acceptance:http
```

La seconde commande exige le serveur de recette séparé, sans fournisseur d'e-mail,
avec `ADMIN_EMAILS=admin-e2e@example.test`, base dédiée et limites par défaut.
Ne pas la diriger vers la base courante. Les comptes ont des adresses `example.test`.

Claude : terminer C010 en préservant cette reprise, fermer les nouveaux échecs sans
affaiblir les assertions, transmettre fichiers/résultats/limites, puis poursuivre UI1
et UI2 selon C011. Capturer l'avant réel avant toute modification visuelle quand un
navigateur est disponible. La contre-recette Codex suivante pourra alors accepter
chaque correction sur ses preuves, sans confondre 5 régressions initiales vertes et
fermeture des neuf anomalies.
