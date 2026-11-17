# Valyo — Audit de performance — 17 novembre 2026

Auteur : Claude, troisième audit du jour (après parcours UX et accessibilité). Méthode :
copie locale en **mode production** (`next build` + `next start`, PGlite) instrumentée pour
compter chaque requête SQL par page, données représentatives (12 publications, réactions,
relais, salon de 15 messages) ; appels en série, médiane de 3 mesures. Puis mesures sur
**www.valyo.si** (TTFB médian de 3 appels depuis la Belgique, compression, en-têtes).
Résultats bruts : `scratchpad/perf-local.json`.

## Mesures locales (plancher sans latence réseau)

| Page | Rendu serveur | Requêtes SQL | HTML brut |
| --- | --- | --- | --- |
| Fil visiteur (récentes) | 40 ms | 9 | 225 Ko |
| Fil membre (pour vous) | 50 ms | 21 | 249 Ko |
| Article (visiteur / membre) | 19 / 24 ms | 8 / 16 | 49 / 58 Ko |
| Profil (visiteur / membre) | 61 / 68 ms | 17 / 28 | 361 / 367 Ko |
| Salon (visiteur / membre) | 18 / 28 ms | 7 / 25 | 72 / 69 Ko |
| Annuaire, notifications, messages, recherche, premiers pas | 12–19 ms | 4–11 | 33–66 Ko |

Aucune requête au-dessus de 15 ms ; les plus coûteuses (8–14 ms) sont les agrégations du
profil (domaines, meilleures contributions, calendrier d'activité).

## Mesures en production (www.valyo.si)

- **TTFB médian : ~100 ms** pour les salons, le récap, la connexion, la recherche et un
  article — excellent. **Le fil : 339 ms**, seule page nettement plus lente.
- **Compression gzip active** : le fil passe de 302 Ko à 60 Ko transférés. Brotli absent
  (−20 % possibles, dépend du proxy Railway).
- **En-têtes corrects** : HTML personnalisé en `no-store` ; JS/CSS/polices en
  `immutable, max-age=1 an`. JS initial 103–115 Ko par page : léger pour un réseau social.
- Bien en place dans le code : requêtes parallélisées (`Promise.all`), chargements groupés
  par lots d'identifiants (pas de N+1 par carte), pagination partout.

## Constats

### P1 — le fil, page d'entrée, est 3× plus lent et 5× plus lourd que le reste

339 ms de TTFB et 302 Ko de HTML brut (60 Ko compressés) là où les autres pages tiennent en
~100 ms et 35–70 Ko. Trois contributions identifiées :
1. le HTML embarque chaque donnée deux fois (rendu + données React sérialisées), mécanique
   Next incompressible, mais amplifiée par tout ce qui est long dans les cartes ;
2. ~7 icônes SVG inline répétées sur CHAQUE carte (≈ 2 Ko × 20 cartes ≈ 40 Ko évitables avec
   un sprite `<symbol>/<use>` unique) ;
3. en production le fil porte plus de publications et donc des sous-requêtes par lot plus
   larges qu'en local (syntheses, salons liés, relais, réactions).
*Reco : sprite SVG commun aux cartes ; en-tête `Server-Timing` temporaire sur le fil pour
ventiler les 339 ms (SQL vs rendu) avant toute autre optimisation.*

### P2 — index manquants pour les parcours « par membre » (prévention)

Les agrégations du profil, de la progression et du fil social parcourent des tables par
auteur sans index dédié : `comments(author_id)`, `post_reactions(user_id)`,
`room_messages(author_id)` (série hebdomadaire), et la direction `followee` de
`member_follows` (listes d'abonnés). Invisible aujourd'hui (tables petites), coût croissant
avec l'usage. *Reco : une migration de 4 index, maintenant que c'est indolore.*

### P3 — divers

- Profil : 367 Ko de HTML (calendrier de 126 cases + tableau périodique + cartes) ; marginal
  une fois compressé, à revoir seulement si le TTFB du profil se dégrade.
- Brotli au proxy : à activer si Railway l'expose un jour ; gzip suffit pour l'instant.

## Limites

Plancher local sur PGlite (latence par requête quasi nulle) : en production, chaque requête
paie l'aller-retour vers Postgres, c'est le TTFB mesuré qui fait foi. Pas de test de charge
multi-utilisateurs, pas de mesure du rendu navigateur (LCP/CLS) ni du mobile sur réseau
cellulaire ; pas de profiling mémoire. Le fil membre « pour vous » n'a pas été mesuré en
production (session requise).

## Statut

**Lot corrigé et déployé le 17 novembre (soir).**
- Migration 029 : les 4 index « par membre » sont posés (commentaires et réactions par
  auteur, messages de salon par auteur, abonnés).
- Sprite SVG : les icônes des cartes ne sont plus émises qu'une fois par page. À
  isopérimètre local : fil −32 % de HTML brut (225 → 154 Ko), profil −45 % (361 → 197 Ko).
  La comparaison production brute n'est pas concluante (le contenu du fil a changé entre
  les deux mesures).
- Ventilation du fil en production (`VALYO_TIMING=1`, journaux Railway) : **les données ne
  coûtent que 4-6 ms** (deux vagues parallèles, Postgres même région). Re-mesure du TTFB à
  chaud : **~0,10 s, aligné sur toutes les autres pages**. Les 339 ms initiaux relevaient
  du premier rendu après déploiement, pas d'un coût structurel : le constat P1 est clos
  sans autre optimisation nécessaire. La variable de ventilation reste active (une ligne de
  journal par rendu du fil), à retirer quand on voudra.
- Au passage, deux fragilités de la suite e2e corrigées (extraction des identifiants de
  thème ancrée sur la forme des objets, texte d'état vide de la recherche mis à jour) :
  32/32, et 187/187 tests unitaires.
