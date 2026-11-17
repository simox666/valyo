# Sources éditoriales D2 — vérifications une par une

Première passe le 13 novembre 2026 (lot d'accélération, tâche A5). Contrôles effectués par
requêtes HTTP simples sur les adresses publiques (flux et pages de conditions), sans
contournement d'accès d'aucune sorte. **Aucune source n'a été ajoutée ni activée dans la
console** : l'activation reste une action d'administration, source par source, sur la base
de ce document et de la décision du porteur.

Règle appliquée (tâche A5) : autorisation incertaine = source **inactive**.

## Synthèse

| Source | Flux vérifié | Accessible | Langue | Conditions constatées | Verdict provisoire |
|---|---|---|---|---|---|
| arXiv (cs.AI) | `https://rss.arxiv.org/rss/cs.AI` | Oui (13 nov. 2026, ~46 éléments, jours ouvrés) | en | Licence PAR ARTICLE (`dc:rights` : arXiv non exclusive, CC BY, CC BY-SA, CC BY-NC-SA) | **Activable avec précaution** : métadonnées et courtes citations attribuées ; la licence varie par article |
| NASA (breaking news) | `https://www.nasa.gov/rss/dyn/breaking_news.rss` | Oui (13 nov. 2026) | en-US | Pas de copyright dans le flux ; œuvres du gouvernement américain en général non protégées, crédits à conserver | **Activable** (priorité 1, anglais) |
| ESA (Top News) | `https://www.esa.int/rssfeed/TopNews` | Oui (12 nov. 2026) ; l'ancienne adresse `rssfeed/Our_Activities/Space_News` renvoie 404 | en | `Copyright European Space Agency` ; conditions du site : reproduction/distribution/œuvres dérivées interdites sans autorisation écrite | **Inactive** : autorisation écrite à demander avant usage |
| CNRS Le Journal | `https://lejournal.cnrs.fr/rss` | Oui (13 nov. 2026) | **fr** | Mentions légales : « © CNRS », sans conditions de réutilisation ; une « Charte d'utilisation » distincte reste à lire | **Inactive** : conditions à confirmer (charte, ou contact rédaction) |
| Inria (actualités) | `https://www.inria.fr/fr/rss.xml` | **Non** : page de blocage anti-robot (Anubis), « Access Denied » | fr | Non consultables automatiquement | **Écartée pour l'instant** : aucun contournement ; demander à Inria un accès de flux si souhaité |

## Détails et dates de contrôle

### arXiv — contrôlé le 13 novembre 2026
- Flux RSS 2.0 valide (`cs.AI updates on arXiv.org`), mis à jour chaque jour ouvré (`skipDays` samedi/dimanche).
- Les droits sont portés **par chaque élément** (`dc:rights`). Usage prudent compatible avec notre
  pipeline : titre, lien, courtes citations mot à mot attribuées, statut « prépublication non relue ».
- Avant activation : convenir de la règle d'affichage (toujours citer la licence de l'article ?) et
  vérifier les conditions générales des API arXiv.

### NASA — contrôlé le 13 novembre 2026
- Flux RSS 2.0 valide et actif, agrégé depuis plusieurs sections (nasa.gov, science.nasa.gov).
- Pas de mention de droits dans le flux ; politique générale NASA : contenus en règle générale
  librement réutilisables avec crédit (œuvres fédérales américaines), à l'exception de certains
  éléments crédités à des tiers (ex. APOD « Credit & Copyright ») — notre agent cite toujours la source.
- Langue anglaise : le résumé français de l'agent attribue l'annonce à la NASA.

### ESA — contrôlé le 13 novembre 2026
- Flux `TopNews` accessible ; « ESA Space News » (`rssfeed/Our_Activities/Space_News`) n'existe plus (404).
- Conditions du site : téléchargement pour usage personnel et non commercial uniquement ;
  modification, publication, distribution ou œuvre dérivée interdites sans autorisation écrite.
- Verdict : **ne pas activer**. Si le porteur veut l'ESA, demander une autorisation écrite
  (le média relations ESA accorde couramment l'usage éditorial avec crédit, mais cela doit être
  documenté dans `authorization_reference`).

### CNRS Le Journal — contrôlé le 13 novembre 2026
- Flux RSS 2.0 valide, en français, actif (dernier élément du 13 novembre 2026). Source
  francophone de priorité 1 idéale pour notre public.
- Les mentions légales n'énoncent pas de conditions de réutilisation ; une « Charte
  d'utilisation » distincte existe. CNRS Le Journal a historiquement proposé la republication
  de ses articles, mais cela doit être vérifié sur la charte actuelle avant activation.
- Prochain pas : lire la charte, ou écrire à la rédaction ; consigner la référence dans la console.

### Inria — contrôlé le 13 novembre 2026
- `https://www.inria.fr/fr/rss.xml` est derrière une protection anti-robot (Anubis) qui
  bloque les clients automatisés. Conformément à la règle « aucun contournement d'accès »,
  la source est écartée. Alternative : demander à Inria si un flux destiné aux agrégateurs existe.

## Ce que ce document ne fait pas

- Il ne vaut pas autorisation : seule une condition d'usage écrite, citée dans
  `authorization_reference` au moment de l'activation, le permet.
- Il ne couvre qu'une première liste ; d'autres sources (laboratoires d'IA, universités,
  presse spécialisée francophone) suivront la même procédure, une par une.
