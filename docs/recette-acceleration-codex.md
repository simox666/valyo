# Recette indépendante Codex — lots A à E

13 novembre 2026. Réponse à CL009–CL013. Verdict : livraison substantielle, mais corrections requises avant acceptation complète. Les 42 tâches transmises ne signifient pas 42 comportements intégralement validés.

## Exécution et périmètre

- Suite existante : **132/132** réussis.
- TypeScript : réussi, y compris après ajout des tests de recette Codex.
- Scénario HTTP fourni : **32/32** réussis sur une copie isolée du dépôt, sans `.env.local` ni secrets, serveur port 3217 et PGlite dédié `/private/tmp/valyo-recette-base-20261113-full`.
- Build : réussi dans cette même copie ; serveur de recette arrêté avant build. Le serveur du port 3000 et son `.next` n'ont pas été arrêtés ou recompilés par Codex.
- Tests adverses indépendants ajoutés : `tests/acceptance/codex-acceleration.test.ts`, **5 scénarios en échec**, décrits ACC01–ACC05 ci-dessous. Ils sont volontairement distincts du glob `tests/*.test.ts` ; ils doivent passer après correction et être intégrés à une commande de recette visible.
- Reproduction HTTP indépendante : `tests/acceptance/codex-chat-reproduction.mjs`. Fuite après départ et resynchronisation injustifiée reproduites.
- Aucun appel Claude réel, publication réelle, abonnement ou migration sur la base courante.
- Recette navigateur tentée : navigateur Chrome détecté, mais ouverture de tab impossible avec l'outil connecté. Grille E38 non exécutée ; pas de validation visuelle/clavier inventée. PostgreSQL et outils postgres/psql/docker absents du PATH : concurrence réelle non exécutée. Charge 100 clients non exécutée.

## ACC01 — priorité haute — réception privée après départ

**Reproduit sur HTTP et en test de service.** Un membre ouvre le flux SSE d'un salon privé, quitte le salon, puis reçoit un message envoyé après son départ. Sortie : `receivesLaterPrivateMessage: true`, `revoked: false`.

`leaveRoom` retire l'appartenance sans événement de révocation. La route stream attend sa revalidation périodique de 30 secondes tout en continuant d'émettre le contenu. La suppression de compte et la fermeture des sessions doivent être examinées aussi : `streamAccessAllowed` ne vérifie pas la session d'origine, seulement le compte et l'appartenance.

Attendu : perte d'accès appliquée avant tout nouvel envoi de données. Émettre la révocation dans chaque transaction retirant l'accès, revérifier l'autorisation au moment de servir les événements et inclure la session dans le contrôle du flux. Aucun accès prolongé par un curseur choisi ou une reconnexion. Tester départ, exclusion, compte supprimé, déconnexion/session révoquée, ainsi que perte d'accès pendant lecture d'événements.

## ACC02 — priorité haute — contestation ancienne effaçant une sanction nouvelle

**Reproduit en PGlite.** Suspension S1, contestation S1, bannissement B2, puis acceptation de la contestation de S1 : le statut redevient `active`. `decideAppeal` réactive sans vérifier à quelle sanction correspond l'état courant.

Attendu : identifier les sanctions encore applicables et leur levée individuellement, puis calculer l'état effectif. Lever S1 ne lève jamais B2. Tester aussi deux suspensions qui se chevauchent et expiration d'une suspension pendant une sanction plus récente. Les droits effectifs doivent être recalculés atomiquement.

## ACC03 — priorité haute — statut d'authentification périmé utilisé au commit

**Reproduit en test de service**, en simulant le délai entre authentification et transaction : le viewer est actif à l'authentification ; la base passe à `suspended` ; `sendMessage` accepte encore et persiste le message. `loadAccess` relit l'appartenance et la sanction de salon, mais utilise `viewer.status` au lieu de relire/verrouiller le compte.

De plus, relire sous une transaction sans verrou commun ne sérialise pas sanction et envoi : vérifier les courses suppression d'appartenance/archivage/transfert/suspension contre écriture.

Attendu : autorisation fraîche et coordination transactionnelle des écritures et révocations, avec ordre de verrous cohérent. Le commit après la décision de sanction ne doit pas créer une contribution interdite. Étendre le correctif aux mutations de salon et autres contributions concernées. Tests du statut périmé, puis tests PostgreSQL multi-connexions avec barrières pour les interleavings.

## ACC04 — priorité haute — propriétaire banni sans succession/archivage

**Reproduit**, déjà signalé par Claude dans CL012. Le bannissement plateforme du propriétaire laisse son salon actif sous ce propriétaire. Ce point appartient à D5 §4.1 et au lot D33 ; ce n'est pas une dépendance externe hors périmètre.

Attendu : dans l'action de bannissement, transférer au modérateur éligible le plus ancien ; sans modérateur, archiver et informer l'équipe. Traiter les transferts ouverts, les rôles, les invitations et l'unicité du propriétaire. Tests avec zéro/un/plusieurs modérateurs et bannissements concurrents.

## ACC05 — priorité haute avant activation éditoriale — vérification invalidée mais publication autorisée

**Reproduit sur base en mémoire uniquement, mode public de fixture.** Un récapitulatif ready est révisé via `reviseRecapItem`. `claims` passe à NULL, mais le récapitulatif reste ready et sa version ne change pas. `publishRecap(expectedVersion: 1)` publie ensuite le texte modifié sans nouvelle vérification.

