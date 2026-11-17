# Mise en ligne de la bêta (30 à 50 invités)

Mis à jour le 14 novembre 2026 : la bêta est déployée sur le service Railway `web`,
environnement `production`, après autorisation du porteur (C018).
[Ouvrir Valyo](https://web-production-4a0626d3.up.railway.app).
Les étapes de domaine, fournisseur e-mail et préparation des invitations ci-dessous
restent à confirmer selon leur état ; ce déploiement ne les valide pas implicitement.

## Déploiement actuel — C018

- Projet Railway : `valyo` (`ccb2b80a-770e-475c-ab2d-28fc13169844`).
- Service : `web` (`2915f5f6-86bb-451e-b1fe-0d7c5e24eb28`), environnement `production`.
- [Déploiement réussi](https://railway.com/project/ccb2b80a-770e-475c-ab2d-28fc13169844/service/2915f5f6-86bb-451e-b1fe-0d7c5e24eb28?id=6e651547-b830-43af-8bad-e277237307c9)
  : `6e651547-b830-43af-8bad-e277237307c9`, lancé le 14 novembre à 20:51 UTC.
- Envoi direct par le CLI Railway de la copie de sources
  `/private/tmp/valyo-railway-source-ac6h1vm4` : 194 fichiers, aucune `.env`, base locale,
  dépendance installée ou secret embarqué. Sources applicatives identiques au build C017 validé.
- Build Docker Node 22 réussi sur Railway, statut `SUCCESS`. Aucun commit/push Git
  effectué : ce déploiement est un envoi local, pas une synchronisation du dépôt GitHub.
- Vérifications publiques : accueil HTTP 200 ; `/api/sante` HTTP 200 avec `{"ok":true}`
  (PostgreSQL accessible et migrations exécutées par l’application) ; police locale HTTP 200,
  empreinte identique au fichier du dépôt, CSS sans URL Google Fonts.
- Aucun e-mail de test envoyé, aucune variable Railway changée, aucun domaine ajouté,
  aucun worker éditorial activé. L’envoi fournisseur et les parcours connectés en production
  ne sont pas éprouvés par ces contrôles de disponibilité.

## Ce qui est prêt dans le code

- **Inscriptions sur invitation** : en production, un nouveau compte n'est créé qu'avec un
  lien d'invitation valide (`/rejoindre/…`), sauf pour les adresses de `ADMIN_EMAILS`.
  Chaque membre a 5 invitations (`LIMIT_MEMBER_INVITES`), l'administration est illimitée.
  Page « Inviter des proches » dans le menu Compte.
- **Avis des testeurs** : lien « Votre avis (bêta) » en pied de page et dans le menu Compte ;
  lecture dans « Avis des testeurs » (administration).
- **Image Docker** (`Dockerfile`) et **point de santé** `GET /api/sante`.
- **Police Manrope embarquée** dans `app/fonts/`, licence incluse : `next/font/local`
  ne télécharge pas de police pendant la compilation.
- Migrations automatiques au démarrage et à chaud ; PGlite refusé en production
  (`DATABASE_URL` obligatoire) ; `APP_URL` obligatoire pour les écritures.

## Effacer l'ancien projet « Combien ça vaut ? » et réutiliser ce qui sert (décision du 14 novembre 2026)

Inventaire de l'ancienne application (configuration conservée dans l'étiquette Git
`valyo-estimation-final`) : hébergement Vercel, base Vercel Postgres (`POSTGRES_URL`),
stockage de photos Vercel Blob, Resend, clé Anthropic, `AUTH_SECRET`.

| Élément | Décision |
|---|---|
| Domaine `valyo.si` (OVH) | **Réutilisé** pour la nouvelle application |
| Messagerie @valyo.si (OVH) | **Aucune boîte utilisée** (porteur) : MX et SPF OVH **supprimés** |
| Dépôt GitHub `simox666/valyo` | **Réutilisé** ; l'ancien code reste dans l'étiquette `valyo-estimation-final`, la branche `main` recevra la nouvelle application |
| Compte Resend | **Réutilisé** ; le domaine valyo.si n'y a jamais été validé (aucun enregistrement Resend dans le DNS) : à ajouter |
| Clé API Anthropic | **Remplacée** : créer une clé neuve pour la production, puis révoquer l'ancienne |
| Projet Vercel | **Supprimé** une fois la nouvelle application en ligne |
| Base Vercel Postgres (comptes et estimations des anciens utilisateurs) | **Supprimée** (données personnelles sans usage) ; export préalable seulement si l'on veut informer les anciens utilisateurs, avec prudence sur le consentement |
| Stockage Vercel Blob (photos envoyées) | **Supprimé** |
| `AUTH_SECRET`, `@vercel/*`, `next-intl` | Inutiles pour la nouvelle application |

**Conséquence sur le domaine.** Sans Vercel, plus rien n'assure la redirection de
`valyo.si` (sans www), et OVH ne permet pas de faire pointer la racine vers Railway.
**Décision du porteur (14 novembre 2026) : DNS conservés chez OVH, adresse `https://www.valyo.si`.**
La procédure Cloudflare ci-dessous reste une option, non retenue.
1. Créer un compte Cloudflare, « Ajouter un site » `valyo.si`, plan gratuit : Cloudflare
   importe les enregistrements existants. **Vérifier que les 3 MX OVH et le TXT SPF
   `v=spf1 include:mx.ovh.com -all` sont bien présents** (messagerie).
2. Chez OVH, remplacer les serveurs DNS (`dns200.anycast.me`, `ns200.anycast.me`) par les
   deux serveurs Cloudflare indiqués.
3. Dans Cloudflare : CNAME `@` et TXT de vérification fournis par Railway, CNAME `www`
   vers `@`, SSL/TLS en mode **Full** (pas « Full (Strict) »), redirection 301 de `www`
   vers `valyo.si` (ou l'inverse) ; puis les enregistrements Resend.
4. (option non retenue)

**Ordre conseillé** : (1) Railway + base + variables, déploiement sur l'adresse
`…up.railway.app` et répétition générale ; (2) chez OVH : CNAME `www` et TXT Railway ;
(3) vérification de `https://www.valyo.si/api/sante` et d'un envoi d'e-mail ; (4) seulement
alors, suppression du projet Vercel, de sa base et de son stockage, et révocation de
l'ancienne clé Anthropic.

## Hébergement recommandé

Le chat temps réel utilise des connexions longues (SSE, refermées et reprises toutes les
~110 s) : il faut un **conteneur qui tourne en continu**, pas des fonctions « serverless »
à durée courte.

**Recommandation : Railway** (une seule interface pour l'application, la base PostgreSQL et
la tâche planifiée du worker). Tarif consulté le 14 novembre 2026 sur railway.com/pricing :
plan Hobby **5 $/mois incluant 5 $ d'usage** ; au-delà, environ 10 $ par Go de mémoire et
20 $ par vCPU et par mois, à la seconde. Pour 50 invités, l'ordre de grandeur attendu reste
proche du forfait ; à confirmer à l'usage. **À vérifier à l'inscription** (non précisé sur la
page tarifs) : région européenne disponible et prix de la base PostgreSQL gérée.

Alternatives équivalentes si besoin : Render ou Fly.io (même image Docker).

## Étapes

1. **Nom de domaine : `valyo.si`** (au porteur ; DNS chez **OVH**, constaté le 14 novembre 2026).
   État actuel : l'ancienne application « Combien ça vaut ? » tourne chez **Vercel** sur
   `www.valyo.si` (CNAME `www` → Vercel) ; `valyo.si` (A → Vercel) redirige vers `www`.
   Enregistrements de messagerie OVH (MX `mx1/2/3.mail.ovh.net`, SPF OVH) : inutilisés, **à supprimer** (décision du porteur).
   Code de l'ancienne application conservé (étiquette Git `valyo-estimation-final`).

   ~~Choix initial : `https://www.valyo.si`~~ — **remplacé** par la décision « tout effacer » ci-dessus (DNS chez Cloudflare, `https://valyo.si`). Raison :
   OVH ne figure pas parmi les DNS compatibles « CNAME à la racine » de Railway, alors qu'un
   CNAME sur `www` fonctionne partout. Aucun déménagement de DNS, messagerie intacte.
   - **OVH, zone DNS de valyo.si** : remplacer la cible du CNAME `www` (aujourd'hui
     `…vercel-dns-017.com`) par la valeur que Railway affiche, et ajouter le TXT de
     vérification Railway (sans lui : erreur 404).
   - **Racine `valyo.si`** : la laisser pointer vers Vercel, et dans Vercel garder SEULEMENT
     le domaine `valyo.si` configuré en « redirection vers www.valyo.si » (retirer
     `www.valyo.si` de l'ancien projet). Vercel continue d'assurer la redirection HTTPS.
   - ⚠️ **Vercel est relié au dépôt GitHub** : avant de pousser le nouveau code sur la
     branche `main`, déconnecter l'ancien projet Vercel de Git (ou le supprimer en gardant
     la redirection), sinon Vercel tentera de déployer la nouvelle application.
   - Propagation DNS jusqu'à 72 h ; certificat HTTPS Railway automatique, en général dans l'heure.
   - Alternative si l'on veut un jour l'adresse sans « www » : confier les DNS à Cloudflare
     (gratuit) et y recréer à l'identique les enregistrements de messagerie OVH.
2. **(porteur)** Compte Railway, nouveau projet depuis ce dépôt (le `Dockerfile` est détecté),
   service PostgreSQL ajouté dans le même projet, région européenne si proposée.
3. **(porteur)** Compte Resend (envoi des liens de connexion) : ajouter le domaine
   `valyo.si`, copier dans la zone OVH les enregistrements que Resend affiche (ils portent
   sur un sous-domaine d'envoi et une clé DKIM : ils ne touchent pas aux MX OVH de la
   messagerie), attendre « Verified », créer une clé API.
4. Variables du service web :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | fournie par le service PostgreSQL |
   | `APP_URL` | `https://www.valyo.si` |
   | `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` | clé Resend ; `Valyo <bonjour@valyo.si>` |
   | `ADMIN_EMAILS` | `simoben10@gmail.com` |
   | `INSCRIPTIONS` | `invitation` (valeur par défaut en production) |
   | `ANTHROPIC_API_KEY` | seulement quand l'agent sera activé |

   Ne JAMAIS définir `VALYO_TEST_HOOKS` en production.
5. Déployer, ouvrir `https://www.valyo.si/api/sante` → `{"ok":true}`.
6. Te connecter avec ton adresse (admis sans invitation), terminer l'inscription, puis
   « Inviter des proches » pour créer les premiers liens.
7. **Plus tard (agent)** : tâche planifiée Railway `npm run worker` toutes les 10 minutes,
   après l'essai réel et la recette D4 (`docs/recette-editoriale-d4.md`).

## Répétition générale déjà faite (14 novembre 2026)

### Correctif du build Railway — C017

Le porteur a signalé un échec de `next build` dans `next/font/google` depuis
`app/layout.tsx` : `Cannot read properties of null (reading '1')`. La cause précise de
la réponse Google Fonts n’est pas confirmée. Le chargement distant de Manrope a été
remplacé par `next/font/local`, avec la police variable officielle et sa licence dans
`app/fonts/` ; l’identité typographique est conservée. Le Dockerfile existant inclut
ces fichiers par `COPY . .`, aucune variable ni dépendance supplémentaire.

Build de production réussi dans une copie propre sans `.env`/secrets ni base :
compilation, contrôle des types, génération 46/46 et traces terminés. Le fichier de
police est présent dans les médias compilés, identique à la source, et le CSS ne
référence pas Google Fonts. Vérification locale sous Node 26.13.0 / Next 15.5.25 ;
l’image Docker Node 22 et Railway n’ont pas été reconstruits depuis cet outil.

**Pour reprendre le déploiement :** inclure `app/layout.tsx` ET les fichiers
`app/fonts/` dans la source envoyée à Railway, puis lancer un nouveau build de cette
version. Relancer seulement l’ancienne version conserve la dépendance défaillante.
Ce correctif ne valide pas la configuration PostgreSQL/Resend du service déployé.

**Suite C018 :** cette reconstruction a été effectuée avec succès sur Railway ; voir
le déploiement actuel ci-dessus. PostgreSQL répond au point de santé ; Resend reste
hors de la vérification de déploiement.

### Répétition CL019

Build de production + `next start` en `NODE_ENV=production`, contre une base parlant le
protocole PostgreSQL (PGlite socket) avec le VRAI pilote `pg` : les 16 migrations
s'appliquent, point de santé OK, pages publiques OK, bêta fermée (inconnu refusé en 403),
envoi du lien refusé proprement sans clé Resend (502, cause claire au journal).
Parcours connectés **11/11** (`tests/acceptance/repetition-production.cjs`) : publication,
commentaire + notification, réaction, salon, adhésion, chat reçu en direct en ~0,7 s,
invitation, page d'invitation, avis, pages connectées.

Limite : cette base traite une connexion à la fois ; la recette de concurrence de Codex
s'y bloque, comme attendu. Elle reste à exécuter sur le vrai PostgreSQL de l'hébergeur.

## Avant d'envoyer les premières invitations

- Rejouer `tests/acceptance/repetition-production.cjs` sur une base de TEST de l'hébergeur.
- Exécuter, sur la base de test de l'hébergeur, `npm run recette:concurrence` et
  `npm run charge` (voir `docs/exploitation.md`) : c'est la première occasion de les faire
  tourner sur un vrai PostgreSQL.
- Sauvegarde quotidienne de la base activée (`pg_dump`, `docs/exploitation.md`).
- Relire `/regles` et `/confidentialite` (données personnelles : adresse e-mail, contenus).
