# Sources proposées pour l'agent éditorial — dossier d'autorisation

Préparé le 18 novembre 2026 par Claude, après les deux essais réels (docs/essais-agent/).
Vérifications faites ce jour : flux accessible (HTTP 200), robots.txt du site relu,
licence ou conditions identifiées. **Aucune source n'est créée ni activée : la décision
revient au porteur, dans la console `/admin/editorial`** (chaque source naît inactive ;
l'activation exige la référence d'autorisation ci-dessous, la base la garde datée).

Principe d'usage par l'agent : il lit l'article pour comprendre, puis publie un résumé
original en français AVEC le lien vers la source — jamais de copie, sauf licence qui
l'autorise expressément (The Conversation).

## Proposées à l'activation

| # | Source | Flux | Type | Priorité | Référence d'autorisation à saisir |
|---|---|---|---|---|---|
| 1 | The Conversation France | `https://theconversation.com/fr/articles.atom` | press | 1 | Licence CC BY-ND 4.0 affichée sur chaque article (« Republier cet article ») — <https://theconversation.com/fr/republishing-guidelines> ; robots.txt sans interdiction des articles. Vérifié le 18/11/2026. |
| 2 | CNRS Le Journal | `https://lejournal.cnrs.fr/rss` | scientific | 1 | robots.txt sans interdiction des articles ; contenu sous copyright CNRS : usage borné au résumé original + lien (principe d'agrégateur, courte citation). Vérifié le 18/11/2026. |
| 3 | Inserm — salle de presse | `https://presse.inserm.fr/feed/` | primary | 2 | Communiqués de presse destinés à la diffusion ; robots.txt sans interdiction. Vérifié le 18/11/2026. |
| 4 | ActuIA | `https://www.actuia.com/feed/` | press | 2 | robots.txt sans interdiction des articles ; usage borné au résumé original + lien (principe d'agrégateur, courte citation). Vérifié le 18/11/2026. |
| 5 | NASA News Releases | `https://www.nasa.gov/news-release/feed/` | primary | 3 | robots.txt : `User-agent: * / Allow: /` ; contenus NASA non soumis au droit d'auteur (œuvre du gouvernement américain), attribution demandée. Flux en anglais, l'agent rédige en français. Vérifié le 18/11/2026. (L'ancienne adresse `rss/dyn/breaking_news.rss` redirige ici.) |

## Écartée, avec motif

- **Futura Sciences** : son robots.txt interdit TOTALEMENT les robots d'IA (section
  « BOTS IA ET BROUILLEURS », `ClaudeBot`, `GPTBot`… `Disallow: /`). L'agent éditorial
  ne doit pas y collecter. (Sans incidence sur l'import d'actus du fil, qui ne lit que
  le flux RSS public et renvoie vers l'article — mécanisme distinct de l'agent.)

## Marche à suivre dans la console (5 minutes)

1. `/admin/editorial` → section Sources → ajouter chacune des cinq lignes (nom, URL du
   flux, type, priorité, thèmes de votre choix ; « récupérer les articles » activé).
2. Pour chaque source créée, l'activer en collant la référence d'autorisation de la
   colonne de droite (la date de vérification est enregistrée automatiquement).
3. Laisser l'agent **en pause** : l'activation des sources n'appelle rien ; la suite
   (collecte d'essai puis recette humaine des 40 éléments, contrat §2C) se décide après.
