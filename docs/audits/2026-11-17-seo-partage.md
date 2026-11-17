# Valyo — Audit SEO et partage de liens — 17 novembre 2026

Auteur : Claude, quatrième audit du jour. Méthode : contrôles en lecture seule sur
www.valyo.si (balises des pages clés, robots, sitemap, redirections, données structurées),
recoupés avec le code des métadonnées. Enjeu : ce que voient les moteurs de recherche, et
l'allure d'un lien Valyo collé dans WhatsApp, LinkedIn, X ou un salon.

## Ce qui est déjà bon

- Redirections propres : http → https, valyo.si → www.valyo.si (301/308).
- Accueil : titre, description, Open Graph et carte Twitter corrects, `fr_BE`.
- Articles : `<title>` et `meta description` par publication (via `generateMetadata`).
- Pages privées : 404 pour les anonymes (salons privés) ou renvoi vers la connexion ;
  notifications et administration déjà en `noindex`.
- `metadataBase` configuré : les URL absolues des aperçus seront justes.

## Constats

### P1 — un lien d'article partagé montre… la carte générique du site

1. **Open Graph et Twitter ne sont PAS déclinés par publication** : `generateMetadata` des
   articles ne renseigne que `title`/`description`, donc `og:title`, `og:description`,
   `og:type` et la carte Twitter retombent sur les valeurs du site. Un article partagé
   affiche « Valyo — les nouvelles… » au lieu de son titre, sans image, dans toutes les
   messageries et réseaux. C'est LE levier de croissance d'un site de contenu.
   *Reco : openGraph/twitter par publication (titre, description, `og:type: article`,
   `og:image` = image de l'article quand elle existe, sinon une image de marque 1200 × 630 ;
   `summary_large_image` quand il y a une image).*
2. **`robots.txt` : 404** (la page d'erreur HTML est servie). Aucun périmètre déclaré aux
   robots. *Reco : fichier réel — tout autorisé sauf /api, /admin, /parametres, /messages,
   /notifications, /a-creuser, /connexion, /bienvenue, /rejoindre, /inviter + lien sitemap.*
3. **`sitemap.xml` : 404.** Les moteurs découvrent le site lien par lien. *Reco : sitemap
   dynamique — accueil, salons, récap, règles, confidentialité, pages de thème,
   publications publiées, profils publics, salons publics.*

### P2 — pages partagées sans identité, périmètre d'indexation flou

4. **Les salons partagent tous le même titre « Salon · Valyo »** (métadonnée statique),
   alors que la page publique est lisible et se partage. *Reco : `generateMetadata` — nom du
   salon, description, thème.*
5. **Aucune URL canonique** sur le site : le fil existe sous `/?vue=…&theme=…`, les
   duplicatas se multiplient. *Reco : `alternates.canonical` sur l'accueil, les articles,
   profils, thèmes et salons.*
6. **Pas d'image de partage par défaut** ni d'`apple-touch-icon` (seulement l'icône SVG) :
   un lien sans image et une épingle iOS générique. *Reco : une carte de marque 1200 × 630
   et une icône PNG 180 × 180.*
7. **`noindex` incomplet** : paramètres, messages, à-creuser, publier, recherche n'affichent
   pas de directive (ils redirigent les anonymes, mais autant fermer proprement).

### P3 — plus tard

8. Pas de données structurées (JSON-LD `DiscussionForumPosting`/`NewsArticle` sur les
   publications, `BreadcrumbList`) : utile pour les résultats enrichis, non bloquant.
9. Les descriptions des actus importées reprennent le début brut de l'article (« Written
   by… ») : la synthèse IA, quand elle existe, ferait une meilleure description.

## Limites

Pas de soumission à la Search Console ni de mesure de positionnement (le site est en bêta
sur invitation : l'enjeu immédiat est l'aperçu des liens partagés, l'indexation compte pour
l'ouverture). Validateurs externes (Facebook/LinkedIn debuggers) non appelés ; les balises
produites suivent leurs spécifications publiées.

## Statut

**Lot P1 + P2 corrigé et déployé le 17 novembre (soir), vérifié sur www.valyo.si :**
- un lien d'article partagé montre désormais SON titre, SA description et SON image
  (`og:type article`, carte Twitter large) — vérifié sur un article réel, image NASA reprise ;
- carte de partage de marque 1200 × 630 (`/partage.png`) en repli et par défaut du site,
  icône iOS `apple-icon.png` — toutes deux servies en 200 ;
- `robots.txt` réel (contenu public autorisé, espaces de compte exclus) avec lien sitemap
  en `https://www.valyo.si` (le premier déploiement figait l'URL locale au build : repli
  corrigé) ;
- `sitemap.xml` dynamique : 73 adresses (pages stables, thèmes, publications, profils,
  salons publics) ;
- canoniques posées (accueil quel que soit `?vue/?theme`, articles, profils, thèmes,
  salons) ; les salons publics ont titre et description propres ; `noindex` ajouté sur
  paramètres, messages, à-creuser, publier, recherche, bienvenue, connexion.
- 187/187 tests ; balises contrôlées en local puis en production.

Reste en P3 : JSON-LD et synthèse IA comme description des actus. À l'ouverture publique :
soumettre le sitemap à la Search Console.
