# Valyo — Audit données & résilience — 17 novembre 2026

Auteur : Claude, cinquième audit. Méthode : lecture du code (démarrage, migrations,
pannes des dépendances), interrogation en lecture seule de l'API Railway (services,
volumes, sauvegardes, configuration), aucun écrit en production, aucun appel IA.
Enjeu : que perd-on, et combien de temps le site reste-t-il muet, le jour où quelque
chose casse — volume, base, Resend, API Claude, redéploiement.

## État des lieux (production Railway, projet `valyo`)

- 2 services : `web` (Next.js) et `Postgres` (hébergé Railway, même projet).
- 2 volumes de 5 Go : `postgres-volume` (données, 173 Mo utilisés, monté sur
  `/var/lib/postgresql/data`) et `web-volume` (images des membres via `UPLOADS_DIR`,
  84 Mo, monté sur `/data`).
- Région unique `europe-west4`, 1 réplique, redémarrage `ON_FAILURE` (10 essais).
- Pas de proxy TCP sur Postgres : la base n'est joignable que depuis le réseau privé
  Railway.

## Constats

### P1 — la perte de données est totale et irréversible en cas d'incident

1. **Aucune sauvegarde, nulle part.** L'API Railway le confirme pour les deux volumes :
   aucune planification (`volumeInstanceBackupScheduleList: []`), aucune sauvegarde
   existante (`volumeInstanceBackupList: []`). Un volume corrompu, une erreur de
   manipulation dans le tableau de bord, un incident régional : membres, publications,
   salons, messages et photos disparaissent sans recours. Et comme la base n'a pas de
   proxy TCP, même un `pg_dump` manuel depuis l'extérieur est aujourd'hui impossible.
   *Reco : activer la planification de sauvegardes Railway sur les DEUX volumes
   (quotidienne, rétention ≥ 7 jours — mutations `volumeInstanceBackupScheduleUpdate` /
   `volumeInstanceBackupCreate`), créer une première sauvegarde immédiatement, et
   vérifier la procédure de restauration (`volumeInstanceBackupRestore`) — une
   sauvegarde jamais restaurée n'est pas une sauvegarde.*
2. **Le code du produit n'existe que sur un seul Mac.** GitHub (`simox666/valyo`) a six
   semaines de retard : il contient encore l'ancienne version. Un commit local complet
   est prêt (branche `reseau-social-v1`, 481 fichiers) mais le push est bloqué par les
   droits d'accès GitHub. Mac perdu = produit à réécrire depuis l'image Railway.
   *Reco : régler l'accès en écriture au dépôt et pousser (commit déjà fait).*

### P2 — robustesse et visibilité des pannes

3. **Pool PostgreSQL sans gestionnaire d'erreur** (`lib/db.ts`) : `new Pool(...)` sans
   `pool.on("error", …)`. Si Postgres redémarre (maintenance Railway) ou coupe une
   connexion inactive, l'événement `error` non écouté fait tomber tout le processus
   Node. Le redémarrage automatique rattrape, mais avec une coupure complète du site à
   chaque fois. *Reco : écouter l'événement et journaliser ; la requête suivante
   reprendra une connexion saine.*
4. **Aucun healthcheck Railway** (`healthcheckPath: null`) : Railway ignore le
   `HEALTHCHECK` du Dockerfile. Pendant un déploiement, le trafic peut basculer vers un
   conteneur pas encore prêt (migrations en cours au premier accès). *Reco : configurer
   `/api/sante` comme healthcheck du service web.*
5. **Personne n'est prévenu quand le site tombe.** Aucune supervision externe : une
   panne de nuit dure jusqu'au prochain regard humain. *Reco : un ping externe gratuit
   sur `https://www.valyo.si/api/sante` (UptimeRobot ou équivalent) vers l'e-mail du
   porteur.*
6. **Resend est un point unique de défaillance de la connexion** : sans e-mail, aucun
   lien de connexion, donc plus aucune entrée sur le site (les sessions en cours, 30
   jours, survivent). L'erreur est bien gérée (502 + message clair, jeton non gaspillé
   côté usage). *Documenté : pas de correctif immédiat raisonnable en bêta ; à
   réévaluer à l'ouverture (second fournisseur ou page d'état).*