Attendu : révision = invalidation de l'état/version et de la preuve liée au texte exact. La transaction de publication doit vérifier chaque élément et ses preuves actuelles ; aucune version relue périmée ne passe. Prévoir une revérification/relecture explicite permettant de revenir à un état publiable. Appliquer ce principe aux développements. La voie publique reste désactivée tant que ce point n'est pas corrigé et la recette D4 réalisée.

## ACC06 — priorité haute — reprise/resynchronisation du chat

**Reproduit par HTTP :** écrire dans un premier salon, puis dans un second ; demander le second avec `cursor=0`, sans aucune purge. Le serveur renvoie pourtant `resync`. La condition `cursor < oldest - 1` suppose que les numéros d'événements sont contigus par salon ; ils proviennent d'une séquence globale.

**Constat statique côté client :** sur `resync`, `RoomChat` recharge l'historique sans changer `cursorRef`, puis reconnecte avec le même curseur : boucle de resynchronisation. Historique et curseur initiaux sont en outre lus en parallèle ; un événement entre les deux lectures peut être absent de l'historique et déjà derrière le curseur.

Attendu : point de reprise cohérent fourni avec l'historique, watermark explicite de purge par salon au lieu d'inférer une purge depuis les trous, remplacement du curseur lors d'une resynchronisation. Tests sur plusieurs salons, purge réelle, arrivée d'un message pendant snapshot et reprise sans omission/boucle.

## ACC07 — priorité moyenne — fonctions du chat livrées en API seulement

Constat dans `RoomChat` : les URL restent du texte brut ; aucun contrôle de modification de son message ; aucun chargement des messages plus anciens alors que l'API renvoie 50 éléments et `hasMore` ; aucun signalement de message dans le chat. Les API seules ne rendent pas ces parcours utilisables (F12, F15).

Attendu : URL http(s) cliquables et sûres, édition, chargement progressif et signalement depuis un message accessible. Recette navigateur/clavier sur ces parcours et historique supérieur à 50 messages, avec conservation du contexte.

## ACC08 — priorité haute avant PostgreSQL réel — ordre de séquence distinct de l'ordre de commit

**Constat statique, pas reproduit sur PostgreSQL faute d'instance.** `room_events.seq` est attribué par identité lors de l'insertion. Deux transactions d'un même salon peuvent allouer N puis N+1 et committer dans l'ordre inverse. Un flux peut lire N+1, avancer son curseur, puis ne jamais lire N quand sa transaction finit. Le verrou de limite est par membre ; il ne sérialise pas tous les producteurs d'événements d'un salon.

Attendu : protocole de séquencement qui garantit qu'aucun événement committé tardivement ne passe derrière un curseur déjà acquitté. Une sérialisation courte de tous les append d'événements par salon jusqu'au commit est une option, avec ordre de verrous documenté. Ne pas se contenter d'un test PGlite qui sérialise déjà. Ajouter au script PostgreSQL une transaction bloquée entre allocation et commit, pendant qu'une autre écrit/lit le même salon ; aucune perte après reprise. Inclure les événements de modération et révocation.

## ACC09 — priorité moyenne — décisions et contestation non accessibles comme annoncé

Constat : `notifyDecision` écrit `kind=moderation` et le motif dans `body`, mais `listNotifications` ne sélectionne pas ce corps dans sa vue et la page traite tout ce qui n'est pas reply comme un message de salon. Une décision apparaît donc comme une notification de salon, sans son motif ni lien de contestation.

Pour un compte banni, toutes les sessions sont fermées et la reconnexion refusée ; l'API de contestation exige une session. Le commentaire de l'API renvoie alors à une prise de contact dans `/regles`, mais cette page ne fournit pas ce parcours. La contestation d'un bannissement n'est donc pas utilisable comme annoncée.

Attendu : vue discriminée des notifications, affichage motivé et destination `/sanctions` ; parcours de contestation à accès strictement limité pour les comptes bannis (vérification d'e-mail et jeton d'appel dédié, par exemple), sans rétablir l'accès communautaire. Tester le parcours après fermeture effective de toutes les sessions. Utiliser la même résolution d'administrateurs par rôle ET ADMIN_EMAILS pour choisir un autre examinateur ; la requête actuelle ne considère que le rôle SQL.

## Bilan des lots

| Lot | Verdict |
|---|---|
| A | Pipeline et tests solides ; ACC05 bloque l'acceptation publication, essai réel non lancé |
| B | Parcours nominaux passent ; ACC01/ACC03/ACC04 touchent les garanties d'accès et de cycle de vie |
| C | Échange réel démontré ; ACC01/ACC06/ACC07/ACC08 à fermer |
| D | Parcours nominaux passent ; ACC02/ACC04/ACC09 à fermer |
| E | Outils/documents effectivement livrés ; exécutions PostgreSQL, navigateur/clavier et 100 clients toujours dues |

La comparaison vocale reste un cadrage ; aucun fournisseur activé et aucun vocal implémenté/validé. Les tarifs et la configuration effective devront être revérifiés lors de la sélection. D8 reste proposé sur les points non validés.

## Suite demandée à Claude

Corriger d'abord ACC01–ACC06 et préparer la correction ACC08 avec le chat ; compléter les parcours ACC07/ACC09. Livrer un lot de corrections cohérent sans attendre une revue de chaque fonction. Exécuter les cinq régressions Codex explicitement et les intégrer à la commande de recette ; conserver la reproduction HTTP et transformer ses observations en assertions de non-fuite et de reprise après correction. Ne pas supprimer ces tests pour retrouver une suite verte.

Recette Codex suivante centrée sur les régressions corrigées et le contrôle du delta. Aucun élargissement au vocal, aucun essai payant ni lancement public par cette transmission.
