# Valyo — réseau social francophone des nouvelles tech et science

« Valyo » est un nom de travail. La spécification fonctionnelle de référence est dans
[docs/specifications-fonctionnelles.md](docs/specifications-fonctionnelles.md). Les précisions
de mise en œuvre et les décisions encore à valider sont dans [docs/decisions.md](docs/decisions.md).

L'ancienne application (estimation d'objets par photo) a été retirée. Elle reste
récupérable avec l'étiquette Git `valyo-estimation-final`.

## Démarrer en local

```bash
npm install
npm run dev          # http://localhost:3000
```

Aucun service externe n'est nécessaire en développement :

- **Base de données** : sans `DATABASE_URL`, une base PostgreSQL embarquée (PGlite) est créée dans `.data/pglite`. Les migrations s'appliquent au premier accès. Pour repartir de zéro, supprimez ce dossier.
- **E-mails** : sans `RESEND_API_KEY`, le lien de connexion s'affiche à l'écran (encadré « Mode développement ») et dans le terminal. Aucun e-mail n'est envoyé.

Pour la configuration, copiez `.env.local.example` en `.env.local`.

## Tests

```bash
npm run typecheck
npm test                                   # tests unitaires
npm run test:acceptance                     # régressions C010 (15 cas)
VALYO_TEST_HOOKS=1 ADMIN_EMAILS=admin-e2e@example.test PGLITE_DIR=.data/pglite-test PORT=3100 npm run dev   # serveur sur une base de test
BASE_URL=http://localhost:3100 npm run test:e2e     # dans un autre terminal
```

Le scénario de bout en bout crée de vrais comptes et de vraies publications : lancez-le
toujours sur une base de test, jamais sur la base de production.

La contre-recette HTTP C010 s'exécute séparément avec
`BASE_URL=http://localhost:3217 npm run test:acceptance:http`, sur une copie sans secrets
et une base dédiée, avec `ADMIN_EMAILS=admin-e2e@example.test` et les limites par défaut.
Elle refuse un autre port et n'envoie aucun e-mail réel. Les corrections et résultats actuels
figurent dans [docs/corrections-c010-c013.md](docs/corrections-c010-c013.md) ;
[docs/contre-recette-c010.md](docs/contre-recette-c010.md) conserve le constat antérieur C012.

Le garde-fou e-mail de production se vérifie avec `npm run test:acceptance:production` :
il exige un build isolé démarré sur `http://localhost:3218`, avec cette `APP_URL`,
sans `RESEND_API_KEY` ni `DATABASE_URL`. Résultat attendu : 503, aucun lien de développement,
aucune session. Ne pas utiliser la base ou les secrets du serveur courant.

## Mise en production

`DATABASE_URL`, `RESEND_API_KEY` et `APP_URL` sont obligatoires : sans eux, l'application refuse
de démarrer, d'envoyer des liens ou d'accepter des écritures, plutôt que de faire semblant.
`APP_URL` est la seule origine de confiance : aucun en-tête de proxy n'est pris en compte. Il faut aussi un domaine
d'envoi vérifié chez Resend (`RESEND_FROM_ADDRESS`), car l'adresse de test de Resend ne
livre qu'au propriétaire du compte.

## Choix techniques

| Sujet | Choix | Pourquoi |
|---|---|---|
| Application | Next.js 15 (App Router), React 19, Tailwind | Pile déjà en place, rendu serveur pour les pages publiques partageables |
| Données | PostgreSQL, SQL direct (`pg`) ; PGlite en local | Même dialecte partout, pas d'installation en développement |
| Connexion | Lien magique par e-mail (Resend), sessions en base | Vérifie la possession de l'adresse ; sessions révocables (déconnexion, suppression, suspension) |
| Sécurité des écritures | Contrôle d'origine + cookie `SameSite=Lax` + droits vérifiés côté serveur à chaque requête | Masquer un bouton ne protège rien |

À décider pour les étapes suivantes : exécution planifiée de l'agent éditorial (étape 2),
service temps réel pour le chat (étape 3) et service audio pour le vocal (étape 4).