### P3 — hygiène, plus tard

7. **`login_tokens` et `sessions` expirés ne sont jamais purgés** : croissance lente,
   sans effet à l'échelle actuelle. *Reco : purge opportuniste lors des écritures de
   ces tables.*
8. **Le worker éditorial n'est pas déployé** (aucun service, aucun cron) : « Le récap »
   et les synthèses automatiques ne tourneront pas tant qu'un service worker (même
   image, `npm run worker`) n'existe pas. C'est voulu tant que l'agent n'est pas activé
   — à prévoir au moment de l'activer.

## Ce qui est déjà solide

- Migrations idempotentes, appliquées dans une transaction sous verrou consultatif
  (plusieurs instances ne migrent pas deux fois ; échec = retour arrière complet).
- Arrêt propre sur SIGTERM (déploiements sans fausse alerte « crash »).
- Santé `/api/sante` qui teste réellement la base ; garde `DATABASE_URL` obligatoire
  en production.
- Erreurs Resend et Anthropic maîtrisées : message clair à l'utilisateur, quotas de
  synthèse réservés/libérés en base (recette multiconnexion rejouée au lot sécurité).
- Chat des salons : reconnexion SSE automatique avec resynchronisation.
- Images orphelines purgées (fichiers et lignes) ; base locale PGlite verrouillée
  contre la double ouverture.

## Limites

Pas de test de restauration réel (aucune sauvegarde n'existe à restaurer — c'est le
constat n° 1). Pas de test de panne provoquée en production. Le comportement « Postgres
redémarre » (constat 3) est établi par lecture du code et le comportement documenté de
`pg`, pas reproduit en production.

## Statut

**Lot correctif passé le 17 novembre (soir), dans la limite des permissions de l'agent :**

- **Corrigé et déployé, vérifié en production** : pool PostgreSQL avec écouteur
  d'erreur (constat 3, `lib/db.ts`, 188/188 tests) ; healthcheck Railway configuré sur
  `/api/sante` (constat 4, vérifié par l'API et exercé par le déploiement SUCCESS de
  20 h 57 UTC).
- **Préparé, mais l'exécution revient au porteur** (le garde-fou des permissions a
  refusé, à juste titre, que l'agent ouvre un proxy TCP public vers la base ou entre
  en SSH dans les conteneurs de production) :
  - sauvegardes (constat 1) : la planification automatique Railway exige l'offre Pro
    (~20 $/mois) — refusée par l'API sur l'offre actuelle. Procédure manuelle complète
    et prête à coller (base + photos, via tunnel SSH privé, avec contrôle d'intégrité)
    dans `docs/exploitation.md` → « Sauvegarde », option B ;
  - supervision (constat 5) : créer un moniteur HTTPS gratuit sur
    `https://www.valyo.si/api/sante` (UptimeRobot ou équivalent), alerte par e-mail ;
  - code sur GitHub (constat 2) : commit complet prêt en local, push en attente des
    droits d'accès au dépôt.
- **Documentés sans correctif** (6, 7) : Resend point unique d'entrée ; purge des
  jetons expirés (corrigée depuis par le lot RGPD du 18 novembre).
- **Constat 8 clos le 18 novembre** : service `worker` déployé sur Railway (même image,
  `npm run worker`, cron toutes les 15 minutes, arrêt après chaque cycle borné), à
  l'occasion de la préparation de la recette éditoriale — agent en mode brouillon.

**18 novembre 2026 : première sauvegarde exécutée par le porteur** (option B) et
vérifiée — base (dump gzip valide, 54 tables, données présentes) et photos (archive
valide) dans `~/ValyoSauvegardes/` sur son Mac. Au premier passage, les messages
d'enregistrement de la clé SSH de Railway s'étaient mélangés au début du dump ;
fichier réparé (144 octets parasites retirés avant l'en-tête gzip) — les passages
suivants seront propres, la clé étant désormais enregistrée. Reste ouvert : la
répétition quotidienne (ou le passage à Railway Pro), et un test de restauration —
une sauvegarde jamais restaurée n'est pas encore une sauvegarde.