## État d'avancement

Le développement suit l'ordre conseillé par la spécification (§14).

**Interface, livraisons C014–C015 (14 novembre 2026)** : navigation et accueil communautaire,
parcours publication → adhésion → chat, annuaire filtrable avec Mes salons et non-lus,
discussion en colonne principale avec messages en bulles, notifications filtrables et
lecture individuelle. [Voir l’aperçu local](http://localhost:3217/salons) et
[la livraison C015](docs/interface-c015.md). Les tests approfondis et la recette mobile
sont différés à la demande du porteur ; TypeScript et rendu des trois pages C015 vérifiés.

**Publier, livraison C016** : formulaire guidé par type, aperçu complet avant envoi,
confirmation de création avec lecture, partage et création d’un salon associé.
[Essayer le parcours](http://localhost:3217/publier) (connexion requise).
[Transmission actuelle à Claude](docs/transmission-claude-c016.md), avec contrôles
ciblés et limites ; aucune nouvelle validation complète annoncée.

### Étape 1 — Socle communautaire : livrée

- Inscription et connexion par lien e-mail à usage unique (15 min), retour au contexte après connexion, pseudonyme unique, nom affiché, acceptation des règles, centres d'intérêt facultatifs (F01).
- Profil public, modification du profil et des thèmes suivis, suivi de membres, suppression du compte avec politique affichée avant confirmation (F02).
- Fil « Pour vous » et « Récentes », filtre par thème, suivi d'un thème, chargement progressif avec retour à la même position (F03).
- Publication d'actualités (source obligatoire), de questions et de retours d'expérience ; détection des URL déjà partagées avec maintien possible ; modification avec mention « Modifié » ; suppression avec état indisponible (F04).
- Page de publication : sources, bouton « Tester » vers un service externe signalé comme tel, commentaires et réponses sur un niveau, « Commentaire supprimé », copie du lien avec solution de repli (F05).
- Limites anti-abus atomiques et configurables (`LIMIT_*`) : 5 demandes de lien par adresse et par heure, 10 publications et 60 commentaires par membre et par heure.
- Indicateurs réservés aux administrateurs (`/admin/indicateurs`, accès via `ADMIN_EMAILS`) : nouveaux membres reliés à un autre humain puis revenus la semaine suivante, et production humaine distinguée de celle de l'agent (decisions.md §5).

### Écarts connus et limites de l'étape 1

- Pas d'avatar : un monogramme est affiché à la place (l'envoi d'images n'est pas encore prévu).
- Pas de console d'administration : les thèmes (IA, Robotique, Espace) sont créés par la migration initiale.
- Pas de mise en attente par la modération (F04) ni de signalement et de blocage (F15) : prévus à l'étape 5. Les auteurs bloqués ne peuvent donc pas encore être exclus du fil.
- Pas de résumé proposé par l'agent à la rédaction (F04) : dépend de l'étape 2.
- Pas de bloc « salons associés » sous les publications : les salons arrivent à l'étape 3.
- Règles de la communauté et politique de confidentialité : versions provisoires, signalées comme telles sur les pages.
- Les noms de membres supprimés sont remplacés par « Membre supprimé » ; le texte de leurs contributions est conservé, comme le prévoit F02.

### Étape 2 — Agent éditorial : lot 2A livré (brouillons, sans appel payant)

Contrat : [docs/contrat-agent-editorial.md](docs/contrat-agent-editorial.md). Format éditorial : decisions.md D8.

- Console `/admin/editorial` (administrateurs) : état et paramètres manquants, configuration tracée, pause, budget, sources, récapitulatifs, sujets à examiner, tâches et lots, journal.
- Worker hors du site, un cycle borné par exécution : `npm run worker`. Le planificateur de l'hébergement le lance à intervalle régulier.
  - Avec la base embarquée, arrêtez `npm run dev` avant : un verrou empêche deux processus d'ouvrir la même base locale.
  - `EDITORIAL_TRANSPORT=fixtures npm run worker` lit `tests/fixtures/editorial/web` au lieu du réseau.
- Tout est désactivé par défaut : pause, mode brouillon, aucun fournisseur, aucune source active, aucune politique de récapitulatif. Une politique incomplète désactive l'étape concernée.
- Chaque brouillon passe par une vérification de fidélité indépendante (titre, résumé, affirmations, statut), contrôlée côté serveur. En 2A, cette vérification est simulée et affichée comme telle.
- Fournisseur de test déterministe uniquement (piloté par des marqueurs dans les fixtures). L'adaptateur Claude arrive au lot 2B, après le choix du modèle et du budget (D3).
- Collecte réseau protégée : adresses publiques uniquement après résolution DNS et à chaque redirection, connexion sur l'adresse vérifiée, limites de durée, taille, redirections et types.

### Lot 2B (développement sans dépense) : adaptateur Claude livré, non activé

- Adaptateur `lib/editorial/providers/claude.ts` : SDK officiel, traitement par lots, sorties structurées, aucune nouvelle tentative automatique à la création d'un lot, refus et troncatures traités comme des erreurs définitives.
- Borne de coût garantie avant toute soumission : limite d'entrée documentée du modèle, plus `max_tokens` en entier pour la sortie, soit environ 2,08 $ réservés par requête pour Opus 5.5 au tarif des lots. La taille des lots s'adapte au budget restant. Sans borne garantie, la soumission est refusée.
- Lecture des lots validée : résultats complets, uniques et cohérents avec les compteurs, sinon rien n'est appliqué ni rapproché.
- Sources documentaires vérifiées : [docs/sources-api-claude.md](docs/sources-api-claude.md). Tarifs à saisir pour Opus 5.5 en traitement par lots : 2 $ en entrée et 10 $ en sortie par million de jetons.
- Aucun appel réel n'est possible tant que le plafond mensuel n'est pas fixé. Les tests utilisent une fausse API aux réponses synthétiques (`tests/fake-anthropic.ts`).
- Le worker (`scripts/worker.mts`) lit `.env.local` pour trouver la clé, dont la valeur n'est jamais affichée ni enregistrée.

### Lot d'accélération A (13 novembre 2026) : outillage éditorial complété, toujours sans dépense

- **Commande d'essai borné** (`npm run essai`, protocole C008) : base dédiée exigée (`PGLITE_DIR` distinct), un sujet synthétique, au plus 3 créations de lot d'une requête, aucune relance de génération, état persistant avec reprise sans double soumission, aperçu sans génération, rapport exportable sans clé ni identifiant externe (`docs/essais-agent/`). L'essai réel attend la revue Codex et l'accord du porteur.
- **Regroupement règle 3** (même annonce chez deux émetteurs) : comparateur de contenus injectable (`lib/editorial/grouping.ts`), fusion non destructrice avec preuves, doute vers l'examen (`doublon_incertain`).
- **Révision éditoriale administrative** : correction d'un élément de brouillon avec motif, historique conservé, vérification de fidélité invalidée dès que le texte change.
- **Transaction de publication, retrait et correction** (`lib/editorial/publish.ts`) : derrière une capacité désactivée (mode public refusé par la console) ; au commit : fraîcheur à l'instant réel, doublons tardifs, unicité et version. Testée sur base en mémoire uniquement.
- **Rendu public des récapitulatifs** : nouvelles structurées avec ancres stables, statuts scientifiques, sources par nouvelle, distinction nette de l'agent. Recette sur données de démonstration (hook de test).
- **Développement lié** (« Développer ce sujet ») : demande ADMINISTRATEUR uniquement tant que D8 reste proposé ; mêmes tâches, vérification et budget ; état « origine indisponible », correction et retrait.
- **Recette D4 préparée** : grille de lecture des 40 éléments ([docs/recette-editoriale-d4.md](docs/recette-editoriale-d4.md)) — aucune fixture ne remplace la lecture humaine. Première passe de vérification des sources indicatives : [docs/sources-editoriales-d2.md](docs/sources-editoriales-d2.md), aucune source activée.

Non livré : activation publique (décision du porteur après recette D4), demandes publiques de développement (D8 proposé), essai réel (protocole distinct).

### Lot d'accélération B (13 novembre 2026) : salons et droits

- **Salons** (F10, F11) : création autonome (`/salons/nouveau`) ou depuis une publication (thème prérempli, association visible des deux côtés) ; public ou sur invitation, fixé à la création ; format chat ou chat + vocal (le vocal arrive plus tard) ; archivage (lecture seule).
- **Droits centralisés** (`lib/rooms/permissions.ts`) : découvrir, lire, rejoindre, écrire, modérer, gérer — contrôlés côté serveur à chaque requête ; matrice visiteur/non-membre/membre/modérateur/propriétaire/suspendu/banni testée. Aucune fuite d'un salon privé (annuaire, page, API : 404 pour les non-membres).
- **Invitations** : lien à usage unique, expirant (7 jours), révocable, stocké haché ; connexion puis acceptation EXPLICITE ; consommation atomique (deux acceptations = un seul usage) ; aucune invitation ne contourne un bannissement.
- **Sanctions de salon (D5)** : exclusion (retour public après 24 h) et bannissement (7 j, 30 j, sans limite ; levée possible) ; hiérarchie respectée (un modérateur ne sanctionne pas un modérateur).
- **Transfert de propriété** : proposition, effet à l'acceptation, expiration 7 jours ; la personne propriétaire ne quitte pas sans transfert ou archivage, et la **suppression de compte est bloquée** tant qu'un salon actif est possédé.
- **Limites D6** : 5 créations de salon par jour et par membre, 20 invitations par jour et par salon (configurables `LIMIT_ROOMS_PER_DAY`, `LIMIT_ROOM_INVITES_PER_DAY`).
- Le chat temps réel est livré par le lot C (ci-dessous).

### Lot d'accélération C (13 novembre 2026) : chat réel des salons

- **Architecture (C009)** : PostgreSQL source de vérité ; écriture par API, réception par **flux SSE reprenable** (`GET /api/rooms/{id}/stream?cursor=`) ; chaque écriture produit son événement dans la **même transaction** (table `room_events`, curseur `seq` monotone) — une coupure ou un redémarrage ne perd rien.
- **Envoi** : persistant, accusé, **relance sans doublon** (identifiant client unique par auteur et salon) ; 2 000 caractères et 20 messages/minute/salon, limite atomique (`LIMIT_ROOM_MESSAGES_PER_MINUTE`).
- **Historique** : paginé, ordre stable, lisible par les membres (y compris messages antérieurs à l'arrivée) ; modification/suppression par l'auteur ; **retrait de modération avec motif enregistré** (le texte retiré n'est plus servi).
- **Droits pendant le flux** : contrôlés à l'ouverture, revalidés périodiquement (≤ 5 minutes, D5) et **immédiatement** à l'événement `revoke` émis dans la transaction d'une sanction : le flux du membre sanctionné est fermé côté serveur.
- **Client** : états envoi / échec (relance sans doublon) / reconnexion, marqueur de non-lus, repère de lecture **monotone**. Aucune présence ni activité inventée.
- **Hébergement** : le flux se referme de lui-même après ~110 s et le client reprend par curseur — compatible avec les plateformes qui limitent la durée des réponses. Si l'hébergement cible ne permet aucune connexion durable, un adaptateur (long-polling sur la même table d'événements) sera proposé avant activation ; le polling seul ne vaudra pas validation du temps réel.
- Latence mesurée en recette locale (serveur dev, intervalle de lecture 1,5 s) : ~2,1 s de l'envoi à la réception par l'autre client.

### Lot d'accélération D (13 novembre 2026) : recherche, notifications, blocage, modération

- **Recherche** (`/recherche`) : publications, membres, thèmes et salons PUBLICS, par type avec pagination et état vide ; PostgreSQL seul ; un salon privé n'apparaît jamais ; les auteurs bloqués par le lecteur sont exclus.
- **Notifications** (`/notifications`) : réponse à sa publication ou son commentaire, nouveau message d'un salon SUIVI (regroupé par salon avec compteur), décisions de modération motivées. Jamais d'auto-notification ; un membre bloqué ne notifie plus ; la perte d'accès à un salon supprime ses notifications et l'URL directe ne donne de toute façon aucun accès.
- **Blocage** : masque publications et commentaires publics du bloqué pour le bloqueur seul, coupe ses notifications, rend ses invitations inacceptables ; la limite (messages encore visibles dans un salon déjà partagé) est annoncée au moment du blocage.
- **Signalements** : motifs fermés + précision (≤ 1 000), limite 20/jour (`LIMIT_REPORTS_PER_DAY`), file réservée à la modération, identité du signalant jamais exposée hors modération.
- **Modération humaine (D5)** : retrait de contenu, avertissement, suspension datée (expire d'elle-même), bannissement de plateforme distinct (sessions fermées, connexion refusée), levée. Chaque action : journal, notification motivée, révocation immédiate des flux temps réel. Contexte privé d'un signalement de message : borné (±10 messages, ±30 min), chaque consultation journalisée. Contestation : une par sanction, 14 jours, examinée si possible par une autre personne, réponse motivée (`/sanctions`).
- **Outillage de recette** : le hook de changement de statut est RETIRÉ ; la recette passe par l'API de modération réelle. Seul reste le hook de données de démonstration (`VALYO_TEST_HOOKS=1` hors production).

### Lot d'accélération E (13 novembre 2026) : qualité, exploitation, préparation du vocal

- **Recette de concurrence PostgreSQL** : `DATABASE_URL_TEST=… npm run recette:concurrence` (base dédiée vierge exigée) — budget, tâches, invitations, limites et messages en vraies connexions parallèles. Exécution encore manquante : aucune instance disponible sur le poste.
- **Plan de charge** : `BASE_URL=… CHARGE_CLIENTS=100 npm run charge` — inscriptions, salon commun, un flux SSE par client, latences p50/p95. Outil validé à 12 clients en local ; la capacité n'est vérifiée qu'avec une exécution documentée sur l'environnement cible.
- **Exploitation** : [docs/exploitation.md](docs/exploitation.md) (sauvegarde/restauration — scénario PGlite exercé —, migrations, worker, journalisation, coûts, configuration).
- **Recette navigateur/clavier** : grille dans [docs/recette-navigateur.md](docs/recette-navigateur.md), à exécuter.
- **Indicateurs salons/chat** : agrégats 7 jours dans `/admin/indicateurs`, lecture et contribution séparées, aucun contenu lu.
- **Vocal F13** : contrat d'intégration et comparaison des fournisseurs dans [docs/contrat-vocal-f13.md](docs/contrat-vocal-f13.md) (recommandation : LiveKit ; aucun abonnement souscrit).

### Premiers pas des nouveaux membres (14 novembre 2026)

- Après l'inscription (sans destination précise), `/bienvenue/premiers-pas` propose trois façons d'échanger dès le premier jour : questions récentes qui attendent une réponse, salons publics actifs, membres actifs à suivre — thèmes choisis en tête, données réelles uniquement, état vide honnête si la communauté démarre.
- Progression « x sur 3 » (rejoindre un salon, répondre ou publier, suivre un membre) ; rappel sur l'accueil pendant la première semaine tant que tout n'est pas fait.
- Sert l'indicateur « reliés et revenus » (decisions §5). Recette navigateur réelle 17/17 (`tests/acceptance/navigateur-premiers-pas.mjs`).

### Étapes suivantes

2. Agent éditorial : essai réel minimal (protocole C008), recette humaine D4, puis activation 2C sur décision du porteur.
3. Vocal réel (après avis Codex sur le contrat F13 et accord du porteur).
4. Exécutions restantes : recette concurrence PostgreSQL (E37), recette navigateur (E38), plan de charge sur l'environnement cible (E41).
