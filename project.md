# Valyo — organisation du projet

**Renommage, 1er octobre 2026 :** le produit s'appelait « PriceMe » jusqu'ici. Nom abandonné après découverte d'une entreprise de comparaison de prix déjà active sous ce nom dans plusieurs pays (Nouvelle-Zélande, Philippines, Singapour, Malaisie, Australie, Indonésie, Thaïlande, Hong Kong — priceme.com, priceme.co.nz, etc.), même secteur d'activité. Risque de marque jugé trop élevé en MVP pour être conservé. Nouveau nom choisi par le porteur : **Valyo** (domaine `valyo.si` acheté). Toutes les mentions du produit dans le code et ce document ont été mises à jour ; les entrées de journal datées avant le 1er octobre reflètent l'ancien nom tel qu'il était utilisé à l'époque et n'ont pas été réécrites a posteriori.

Dernière mise à jour : 1er octobre 2026 (renommage PriceMe → Valyo).

## Mode de collaboration

Ce document est le point de référence partagé entre le porteur du projet, Claude Code et Codex. Chaque intervenant le lit avant de commencer et actualise les tâches qui le concernent. Il ne crée aucune synchronisation automatique entre les deux outils : les passages de relais doivent être explicites.

| Intervenant | Responsabilités |
| --- | --- |
| Porteur du projet | Définit le besoin, arbitre les choix produit et les dépenses, accepte les changements de périmètre et décide de la mise en ligne. |
| Claude Code | Développe les fonctionnalités, maintient l'application et les intégrations, corrige les anomalies remontées et documente les changements. |
| Codex | Organise le séquencement, examine l'architecture et le code, conçoit et maintient les tests, exécute les vérifications et rend un avis documenté sur chaque livraison. |

Codex ne développe pas les fonctionnalités et ne modifie pas le code applicatif sans demande explicite du porteur du projet. Il peut modifier les tests, leurs configurations et les documents de suivi dans le cadre d'une tâche de validation. Les corrections applicatives sont transmises à Claude Code.

Ne pas modifier simultanément les mêmes fichiers. Avant une revue, Claude Code précise les fichiers livrés et stabilise le lot concerné. Si le code change pendant la revue, Codex signale quelles conclusions doivent être revérifiées. Ne jamais écraser le travail en cours d'un autre intervenant.

## Besoin produit retenu

Valyo est un site mobile permettant de photographier un objet, de l'identifier et d'obtenir, lorsque les références disponibles le permettent, une estimation de son prix neuf et de sa valeur d'occasion.

- Premier parcours sans création de compte.
- Identification progressive, avec une question ou une photo supplémentaire utile à chaque étape.
- Deux photos maximum par objet (photo initiale + une relance ciblée), puis résultat avec la confiance disponible. Choix délibéré pour limiter le décrochage mobile — chaque photo demandée en plus est un point d'abandon ; implémenté et testé ainsi. À revalider avec le porteur si l'usage réel montre qu'une troisième photo serait rentable.
- Catégories variées acceptées, sans garantie de reconnaître ou d'estimer tous les objets.
- Prix neuf actuel, prix neuf d'origine et prix d'un équivalent clairement distingués.
- Identification et qualité de l'estimation expliquées séparément.
- Possibilité explicite de ne pas fournir de prix.

Évolutions prévues : jeu « Devine le prix », défis par lien partagé, puis détection de plusieurs objets dans une pièce avec sélection et gros plans.

Hors périmètre : publication d'annonces, marketplace, prix de vente rapide, intégrations eBay ou autres marketplaces, applications mobiles natives, réseau social et paiements.

## Principes non négociables

1. Ne pas inventer de marque, modèle, source ou comparable.
2. Ne pas présenter un prix demandé comme un prix de transaction.
3. **Modifié le 17 septembre 2026, décision explicite du porteur.** Version initiale : « Ne pas utiliser les connaissances générales du modèle comme preuve d'un prix actuel. » Le porteur a jugé qu'un refus systématique sans marque/modèle identifié était moins utile qu'une estimation honnête et clairement étiquetée (exemple donné : un bracelet sans marque — on peut estimer sa valeur sans connaître le fabricant). Nouvelle règle : toute estimation de prix porte une base explicite — `market_evidence` (chiffre réellement observé via recherche, avec source) ou `general_estimate` (raisonnement à partir de connaissances générales sur des objets similaires, sans recherche ni source inventée). Les deux sont légitimes ; ils ne doivent jamais être présentés comme équivalents dans l'interface.
4. Sans aucun repère exploitable (photo illisible, objet non identifiable même approximativement), l'estimation générale elle-même devient impossible — dans ce cas seulement, indiquer que le prix est indisponible. Une estimation générale reste préférable à un refus, mais jamais présentée comme une preuve de recherche.
5. Ne pas présenter des pourcentages de confiance comme calibrés sans validation.
6. Distinguer état visible, fonctionnement déclaré et authenticité non vérifiée.
7. Réserver les données fictives aux tests et démonstrations explicitement identifiées.
8. Garder les secrets côté serveur. Ne jamais recopier `.env.local`, clés, photos privées ou données personnelles dans les rapports, fixtures ou journaux.
9. Documenter ce qui a réellement été testé ; distinguer tests simulés et appels réels.

## Architecture de référence

Une application Next.js/TypeScript suffit au MVP. Séparer les responsabilités dans le code sans créer de microservices :

- Interface : capture, import, précisions, correction et résultat.
- Orchestration : état du scan, limites de photos, erreurs, annulation et reprises.
- Identification : fournisseur de vision remplaçable et sortie validée par schéma.
- Références de prix : provenance, date, nature du prix et droits d'utilisation.
- Estimation : calcul traçable, indépendant de l'identification.
- Confidentialité et exploitation : accès, conservation, suppression, limites d'usage et mesure des coûts.

Prévoir plusieurs objets par scan dans les contrats lorsque ces contrats sont créés ou modifiés, sans implémenter maintenant l'analyse d'une pièce. Ne pas ajouter de base, stockage persistant ou infrastructure supplémentaire sans besoin concret. Supabase reste une option du cadrage initial, pas un prérequis pour un premier parcours sans persistance.

Les sources de prix restent à choisir formellement (Lot 2 : provenance, droits d'usage, fraîcheur, exemples vérifiables non encore statués). Un choix d'implémentation a été fait entre-temps pour permettre de tester le parcours : recherche web générale (outil serveur du fournisseur de vision) plutôt qu'une intégration marketplace, avec chaque prix classé neuf/annonce/vendu et jamais présenté comme une vente confirmée sans preuve explicite. Ce choix n'a pas fait l'objet d'une revue des droits d'usage — à traiter au Lot 2. Aucun prix ne doit être présenté comme vérifié avant cette étape.

La suppression automatique des photos sous 24 heures est une politique proposée, pas une capacité acquise : vérifier le stockage, les prestataires et les sauvegardes avant d'en faire une promesse publique.

### Politique des sources de prix (Lot 2 — décision du porteur, 17 septembre 2026)

- **Provenance :** l'outil `web_search` côté serveur du fournisseur de vision (Anthropic) — pas de scraping direct de notre part, pas d'API marketplace (eBay, Vinted, etc.). Le fournisseur interroge le web et retourne des extraits (titre, URL, prix si présent) que le prompt classe en `retail_new` / `marketplace_asking` / `confirmed_sold`.
- **Décision porteur :** continuer avec cette approche pour le pilote (100 utilisateurs). Reconnu explicitement comme une décision provisoire, pas une position juridique validée — à revoir avant toute mise en marché réelle au-delà du pilote.
- **Droits d'usage :** aucune revue juridique des CGU des sites fréquemment cités (StockX, Vinted, leboncoin, eBay) n'a été faite. Le mécanisme (recherche web tierce, pas d'accès direct à ces sites) est différent d'un scraping mais n'est pas un risque nul pour un usage commercial. Reporté après le pilote, sciemment.
- **Fraîcheur :** les extraits de recherche web ne portent pas de date fiable systématique. Une mention "date non garantie" a été ajoutée à l'écran de résultat (`components/ResultCard.tsx`) — le prompt ne force pas encore le fournisseur à indiquer une date de source quand elle est disponible ; amélioration possible mais pas bloquante.
- **Exemples vérifiables :** deux scans réels documentés dans les passages de relais Lot 1 (LEGO Star Wars Death Star, Nike Air Force 1) montrent le comportement attendu — retail_new proprement sourcé, marketplace_asking distinct, aucun prix sans source. Pas encore un jeu de référence formel validé par le porteur au-delà de ces deux cas.

Statut Lot 2 : décision de principe prise, politique documentée. Reste ouvert : revue juridique différée (sciemment), jeu de référence formel, forçage de la date de source dans le prompt si jugé utile plus tard.

## État actuel — résumé pour Codex (17 septembre 2026, HEAD `0876431`)

Point d'entrée unique pour reprendre la revue : la suite de sections narratives ci-dessous (« Travaux réalisés », rapports Codex successifs, corrections C1–C6/D1–D3) reste l'historique détaillé, mais elle est longue et chronologique. Ce résumé donne l'état présent en un seul passage.

**Depuis la dernière revue Codex (D1–D3, commit `c6743f8`), 4 changements livrés hors cycle formel, à la demande directe du porteur pendant des tests réels — aucun n'a encore été revu par Codex :**

1. **Retrait du périmètre catégoriel** (commit `bbf3f62`) — `lib/prompts.ts` ne limite plus la recherche sérieuse à LEGO/électronique/sneakers ; un objet n'est plus jamais écarté pour sa catégorie, seulement pour absence de preuve visible.
2. **Bug de production corrigé** (commit `bbf3f62`) — `anthropic.messages.parse()` pouvait lever une exception (au lieu de renvoyer `parsed_output: null`) sur une sortie qui échoue au schéma, faisant échouer tout le scan (502) et perdant la recherche déjà payée. Une relance corrective a été ajoutée. Confirmé comme cause réelle de scans en échec dans les logs de production du porteur.
3. **Lot 6, jeu « Devine le prix », mode solo** (commit `c26a754`) — 5 objets réels générés via le vrai pipeline (`scripts/generate-game-data.cjs`), pas de contenu inventé. Défis par lien non faits (report explicite).
4. **Optimisation de latence puis changement de principe** (commits `9f75da9`, `0876431`) — recherche web plafonnée à 1 appel (contre 2), effort réduit, modèle passé à `claude-sonnet-5` : ~150-165s → ~47-54s sur le test répété. **Puis, changement plus profond** : le principe 3 (« ne jamais utiliser les connaissances générales comme preuve de prix ») a été explicitement révisé par le porteur — voir la section dédiée plus bas et le principe 3 révisé en tête de document. Nouveau champ `price_basis` (`market_evidence` / `general_estimate` / `unavailable`) dans `lib/schema.ts` : un prix sans source citée est désormais autorisé s'il est étiqueté `general_estimate` et justifié par un raisonnement, au lieu d'être systématiquement rejeté. Testé en réel (bracelet sans marque, 22s, estimation 5-30€ honnêtement étiquetée).

**Ce que cela implique pour la revue Codex :** les rapports C1–C6/D1–D3 portaient sur une version du produit qui refusait de donner un prix sans preuve de recherche stricte (1 seule source, 2 recherches). Cette version n'existe plus : le produit peut désormais estimer sans preuve (`general_estimate`), avec un budget de recherche réduit. Les tests de contrat existants (`tests/audit.test.cjs`, 13/13) couvrent toujours les invariants de base (pas de prix négatif, pas de source sans preuve pour `market_evidence`), mais **aucun test automatisé ne couvre encore le nouveau chemin `general_estimate`** ni son interaction avec le principe 2 (ne jamais présenter une estimation comme une vente confirmée) — point ouvert prioritaire pour la prochaine revue.

**Inventaire technique (inchangé dans ses grandes lignes depuis le dernier rapport Codex, mis à jour sur les points suivants) :**

- Next.js 15, React 19, TypeScript, Zod (v4), SDK Anthropic (`@anthropic-ai/sdk` ^0.126.0), et désormais `image-size` (validation d'image réelle, voir D2) déclarés dans `package.json`.
- Nouvelles pages/routes depuis le dernier rapport : `app/game/page.tsx`, `components/GameReveal.tsx`, `lib/game/*`, `scripts/generate-game-data.cjs`, `public/game/*.jpg`.
- `lint` toujours pas utilisable en l'état (configuration ESLint interactive jamais complétée).
- Playwright n'est pas une dépendance permanente — utilisé ponctuellement comme outil de diagnostic (bug HEIC), retiré ensuite. Toujours aucun script de tests navigateur dans le projet.
- Dépôt Git initialisé (commit `add2511`) ; historique complet et linéaire jusqu'à `0876431`. `.env.local` toujours exclu, vérifié avant chaque commit.
- Toujours aucune persistance (pas de Supabase, pas de base de données) — conforme au périmètre actuel, à revoir au Lot 4.
- La présence d'un fichier ou d'une dépendance ne prouve pas que le comportement fonctionne — voir les sections « Travaux réalisés » et les rapports Codex ci-dessous pour ce qui a été effectivement vérifié, et le résumé ci-dessus pour ce qui ne l'a pas encore été.

### Travaux réalisés le 17 septembre (session de test avec le porteur)

Contexte pour Codex avant d'ouvrir le Lot 0 : une session de test manuel avec le porteur, utilisant une vraie clé API et de vraies photos (LEGO, sneaker, photos iPhone réelles), a fait remonter plusieurs anomalies corrigées le jour même. Détail complet dans le passage de relais Lot 1 ci-dessous ; résumé :

1. **Décodage image / HEIC** (`lib/image.ts`) — le pipeline tente d'abord le décodage natif du navigateur (`createImageBitmap`, repli `<img>`), et ne convertit via la librairie `heic2any` (WASM) que si ce décodage natif échoue. Testé avec de vraies photos iPhone (5712×4284 et 4032×3024) dans Chromium et WebKit réels (Playwright). Résultat : fonctionne sur WebKit (Safari décode le HEIC nativement) ; échoue sur Chromium pour certains HEIC récents avec `ERR_LIBHEIF format not supported` — limite connue de la librairie `heic2any` (dernière version 2021, décodeur WASM daté face aux profils HEVC récents), pas un bug applicatif. Le flux caméra principal (bouton "Prendre une photo") n'est pas concerné : la capture via le navigateur produit toujours un JPEG.
2. **Classification des prix** (`lib/schema.ts`, `lib/prompts.ts`) — un champ booléen `is_asking_price` ambigu a été remplacé par un enum `price_type` (`retail_new` / `marketplace_asking` / `confirmed_sold`) après une régression observée en test réel : un prix StockX (marketplace de revente, prix demandé) avait été étiqueté comme non-"asking", ce qui aurait pu le faire passer pour un prix vendu confirmé — violation directe du principe 2. Corrigé et revérifié. Reste imparfait : le modèle classe parfois StockX en `retail_new` au lieu de `marketplace_asking` (les deux prix affichés coïncidaient dans ce test) — imprécision de classification, mais qui ne viole plus le principe critique.
3. **Langue** (`lib/prompts.ts`) — le raisonnement du fournisseur de vision sortait en anglais alors que l'interface est francophone. Instruction explicite ajoutée pour produire le raisonnement, les bullets "Pourquoi ce prix ?" et la demande de photo de relance en français ; les titres des sources de prix restent dans leur langue d'origine (ce sont des citations).
4. **Latence hors périmètre** (`lib/prompts.ts`, `lib/vision.ts`) — un test avec une photo de voiture (hors périmètre MVP) a pris 101 secondes. Instruction ajoutée pour que les catégories hors périmètre restent rapides et superficielles plutôt que de faire une recherche exhaustive. Plafond de recherche web réduit à 2 appels, `max_tokens` réduit de 8000 à 4000. Mesures avant/après sur les catégories du périmètre : LEGO sans set identifiable 112s → 30-35s ; sneaker avec identification 59-80s. Le cas voiture n'a pas été retesté après cet ajustement.
5. **Interface d'attente** (`app/scan/page.tsx`) — message évolutif + compteur de secondes pendant l'analyse, pour atténuer la perception de blocage sur les scans longs (qui restent réels, voir point 4).

Non testé à ce stade, à couvrir par le Lot 0/Codex : appareil mobile réel (tout a été fait via desktop + émulation Playwright), Firefox, comportement du fournisseur en cas de quota dépassé ou d'erreur réseau, coût réel par scan (aucune mesure/plafond en place), limite de taille d'image côté serveur en conditions réelles au-delà des cas testés.

## Séquencement et suivi

Statuts autorisés : À faire · En cours · À revoir · Corrections demandées · Validé · Bloqué.

| Lot | Objet | Réalisation | Validation | Statut |
| --- | --- | --- | --- | --- |
| 0 | Audit du code existant, commandes disponibles, écarts au besoin et risques prioritaires | Codex | Rapport avec preuves et corrections ordonnées | Validé — audit terminé, voir rapport Codex du 17 septembre |
| 1 | Stabiliser photo/import, identification, schéma, précisions et correction manuelle | Claude Code | Codex : parcours nominal, ambiguïtés, erreurs et mobile | À revoir — D1–D3 corrigés (commit `c6743f8`) puis 4 changements hors-cycle non encore revus par Codex (commit `0876431`, HEAD actuel) : voir « État actuel — résumé pour Codex » |
| 2 | Choisir les références de prix et définir les règles de publication | Porteur + Claude Code ; analyse Codex | Provenance, droits, fraîcheur et exemples vérifiables | À revoir — décision de principe prise (continuer tel quel pour le pilote), voir politique des sources de prix ; revue juridique différée sciemment |
| 3 | Estimations neuf/occasion traçables ou résultat sans prix | Claude Code | Codex : calculs, séparation des types de prix et absence de fabrication | À faire — dépend du lot 2 |
| 4 | Confidentialité, limites d'usage, coûts et robustesse du parcours complet | Claude Code | Codex : contrôles techniques et limites documentées | À faire |
| 5 | Pilote 100 utilisateurs et analyse des résultats | Porteur + Claude Code | Codex : qualité des mesures et bilan des anomalies | À faire — dépend des lots 1 à 4 |
| 6 | Jeu avec références documentées, puis défis par lien | Claude Code | Codex : scoring, cohérence et équité des manches | À revoir — mode solo livré (5 objets réels via notre propre pipeline), défis par lien non fait (report explicite du porteur) |
| 7 | Scan de pièce, sélection d'objets et estimation progressive | Claude Code | Codex : détection, omissions, doublons et total partiel | À faire — évolution ultérieure |

Le lot 2 peut avancer pendant le lot 1. Les protections essentielles de confidentialité et de coût commencent dès le lot 1 ; le lot 4 vérifie leur fonctionnement complet. Un blocage sur les prix ne doit pas bloquer les tests d'identification, mais interdit de déclarer l'estimation validée.

## Cycle de livraison

1. Définir un petit lot avec son objectif, ses critères d'acceptation et son responsable.
2. Claude Code implémente et vérifie les commandes pertinentes avant livraison.
3. Claude Code marque le lot « À revoir » et fournit le passage de relais ci-dessous.
4. Codex examine le diff ou l'état livré, vérifie l'architecture, ajoute les tests utiles et exécute les contrôles adaptés.
5. Codex classe les anomalies et rend un verdict : validé, corrections demandées ou bloqué avec dépendance précise.
6. Claude Code corrige ; Codex reteste les corrections et les régressions concernées.
7. Actualiser le suivi et passer au prochain lot. La validation technique ne constitue pas une autorisation de déploiement.

### Passage de relais Claude Code → Codex

Modèle vierge réutilisable pour les prochains lots :

- Lot et comportement livré :
- Fichiers modifiés ; commit si Git est disponible :
- Scénario de vérification et résultat attendu :
- Commandes exécutées et résultats :
- Configuration nécessaire, noms des variables uniquement :
- Limites connues et points à examiner :

#### Instance — Lot 1, 17 septembre 2026

- **Lot et comportement livré :** Lot 1 (stabiliser photo/import, identification, schéma, précisions). Détail des cinq correctifs dans "Travaux réalisés le 17 septembre" ci-dessus.
- **Fichiers modifiés ; commit si Git est disponible :** `lib/image.ts`, `lib/schema.ts`, `lib/prompts.ts`, `lib/vision.ts`, `app/scan/page.tsx`, `components/ResultCard.tsx`. Pas de commit — le dépôt n'est pas initialisé en Git.
- **Scénario de vérification et résultat attendu :** (a) photo LEGO sans numéro de set visible → aucune invention de modèle ni de prix, une seule demande de photo de relance ciblée et justifiée ; (b) photo Nike Air Force 1 → identification correcte, prix cohérent avec l'état visible, sources correctement typées neuf/annonce/vendu ; (c) vraie photo HEIC iPhone → décodage natif sur Safari/WebKit, conversion WASM sur Chrome (échoue sur certains HEIC récents avec message d'erreur et solution de contournement, ne bloque pas le flux caméra principal) ; (d) photo hors périmètre (véhicule) → réponse rapide et superficielle plutôt qu'exhaustive.
- **Commandes exécutées et résultats :** `npm run typecheck` (OK, plusieurs fois), `npm run build` (OK). Appels réels (facturés, non simulés) à `/api/analyze` via `curl` avec une vraie clé API et de vraies photos (LEGO, sneaker Nike). Tests navigateur automatisés réels via Playwright (Chromium + WebKit, outil de diagnostic ponctuel non conservé dans le projet) pour reproduire le bug HEIC avec les photos iPhone réelles du porteur, trouvées dans `~/Downloads`.
- **Configuration nécessaire, noms des variables uniquement :** `ANTHROPIC_API_KEY`.
- **Limites connues et points à examiner :** pas de test sur appareil mobile réel (desktop + émulation seulement) ; Firefox non testé ; certains HEIC récents (iPhone 15/16 Pro) échouent sur navigateurs non-Safari — limite de la librairie `heic2any`, documentée, pas corrigée davantage pour rester dans le périmètre MVP ; classification `price_type` parfois imprécise (marketplace classée comme prix neuf) sans violer le principe critique ; aucun suivi de coût par scan en place ; cas véhicule non retesté après le dernier ajustement de latence ; pas de gestion d'erreur testée pour quota dépassé ou coupure réseau côté fournisseur.

#### Instance — Lot 1, corrections R1 à R8, 17 septembre 2026

Fait suite au rapport Codex du même jour ([docs/reviews/2026-09-17-lot-0-1.md](docs/reviews/2026-09-17-lot-0-1.md)). Corrections dans l'ordre proposé par Codex.

- **Lot et comportement livré :** les 8 constats R1-R8 du rapport Codex, corrigés.
  - **R1 (P1, prix sans preuve/fourchettes invalides) :** `lib/schema.ts` — `superRefine` sur `ObjectAnalysisSchema` : rejette tout prix négatif, toute fourchette basse > haute, et tout prix (`retail_price_new`/`estimated_value_low`/`estimated_value_high`) sans au moins une entrée dans `price_sources`. `lib/prompts.ts` mis à jour pour que le fournisseur intériorise la règle en amont — sinon un résultat qui viole l'invariant fait échouer tout le scan côté extraction structurée (`parsed_output` null), ce qui est le comportement voulu mais gaspille l'appel si le prompt ne le guide pas.
  - **R2 (P1, écran conforme à l'ancien produit) :** `lib/schema.ts` — `recommended_listing_price` et `quick_sale_price` retirés du schéma (concepts de vente/marketplace hors périmètre, cf. "Besoin produit retenu"). `components/ResultCard.tsx` réécrit : affiche maintenant `retail_price_new` (jamais rendu avant) distinctement de l'estimation occasion ; état explicite "Aucun prix disponible..." quand rien n'est chiffrable au lieu de "— – —" ; pourcentages de confiance remplacés par des libellés qualitatifs (Faible/Moyenne/Élevée) pour ne pas laisser croire à une calibration (principe 5).
  - **R4 (P2, entrées mal validées) :** `app/api/analyze/route.ts` — corps `null`/non-objet rejeté avant toute déstructuration (400, plus de `TypeError`). Nouveau `lib/imageValidation.ts` : vérifie la forme base64 ET les octets magiques réels (JPEG/PNG/WEBP) avant d'atteindre le fournisseur payant — un MIME déclaré ne suffit plus.
  - **R5 (P2, URLs de sources) :** `lib/schema.ts` — `PriceSourceSchema.url` n'accepte que des URLs absolues http/https (`javascript:` et autres schémas rejetés).
  - **R6 (P2, correction/reprise incomplètes) :** `app/scan/page.tsx` réécrit — un seul capture/import à la fois (`busy`) ; identifiant de requête pour ignorer les réponses périmées en cas de double soumission ; une erreur transitoire ne perd plus les photos (« Réessayer » relance la même requête, « Recommencer » reste disponible séparément pour tout effacer) ; bouton « Passer » sur l'écran de relance pour accepter le résultat du premier tour plutôt que d'imposer une deuxième photo.
  - **R3 (P1 avant ouverture publique, pas de quota) :** nouveau `lib/rateLimit.ts` — limite en mémoire par IP (10/h) et globale (200/h), réponse 429 + `Retry-After`. Limite documentée dans le fichier lui-même : correct sur une seule instance Node longue durée, **pas** distribué — ne protège pas un déploiement serverless multi-instance (Vercel). Stopgap explicite, pas une solution de production.
  - **R7 (P2, délai incohérent) :** `maxDuration` passé de 60 à 120s avec commentaire sur la limite Vercel Hobby (60s, dépassée par nos mesures) vs Pro (300s). Message d'attente "presque fini" remplacé par un message honnête qui ne promet plus une fin imminente. `AbortController` côté client à 150s pour éviter un blocage silencieux en cas de coupure réseau.
  - **R8 (P2, journalisation/fuites) :** `app/api/event/route.ts` réécrit — liste fermée de 7 noms d'événements, clés de `props` limitées à des nombres/booléens connus (plus de JSON arbitraire journalisé). `app/api/analyze/route.ts` — erreurs fournisseur journalisées en message borné (nom + message), plus l'objet d'erreur complet. `lib/image.ts` — `ImageBitmap.close()` appelé après dessin sur le canvas (fuite mémoire sur scans répétés) ; l'aperçu vient maintenant du blob réellement décodé/envoyé (pas du fichier HEIC original), donc reste lisible même après conversion. `app/scan/page.tsx` — URLs d'aperçu révoquées à la réinitialisation et au démontage du composant.
- **Fichiers modifiés :** `lib/schema.ts`, `lib/prompts.ts`, `lib/vision.ts` (inchangé sur cette passe, revérifié), `lib/image.ts`, `app/api/analyze/route.ts`, `app/api/event/route.ts`, `app/scan/page.tsx`, `components/ResultCard.tsx`, nouveaux `lib/imageValidation.ts` et `lib/rateLimit.ts`. Édition mécanique de `tests/audit.test.cjs` : deux nouvelles dépendances de `route.ts` (`imageValidation`, `rateLimit`) chargées réellement (comme `schema`/`vision`) pour que le harnais reste exécutable — aucune assertion existante modifiée. Pas de commit — dépôt toujours sans Git.
- **Scénario de vérification et résultat attendu :** suite `tests/audit.test.cjs` (7/7, contre 2/7 avant correction) ; `npm run typecheck` et `npm run build` après chaque fichier modifié ; appel réel (facturé) à `/api/analyze` avec la photo Nike Air Force 1 déjà utilisée en Lot 1 — 200, 64s, `retail_price_new: 119.99` avec source `retail_new` (Nike.fr), estimation occasion 20-40€ avec sources `marketplace_asking` correctement typées et URLs http(s) valides, réponse en français.
- **Commandes exécutées et résultats :** `node --test tests/audit.test.cjs` → 7 réussis, 0 échec. `npm run typecheck` → OK. `npm run build` → OK (après nettoyage de `.next`, voir point suivant). `curl` réel vers `/api/analyze` avec clé API réelle → 200 en 64s.
- **Configuration nécessaire, noms des variables uniquement :** `ANTHROPIC_API_KEY` (inchangé).
- **Limites connues et points à examiner :** mobile réel toujours non testé (web desktop uniquement) ; le rate limiter en mémoire ne protège pas un déploiement multi-instance — à remplacer avant toute ouverture publique réelle ; aucun test automatisé nouveau pour R6/R7/R8 spécifiquement, vérifiés manuellement seulement (le harnais `tests/audit.test.cjs` reste centré schéma + validation d'entrée de route, pas UI) ; classification `price_type` toujours parfois imprécise dans de rares cas ; aucune mesure/plafond de coût € par scan en place (le rate limiter borne le nombre d'appels, pas leur coût) ; pas de commit Git. Point opérationnel : j'ai relancé `npm run build` pendant que le serveur `npm run dev` tournait, ce qui corrompt le cache `.next` (déjà rencontré plus tôt dans la session) — nettoyé avec `rm -rf .next` et redémarrage propre avant le test réel final ; aucun impact sur le code livré, mais à éviter en local si le porteur teste en parallèle.

#### Instance — Lot 1, corrections C1 à C6, 17 septembre 2026

Fait suite à la revue Codex « Revue des corrections R1–R8 » ([docs/reviews/2026-09-17-lot-1-reverification.md](docs/reviews/2026-09-17-lot-1-reverification.md)). Verdict de cette revue : « corrections substantielles confirmées, Lot 1 encore en corrections demandées », 3 échecs sur 11 tests. Corrections ci-dessous, dans l'ordre du rapport.

- **Lot et comportement livré :** les 6 constats C1-C6.
  - **C1 (P1, une source sans prix suffisait) :** `lib/schema.ts` — le `superRefine` exige maintenant qu'au moins une entrée de `price_sources` porte un `price` non nul (pas seulement une URL/titre). Une "source" avec `price: null` est une citation, pas une observation chiffrée ; elle ne peut plus justifier un prix publié. `lib/prompts.ts` mis à jour pour que le fournisseur comprenne la distinction en amont.
  - **C2 (P1, un refus IP épuisait le quota global) :** `lib/rateLimit.ts` réécrit — le quota global n'est plus décrémenté par une requête déjà rejetée par sa propre limite IP ; la vérification IP se fait avant toute consultation du compteur global. Ajout d'un nettoyage périodique des IP expirées de la `Map` (évitait une croissance non bornée sur un process longue durée). Limites toujours ouvertes, non résolues et documentées comme telles dans le fichier : compteurs non distribués, pas de plafond en euros, `x-forwarded-for` non fiable sans proxy de confiance connu.
  - **C3 (P2, signature de 3 octets acceptée comme JPEG valide) :** `lib/imageValidation.ts` — ajout d'une taille minimale plausible (128 octets) et d'une vérification de fin de fichier (marqueur EOI `FF D9` pour JPEG, chunk `IEND` pour PNG, cohérence de la taille déclarée dans l'en-tête RIFF pour WEBP), en plus des octets de signature déjà vérifiés. Toujours pas un décodage complet (dimensions/pixels non vérifiés) — documenté comme limite, pas silencieusement laissé de côté.
  - **C4 (P2, correction manuelle absente) :** implémentée plutôt que reportée. `lib/vision.ts`/`lib/prompts.ts` acceptent une note de correction optionnelle, injectée dans le prompt de recherche avec instruction explicite de ne pas accepter aveuglément l'affirmation de l'utilisateur si la photo ne la confirme pas. `app/api/analyze/route.ts` valide et borne le champ `correction` (500 caractères max). `components/ResultCard.tsx` — zone de correction texte sur l'écran de résultat. `app/scan/page.tsx` — une seule correction autorisée par scan (évite un aller-retour sans fin), relance l'analyse avec les mêmes photos.
  - **C5 (P2, délai non propagé aux appels SDK) :** `lib/vision.ts` — `maxDuration` était une déclaration d'hébergement sans effet réel sur le pipeline. Ajout d'un `AbortSignal` combiné (délai serveur de 110s + signal de la requête entrante) passé explicitement à chaque appel `anthropic.messages.create`/`.parse`. `app/api/analyze/route.ts` transmet `req.signal`. `app/scan/page.tsx` — le contrôleur d'annulation est maintenant accessible en dehors de `runAnalysis` et annulé au démontage du composant (une navigation en cours de scan arrête réellement la requête), pas seulement par le timeout client.
  - **C6 (P2, message fournisseur brut journalisé) :** nouveau `lib/errors.ts` — `classifyProviderError` retourne une catégorie fermée (`rate_limited`, `timeout`, `network_error`, etc.) à partir des classes d'erreurs typées du SDK, jamais `err.message`. `app/api/analyze/route.ts` journalise catégorie + identifiant de diagnostic généré (`newDiagnosticId`), renvoyé aussi au client pour permettre un signalement sans exposer le message du fournisseur.
  - **Note mineure R2 (fourchette à une seule borne) :** `components/ResultCard.tsx` — une estimation avec une seule borne non nulle s'affiche maintenant "à partir de X" / "jusqu'à X" au lieu de "X – —".
- **Fichiers modifiés :** `lib/schema.ts`, `lib/rateLimit.ts`, `lib/imageValidation.ts`, `lib/vision.ts`, `lib/prompts.ts`, `app/api/analyze/route.ts`, `app/scan/page.tsx`, `components/ResultCard.tsx`, `app/api/event/route.ts` (ajout de l'événement `correction_submitted`), nouveau `lib/errors.ts`. Édition mécanique de `tests/audit.test.cjs` : `lib/errors.ts` ajouté aux dépendances chargées pour de vrai par `route()`, même schéma que précédemment — aucune assertion modifiée. Pas de commit — dépôt toujours sans Git.
- **Scénario de vérification et résultat attendu :** suite `tests/audit.test.cjs` (11/11, contre 8/11 avant correction) ; `npm run typecheck` et `npm run build` (dev arrêté avant le build pour éviter le conflit `.next`) ; appel réel avec correction textuelle ("peut-être pas un modèle '07 standard, vérifie s'il y a une version spéciale") sur la photo Nike Air Force 1 déjà utilisée — 200, 76s. Le fournisseur a pris la correction au sérieux sans la croire aveuglément : confiance d'identification passée à 85 %, mais `missing_information` inclut explicitement "confirmation du modèle exact (standard vs édition spéciale)" et la photo de relance demandée vise précisément à vérifier ce point plutôt que d'accepter l'affirmation de l'utilisateur. Une seule source de prix retenue (Grailed, 54 $, `marketplace_asking`) — conforme à l'invariant C1 (prix observé requis, pas seulement une citation).
- **Commandes exécutées et résultats :** `node --test tests/audit.test.cjs` → 11 réussis, 0 échec. `npm run typecheck` → OK. `npm run build` → OK. Appel réel (facturé) avec correction → 200 en 76s.
- **Configuration nécessaire, noms des variables uniquement :** `ANTHROPIC_API_KEY` (inchangé).
- **Limites connues et points à examiner :** validation d'image (C3) toujours pas un décodage complet — dimensions/pixels non vérifiés, seulement structure début/fin/taille ; rate limiter (C2) toujours en mémoire, non distribué, et `x-forwarded-for` reste non authentifié ; le signal d'annulation (C5) coupe l'appel SDK mais ne garantit pas l'absence de facturation partielle côté fournisseur pour le travail déjà engagé ; correction manuelle (C4) plafonnée à une par scan et pas de test automatisé dédié, vérifiée manuellement + par un appel réel ; toujours pas de mesure/plafond de coût € par scan.

### Rapport Codex → Claude Code

- Lot et version/état examiné :
- Verdict :
- Constats, du plus grave au moins grave :
- Pour chaque anomalie : fichier/ligne, reproduction, attendu, observé, impact et correction attendue :
- Tests exécutés et résultats :
- Contrôles non exécutés et raison :
- Prochain lot recommandé :

Gravité : P0 = fuite de données ou incident critique ; P1 = parcours essentiel cassé ou résultat trompeur ; P2 = défaut fonctionnel limité ; P3 = amélioration mineure. Un P0 ou P1 connu empêche la validation du lot affecté. Un risque accepté doit être consigné avec son responsable.

## Stratégie de tests — responsabilité Codex

Privilégier les comportements et les risques, sans tests qui recopient simplement l'implémentation.

| Domaine | Vérifications attendues |
| --- | --- |
| Photos | Fichier invalide, format non accepté (dont HEIC/HEIF réels, pas seulement JPEG/PNG), taille excessive, image illisible, orientation, limite de deux photos, retrait et nouveau scan |
| Identification | Objet ambigu, marque absente, texte contradictoire, demande ciblée, correction manuelle et aucun modèle inventé |
| Contrat fournisseur | JSON invalide, champs absents, refus, délai dépassé, quota et erreur réseau |
| Prix | Références absentes, distinction neuf/équivalent/occasion, sources datées, comparables inadéquats et calcul reproductible |
| Interface | Chargement, erreur récupérable, double clic, réponse périmée, clavier, libellés et affichage mobile |
| Confidentialité | Clé absente du client, absence de photos/secrets dans les logs, accès privé et suppression si persistance |
| Coûts | Nombre d'appels borné, absence de boucle de relance, limites serveur et mesure sans données sensibles |

Automatisation : tests unitaires des règles et schémas, tests des routes avec fournisseurs simulés, puis quelques parcours Playwright. Les appels payants réels doivent être identifiés et bornés ; la suite courante doit fonctionner sans clé de production.

Vérifier `npm run typecheck`, `npm run build` et la disponibilité réelle du lint lors de l'audit initial. Un script déclaré n'est pas un contrôle réussi. Documenter ensuite ici les commandes de tests effectivement mises en place.

Pour la caméra et les formats mobiles, compléter l'émulation par un essai sur appareil réel ; ne pas annoncer une validation iPhone/Android sur la seule base d'un viewport réduit.

## Critères de fin d'un lot

- Critères fonctionnels satisfaits et écarts documentés.
- Tests pertinents réussis sur l'état livré.
- Aucun P0/P1 ouvert sur le lot.
- Erreurs et informations manquantes traitées honnêtement dans l'interface.
- Impacts sur données personnelles, coûts et architecture examinés.
- Aucun secret dans le code ou les rapports.
- Passage de relais, statut et limites actualisés.

## Journal partagé

| Date | Auteur | Action / décision | Vérification | Suite |
| --- | --- | --- | --- | --- |
| 2026-09-17 | Codex | Création du cadre de collaboration à la demande du porteur ; Claude Code développe, Codex teste et revoit | Inventaire du dépôt uniquement ; aucun test exécuté | Lancer le lot 0 à la prochaine demande de revue |
| 2026-09-17 | Claude Code | Session de test réel avec le porteur (vraie clé API, vraies photos) ; 5 anomalies trouvées et corrigées (HEIC, classification des prix, langue, latence hors périmètre, indicateur d'attente) ; mise à jour du document (état du dépôt périmé, incohérence 2 vs 3 photos, passage de relais Lot 1 rempli) | `npm run typecheck` et `npm run build` après chaque correctif ; appels réels facturés à `/api/analyze` ; Playwright (Chromium + WebKit) pour reproduire le bug HEIC avec de vraies photos iPhone | Codex : ouvrir le Lot 0 avec l'état du dépôt à jour ci-dessus, puis revoir le Lot 1 via le passage de relais rempli. Point ouvert pour le porteur : pas de budget € fixé pour le pilote 100 utilisateurs (Lot 5) alors que les scans mesurés coûtent des appels Opus 5 + recherche web de 30 à 100+ secondes chacun. |

Ajouter ici une ligne après chaque livraison ou revue. Ne pas marquer un lot validé sur une intention, une lecture superficielle ou des résultats d'une version antérieure.

## Revue Codex du 17 septembre 2026

Rapport : [Audit Lot 0 et revue Lot 1](docs/reviews/2026-09-17-lot-0-1.md). Lot 0 terminé ; Lot 1 non validé. Aucun code applicatif modifié.

Commandes : `npm run typecheck` et `npm run build` réussis ; lint non opérationnel. Nouvelle suite hors ligne : `node --test tests/audit.test.cjs` — 2 réussites, 5 échecs reproduisant les défauts de contrat. Aucun appel payant.

Priorité Claude Code : garde-fous des prix et conformité du résultat, validation des entrées et correction/reprise, puis limites de coût/durée et confidentialité avant ouverture. Détails R1 à R8 et limites des vérifications dans le rapport.

Journal — 2026-09-17, Codex : audit et revue effectués, tests de contrat ajoutés sans dépendance, rapport livré ; prochaine action : corrections Claude Code puis nouvelle revue.

| 2026-09-17 | Claude Code | Corrections R1 à R8 du rapport Codex (garde-fous de prix, écran aligné au besoin produit, validation d'entrée réelle, URLs restreintes, correction/reprise sans perte de photos, quota en mémoire, délai honnête, journalisation restreinte + fuites mémoire corrigées). Détail complet dans le passage de relais Lot 1 ci-dessus | `node --test tests/audit.test.cjs` : 7/7 (contre 2/7 avant) ; `npm run typecheck` et `npm run build` OK ; appel réel facturé à `/api/analyze` (photo Nike Air Force 1, 64s, structure validée) | Codex : revue des corrections R1-R8, en particulier le rate limiter (limite connue : non distribué) et l'extension mécanique de `tests/audit.test.cjs`. Point ouvert pour le porteur, toujours non tranché : budget € du pilote 100 utilisateurs. |
| 2026-09-17 | Porteur + Claude Code | Premier test réel sur iPhone (Safari, via partage de connexion) : la capture caméra native fonctionne (contrairement à Mac desktop, où "Prendre une photo" ouvre Finder — comportement normal, `capture` n'est pas honoré par les navigateurs desktop). Un scan complet effectué depuis le téléphone : identification 55 %, aucun prix retourné faute de source (comportement attendu de R1, pas un bug). `next.config.js` : ajout de `allowedDevOrigins` pour supprimer l'avertissement cross-origin en dev sur réseau local | Lecture des logs serveur (`[event] scan_started` puis `result_shown` depuis l'IP réseau du téléphone) ; un seul scan, pas les 2-3 par catégorie recommandés | Porteur : compléter les tests mobiles sur les 3 catégories du périmètre si utile avant la prochaine revue Codex. Ensuite : démarrer le Lot 2 (sources de prix et droits d'usage), qui peut avancer en parallèle du Lot 1. |
| 2026-09-17 | Porteur + Claude Code | Décision Lot 2 : continuer avec la recherche web générale (pas de scraping, pas d'API marketplace) pour le pilote, revue juridique des CGU sources différée sciemment. Politique documentée ci-dessus. Ajout d'une mention "date non garantie" sur l'écran de résultat (`components/ResultCard.tsx`) | `npm run typecheck` OK | Codex : analyse du Lot 2 quand pertinent. Porteur : garder en tête que la revue juridique et le jeu de référence formel restent ouverts avant une mise en marché au-delà du pilote. |
| 2026-09-17 | Claude Code | Corrections C1 à C6 de la revue Codex « Revue des corrections R1–R8 » : preuve chiffrée requise pour tout prix publié, quota global protégé des refus IP, validation d'image renforcée (taille min + fin de fichier), correction manuelle implémentée (pas reportée), délai réellement propagé aux appels SDK + annulation au démontage, erreurs fournisseur classées sans message brut journalisé. Détail complet dans le passage de relais Lot 1 ci-dessus | `node --test tests/audit.test.cjs` : 11/11 (contre 8/11 avant) ; `npm run typecheck` et `npm run build` OK ; appel réel facturé avec correction textuelle sur la photo Nike Air Force 1 (76s) — la correction a été prise en compte sans être acceptée aveuglément | Codex : nouvelle revue des corrections C1-C6, en particulier si la validation d'image renforcée et le comportement de la correction manuelle sont jugés suffisants. Points toujours ouverts pour le porteur : budget € du pilote, revue juridique des sources de prix. |
| 2026-09-17 | Porteur + Claude Code | Dépôt Git initialisé (commit `add2511`, 31 fichiers) — clôt un point relevé dans plusieurs passages de relais précédents ("pas de commit"). `.env.local` vérifié absent du commit avant validation. `.gitignore` complété (`*.tsbuildinfo`) | `git status` propre après commit ; recherche de motifs de clé API dans les fichiers commités avant `git add` | Les futures livraisons peuvent maintenant référencer un hash de commit dans leur passage de relais au lieu de "pas de commit". |

## Dernière revue Codex — corrections R1–R8

Rapport de référence actuel : [Revue des corrections](docs/reviews/2026-09-17-lot-1-reverification.md). Le rapport initial reste historique. **Lot 1 : corrections demandées**, malgré les progrès confirmés.

Vérifications : 7 tests initiaux réussis ; suite étendue à 11 tests, 8 réussites et 3 échecs ; typage réussi. Build non relancé pour préserver le cache de développement partagé. Aucun appel payant ni modification applicative.

Restes prioritaires C1–C6 : preuve chiffrée des prix, quota global consommé par les refus IP, images tronquées acceptées, correction manuelle absente, délai serveur effectif et messages fournisseur dans les logs. Claude Code reprend ces points ; Codex effectuera ensuite une nouvelle revue.

Journal — 2026-09-17, Codex : seconde revue terminée, résultats et limites documentés dans le nouveau rapport ; fonctionnement manuel maintenu.

## État actuel après revue C1–C6 (Codex)

Référence prioritaire : [Revue C1–C6 du commit 22c9cdb](docs/reviews/2026-09-17-lot-1-c1-c6.md). Les sections de revues précédentes décrivent les états historiques.

Lot 1 : corrections demandées pour D1 (prix source négatif), D2 (décodabilité image), D3 (correction perdue au retry/photo suivante). C2 et C6 corrigés ; C5 câblé et vérifié par lecture.

Tests initiaux : 11/11 ; suite étendue : 11/13, deux échecs reproduits. Typage réussi. Aucun appel payant, aucune modification applicative. Budget pilote et revue juridique différée ne bloquent pas les tests locaux.

## Corrections D1 à D3 par Claude Code, 17 septembre 2026

Fait suite à [Revue C1–C6 du commit 22c9cdb](docs/reviews/2026-09-17-lot-1-c1-c6.md).

- **D1 (P2, prix source négatif accepté) :** `lib/schema.ts` — `PriceSourceSchema.price` porte maintenant `.nonnegative()` directement, pas seulement une vérification au niveau composite. Un prix source négatif est rejeté avant même d'être considéré comme preuve, quel que soit le contexte. Portée volontairement limitée à ce défaut syntaxique — la correspondance produit/type/devise et la provenance restent hors de ce correctif, comme demandé.
- **D2 (P2, contrôle d'image toujours un contrôle de marqueurs) :** remplacement complet de `lib/imageValidation.ts`. Au lieu de vérifier des octets de début/fin, le fichier utilise maintenant `image-size` (paquet pur JS, sans dépendance, sans binaire natif) pour parser réellement la structure JPEG/PNG/WEBP et en extraire les dimensions — un fichier structurellement invalide (ex. buffer de zéros avec juste les marqueurs SOI/EOI) fait échouer le parsing au lieu de passer. Ajout d'un plafond de dimensions (8000px) pour rejeter un en-tête qui prétendrait à une taille improbable. Vérifié : le buffer de test de Codex (zéros + marqueurs) est bien rejeté (`Corrupt JPG, exceeded buffer limits`) et une vraie photo JPEG (960×720) est bien acceptée — testé localement avant d'intégrer, puis revérifié par un appel réel à `/api/analyze` avec une vraie photo (voir résultat ci-dessous). Toujours pas un décodage pixel complet (c'est un parsing d'en-tête, pas un rendu) — `image-size` ne décode que la structure/dimensions, pas les données de pixels ; documenté comme tel, pas présenté comme plus que ça.
- **D3 (P2, correction perdue au retry/photo suivante) :** `app/scan/page.tsx` — la note de correction est maintenant conservée dans un état du scan (`correctionNote`), pas seulement transmise une fois. `retry()` et `handleFile()` (photo de relance) la réutilisent désormais ; elle n'est vidée qu'au nouveau scan (`reset()`). Le plafond d'une correction par scan (`correctionUsed`) est conservé tel quel — ce n'était pas le défaut signalé, seule la perte de contexte l'était.
- **Fichiers modifiés :** `lib/schema.ts`, `lib/imageValidation.ts` (réécrit), `app/scan/page.tsx`. Nouvelle dépendance `image-size` (paquet pur JS, pas de dépendances transitives, pas de binaire natif). Pas de nouveau commit à ce stade — à faire après cette revue.
- **Scénario de vérification et résultat attendu :** suite `tests/audit.test.cjs` → 13/13 (contre 11/13). `npm run typecheck` et `npm run build` (dev arrêté avant build pour éviter le conflit `.next`) → OK. Appel réel à `/api/analyze` avec la photo Nike Air Force 1 déjà utilisée dans les passages précédents, pour confirmer l'absence de régression sur une vraie image après le remplacement de `imageValidation.ts` — 200, 164s (variance normale du fournisseur, sans rapport avec la validation d'image qui est quasi instantanée), identification confirmée (confiance 0.85), prix neuf sourcé (Nike.com, 115$), estimation occasion volontairement absente cette fois faute de source de revente trouvée — comportement honnête conforme aux règles, pas une régression.
- **Configuration nécessaire, noms des variables uniquement :** `ANTHROPIC_API_KEY` (inchangé).
- **Limites connues et points à examiner :** `image-size` reste un parsing d'en-tête, pas un décodage pixel complet — un fichier pourrait théoriquement avoir des dimensions valides déclarées mais des données de pixels corrompues au-delà de l'en-tête ; jugé suffisant pour ce niveau de risque (MVP, pas de traitement des pixels côté serveur au-delà de l'envoi au fournisseur), mais à réévaluer si le risque perçu change. Pas de test automatisé ajouté pour D3 (vérifié manuellement, pas de scénario navigateur simulant erreur+retry) — je n'ai pas ajouté ce test moi-même, cette responsabilité restant à Codex par convention du document.

Journal — 2026-09-17, Claude Code : D1-D3 corrigés (prix source négatif rejeté, validation d'image par décodage structurel réel via `image-size`, correction manuelle persistée à travers retry/photo suivante) ; 13/13 tests, typecheck et build OK, non-régression confirmée par appel réel. Commit `c6743f8`. Prochaine action : nouvelle revue Codex.

Journal — 2026-09-17, Codex : revue de 22c9cdb terminée, rapport et deux tests ajoutés ; prochain intervenant Claude Code pour D1–D3.

## Retrait du périmètre catégoriel + bug de production corrigé + Lot 6 (mode solo), 17 septembre 2026

Fait suite à des tests réels du porteur sur mobile après le commit `c6743f8`, en dehors du cycle de revue Codex formel — deux découvertes distinctes remontées directement par le porteur, corrigées le jour même.

**1. Retrait de la restriction par catégorie (décision produit du porteur).** `lib/prompts.ts` disait explicitement aux catégories hors LEGO/électronique/sneakers de "rester superficiel" et de répondre "catégorie non prise en charge" — constaté en conditions réelles sur un bijou sans poinçon visible, où la réponse écartait la recherche avant même d'essayer. Le porteur a explicitement demandé que plus aucun objet ne soit refusé pour sa catégorie ; seule l'absence de preuve visible sur la photo reste un motif légitime de non-estimation. Instruction retirée pour toutes les catégories, budget de recherche inchangé (2 appels). Délais resynchronisés en conséquence : `lib/vision.ts` 170s, `app/api/analyze/route.ts` `maxDuration` 180s, `app/scan/page.tsx` délai client 200s. Copie d'accueil/scan qui annonçait "LEGO, électronique et sneakers" retirée.

**2. Bug de production confirmé et corrigé : échec silencieux sur URL de source invalide.** Les logs serveur montraient des échecs répétés (`category: 'provider_error'`) sur des scans réels du porteur, en plus de résultats systématiquement à `price_confidence: 0`. Cause : `anthropic.messages.parse()` peut lever une exception (au lieu de renvoyer `parsed_output: null`) quand la sortie du modèle échoue à la validation du schéma — par exemple une URL de source non conforme à `isHttpUrl`. Ce cas n'était pas géré : tout le scan échouait (502), perdant la phase de recherche déjà payée. Même bug que celui découvert indépendamment dans `scripts/generate-game-data.cjs` pendant la génération du contenu du jeu. Corrigé : une seule relance de l'extraction avec le message d'erreur de validation renvoyé au modèle, avant d'abandonner proprement si la relance échoue aussi. Nouvelle catégorie de diagnostic `schema_validation_failed` dans `lib/errors.ts` pour distinguer ce cas d'une panne fournisseur générique.

**3. Lot 6 (jeu « Devine le prix »), mode solo livré.** `app/game/page.tsx`, `lib/game/scoring.ts`, `lib/game/items.ts`. Contenu généré via `scripts/generate-game-data.cjs`, qui fait passer de vraies photos (Wikimedia Commons, CC/domaine public) par le vrai `analyzeObject` — pas de prix inventés ni de jeu de données à part. 8 photos essayées, 5 retenues (caméra Yashica, machine à espresso Rocket, skateboard Nash, sac Louis Vuitton, montre Rolex Submariner) ; 3 écartées automatiquement faute de prix exploitable (guitare, perceuse, chaise Eames) ou remplacées après coup (photo de comparaison de 4 montres donnant une fourchette inexploitable 45–15 000 $, remplacée par une photo d'une seule montre). Score : proximité à la fourchette estimée par notre propre pipeline, pas un « vrai prix » externe — dégradation progressive hors fourchette, pas de seuil binaire. Défis par lien (deuxième partie du Lot 6) explicitement reportés, pas oubliés.

**Ce qui n'a pas été fait dans cette passe :** pas de nouvelle revue Codex avant ces changements (découvertes du porteur en dehors du cycle formel) ; pas de test automatisé pour le nouveau chemin de relance de `lib/vision.ts` (`runExtraction` avec correctif) ; le jeu n'a pas été testé manche par manche dans un vrai navigateur, seulement vérifié par build + chargement des routes/assets.

**Commits :** `bbf3f62` (retrait du périmètre + correctif du bug), `c26a754` (Lot 6 mode solo).

Journal — 2026-09-17, Claude Code : voir détail ci-dessus. Prochaine action recommandée : Codex reprend la revue à partir d'ici (le cycle C1–C6/D1–D3 était déjà clos avant ces changements hors-cycle) ; porteur teste le jeu et reconfirme le comportement sur mobile après le correctif de bug.

## Optimisation de latence, 17 septembre 2026

Fait suite à un retour direct du porteur ("les recherches prennent énormément de temps") après le retrait du périmètre catégoriel, qui avait mécaniquement allongé les scans (recherche complète sur tout objet au lieu d'un traitement superficiel hors périmètre).

- **Modèle de recherche** : `lib/anthropic.ts` — `RESEARCH_MODEL` passé de `claude-opus-5` à `claude-sonnet-5`. Testé seul d'abord : aucun gain notable (160s, quasi identique à Opus) — le goulot d'étranglement n'est pas la vitesse de génération du modèle.
- **Budget de recherche** : `lib/vision.ts` — `max_uses` réduit de 2 à 1 appel `web_search`, `output_config.effort` passé de `medium` à `low`. C'est ce qui a réellement réduit le temps : ~150-165s → ~47-54s sur le même test (photo Nike Air Force 1, déjà utilisée dans plusieurs passages précédents pour comparaison directe). `lib/prompts.ts` mis à jour en conséquence (« vous avez UN appel, faites-le compter » au lieu de « jusqu'à 2 »).
- **Régression trouvée et corrigée en cours de route** : avec une seule recherche, le modèle a une fois classé une source The RealReal (plateforme de revente de luxe d'occasion) comme `retail_new` à 150 $ — une vraie erreur de classification, pas un cas limite mineur, puisque contraire au principe 2 (ne jamais présenter un prix d'occasion comme neuf officiel). `lib/prompts.ts` — règle 3 explicitée : une plateforme de consignation/revente (The RealReal, Vestiaire Collective, ThredUp, Rebag, Farfetch pre-owned, etc.) n'est JAMAIS `retail_new`, quel que soit le vocabulaire de la page. Retesté après correction : source correctement classée `retail_new` (Nike.com, 115 $, cohérent avec les tests précédents de la session).

**Compromis assumé, à surveiller** : une seule recherche au lieu de deux réduit mécaniquement la richesse des sources citées (souvent 1 source au lieu de 2-5 dans les tests précédents) et peut baisser identification/price_confidence sur des objets ambigus. Pas de mesure formelle de l'impact sur la qualité au-delà de ce test ponctuel — à surveiller par le porteur en usage réel, et par Codex si un test de régression plus large est jugé utile.

**Fichiers modifiés :** `lib/anthropic.ts`, `lib/vision.ts`, `lib/prompts.ts`. Pas de nouveau test automatisé ajouté (le harnais `tests/audit.test.cjs` ne couvre pas la latence). Pas encore commité au moment de la rédaction — à faire juste après.

Journal — 2026-09-17, Claude Code : latence réduite d'environ 3x (recherche unique, effort réduit, modèle Sonnet) suite à un retour direct du porteur ; une régression de classification de source trouvée et corrigée dans la foulée. Prochaine action : porteur reconfirme sur mobile ; Codex peut évaluer si le compromis richesse des sources / vitesse est acceptable pour le pilote.

## Changement de principe : estimation générale autorisée sans preuve de recherche, 17 septembre 2026

Décision explicite du porteur, en rupture avec un principe établi et documenté depuis le début de la collaboration (voir principe 3 révisé ci-dessus). Le porteur a signalé que l'application ne donnait quasiment jamais de prix en pratique — chaque photo sans marque/modèle identifiable aboutissait à « prix indisponible », y compris pour des objets simples (ex. un bracelet sans marque) où une estimation approximative reste possible et utile.

- **`lib/schema.ts`** : nouveau champ obligatoire `price_basis` (`market_evidence` / `general_estimate` / `unavailable`). L'invariant qui exigeait une source chiffrée pour tout prix (R1/C1) ne s'applique plus qu'au cas `market_evidence` ; le cas `general_estimate` exige à la place un `reasoning_summary` non vide expliquant la base du raisonnement — jamais un prix nu sans justification.
- **`lib/prompts.ts`** : le fournisseur doit désormais choisir explicitement une base (MARKET_EVIDENCE / GENERAL_ESTIMATE / UNAVAILABLE) pour chaque estimation, avec UNAVAILABLE réservé aux cas où même une estimation grossière serait dénuée de sens — plus la règle par défaut.
- **`components/ResultCard.tsx`** : badge visuel « Estimation générale » + note explicite quand `price_basis === "general_estimate"`, pour ne jamais laisser croire qu'une estimation générale est une donnée de marché vérifiée.
- **Nettoyage effectué en parallèle (demande explicite du porteur)** : champs morts `recommended_listing_price`/`quick_sale_price` retirés du fixture de test (résidus d'un ancien schéma, sans effet fonctionnel mais jamais nettoyés) ; vérification qu'aucune autre référence à `unrestrictedScope` ou à l'ancien texte de périmètre catégoriel ne traînait dans le code ; aucun fichier de travail temporaire resté dans le dépôt.

**Test réel de validation** : photo d'un bracelet manchette générique sans marque ni poinçon (Wikimedia Commons). Résultat : 22s, `price_basis: "general_estimate"`, fourchette 5-30 €, raisonnement explicite (« bracelets manchette non signés se vendent 5-25 € sur Vinted/Leboncoin, jusqu'à 30-80 € si argent massif confirmé »), aucune source inventée, `price_sources: []`. Comportement exactement conforme à la demande du porteur.

**Tension documentée, pas résolue** : ce changement assouplit délibérément le principe fondateur « jamais de prix sans preuve ». Le compromis retenu — toujours distinguer explicitement `market_evidence` de `general_estimate` dans le schéma et l'interface — préserve une partie de l'honnêteté du produit (on ne prétend jamais qu'une estimation générale est vérifiée), mais une estimation générale reste, par construction, une extrapolation du modèle plutôt qu'une donnée de marché réelle. À garder en tête pour le Lot 2 (politique des sources) et pour toute communication publique sur la fiabilité des prix affichés.

**Fichiers modifiés :** `lib/schema.ts`, `lib/prompts.ts`, `components/ResultCard.tsx`, `tests/audit.test.cjs` (fixture mise à jour mécaniquement pour le nouveau champ obligatoire, plus nettoyage des champs morts). `npm run typecheck`, `node --test tests/audit.test.cjs` (13/13) et `npm run build` tous vérifiés. Test réel décrit ci-dessus.

Journal — 2026-09-17, Claude Code : principe 3 révisé sur demande explicite et documentée du porteur ; `price_basis` ajouté au schéma et à l'interface ; validé par un test réel (bracelet sans marque, 22s, estimation générale honnête). Nettoyage des résidus effectué. Prochaine action : Codex évalue si la distinction market_evidence/general_estimate reste suffisamment honnête pour le principe 2 (ne jamais présenter une estimation comme une vente) ; porteur teste sur mobile.

## Dernier verdict Codex — commit 153ad11

Rapport prioritaire : [Revue 153ad11](docs/reviews/2026-09-17-review-153ad11.md). Les rapports précédents restent historiques. D1 et D3 corrigés ; D2 amélioré avec limite de parsing documentée. La décision produit autorisant les estimations générales est prise en compte.

Lot 1 : corrections ciblées E3–E5. Jeu solo : non validé, E1/E2 (devise de saisie et contrat des données). Tests : 13/13 livrés réussis ; suite étendue 15/17, deux échecs ; typage réussi. Aucun appel payant ni modification applicative. Prochaine action Claude : traiter E1–E5 ; Codex reteste ensuite.

## Corrections E1 à E5, 17 septembre 2026

Fait suite à [Revue 153ad11](docs/reviews/2026-09-17-review-153ad11.md). Les cinq constats traités dans l'ordre du rapport.

- **E2 (P2, données du jeu incompatibles) :** `lib/game/items.generated.json` — les 5 analyses générées n'avaient pas le champ `price_basis` (créées avant son ajout au schéma). Rattrapées à `market_evidence` pour les 5 (vérifié individuellement : chacune a bien 2 à 5 sources réelles issues de vraies recherches au moment de la génération, pas une valeur choisie arbitrairement). Le cast `raw as unknown as GameItem[]` dans `lib/game/items.ts` n'a pas été retiré (portée limitée à la correction des données, pas à l'ajout d'une validation au chargement — resterait à faire si jugé utile).
- **E4 (P2, explication vide acceptée) :** `lib/schema.ts` — le contrôle `reasoning_summary.length === 0` remplacé par une vérification qu'au moins une ligne contient du texte non blanc après `trim()`. `['   ']` est maintenant rejeté comme avant.
- **E1 (P1, devises mélangées dans le jeu) :** `app/game/page.tsx` affichait toujours "Votre estimation en €" alors que 3 des 5 objets de référence sont en USD (espresso, skateboard, handbag). Corrigé : le libellé et le placeholder utilisent maintenant la devise réelle de l'objet (`currencyLabel()`), aucune conversion — on demande la réponse dans la bonne unité plutôt que de convertir. `lib/game/items.ts` — `targetRange()` retourne maintenant aussi `basis: "second_hand" | "retail"` (avant, mélangé silencieusement selon les données disponibles) ; l'UI annonce explicitement si la manche porte sur le prix neuf ou l'occasion. Avec les 5 objets actuels, toutes les manches utilisent en pratique la branche occasion (aucun objet ne tombe sur le repli prix neuf), donc ce cas n'a pas pu être testé en conditions réelles — corrigé par lecture du code et vérifié par les types, pas par un test de gameplay avec un objet dans cet état.
- **E5 (P2, provenance générale limitée au bloc occasion) :** `lib/schema.ts` — nouvel invariant : `price_basis: "general_estimate"` interdit désormais `retail_price_new` non nul (une estimation générale ne peut couvrir que la fourchette occasion, jamais un prix neuf présenté comme actuel sans recherche réelle). `lib/prompts.ts` mis à jour pour que le fournisseur applique cette règle en amont plutôt que de se faire rejeter après coup.
- **E3 (P2, relance sur toute erreur) :** `lib/vision.ts` — la relance corrective de l'extraction ne se déclenche plus que sur le message d'erreur spécifique de validation de schéma (`/failed to parse structured output/i`), jamais sur une annulation (`AbortError`) ni sur une autre erreur (réseau, authentification, quota). Ces autres erreurs remontent directement, sans relance inutile.

**Fichiers modifiés :** `lib/game/items.generated.json`, `lib/game/items.ts`, `app/game/page.tsx`, `lib/schema.ts`, `lib/prompts.ts`, `lib/vision.ts`. Tests : `tests/audit.test.cjs` inchangé par Claude sur cette passe (les 4 tests ajoutés par Codex ont servi de vérification directe : 17/17 après correctifs, contre 15/17 avant). `npm run typecheck`, `npm run build` et un appel réel (photo du bracelet déjà utilisée, 29s, `price_basis: general_estimate`, pas de régression) tous vérifiés.

**Limites connues :** E1 corrigé par lecture/typage, pas par un scénario de jeu réel avec un objet en repli "prix neuf" (aucun des 5 objets actuels n'est dans cet état) ; le cast non typé dans `lib/game/items.ts` (relevé dans E2) n'a pas été retiré, seules les données ont été corrigées ; pas de nouveau test ajouté pour E1/E3/E5 spécifiquement — à la charge de Codex par convention du document.

Journal — 2026-09-17, Claude Code : E1 à E5 corrigés (devises du jeu, base occasion/neuf explicite, relance d'extraction restreinte à l'erreur de validation, estimation générale interdite sur le prix neuf, données du jeu rattrapées). 17/17 tests, build et test réel vérifiés. Prochaine action : nouvelle revue Codex, en particulier sur le cast non typé laissé en E2 et le scénario E1 non testable avec les données actuelles.

## Élargissement du pool du jeu, 17 septembre 2026

Retour direct du porteur : « il n'y a que 5 photos ». Décision prise avec lui : élargir le contenu pré-généré plutôt que de générer en direct à chaque manche (qui réintroduirait le problème de lenteur du scan principal, 30-160s par objet, tout juste corrigé). Le jeu reste rapide (contenu pré-calculé), juste moins répétitif.

- **11 objets tentés** via `scripts/generate-game-data.cjs` : 3 repêchages (guitare, perceuse, chaise Eames — écartés lors de la génération initiale sous l'ancienne règle stricte "preuve obligatoire", avant le changement de principe autorisant `general_estimate`) et 8 nouveaux (radio vintage, trompette, platine vinyle, lunettes Vuarnet, vase en céramique, voiture jouet vintage, mixeur KitchenAid, jeu Scrabble).
- **9 succès sur 11** : guitare et perceuse ont effectivement réussi cette fois grâce à `general_estimate` (confirmant que l'élargissement du principe sert aussi le jeu, pas seulement le scan principal). Radio, trompette, platine vinyle, vase, voiture jouet, mixeur et Scrabble ont tous donné un résultat exploitable au premier essai.
- **2 échecs, tous deux informatifs :**
  - **Chaise Eames** : échec à cause de la nouvelle règle E5 (`general_estimate` interdit `retail_price_new`) — le fournisseur a persisté à vouloir citer un prix neuf (probablement parce qu'un fauteuil Eames est un classique du design avec un prix de vente largement connu) même après la relance corrective avec le message d'erreur. Révèle une vraie tension : la règle E5 traite tout prix neuf comme nécessitant une recherche, même quand la connaissance générale du prix de vente est raisonnablement fiable pour un objet aussi identifiable. Non résolu ici — la chaise reste hors du pool.
  - **Lunettes Vuarnet** : aucune catégorie ni prix exploitable retourné (`{Aucune catégorie applicable}`), cause exacte non investiguée. Hors du pool.
- **Pool final : 14 objets** (contre 5), mélange `market_evidence` (5) et `general_estimate` (9) — démontre concrètement les deux bases prévues dans le schéma, pas juste en théorie.
- Photos copiées dans `public/game/`. Le générateur réutilise les résultats déjà réussis (`camera`, `espresso`, `skateboard`, `handbag`, `watch2`) sans nouveau coût — seuls les 11 nouveaux items ont déclenché de vrais appels facturés.

**Fichiers modifiés :** `scripts/generate-game-data.cjs` (liste `PHOTOS` étendue à 16 entrées, 14 réussies), `lib/game/items.generated.json` (14 items), `public/game/*.jpg` (9 nouvelles photos). Aucun changement de code applicatif au-delà du contenu — `lib/game/items.ts`, `app/game/page.tsx` et le schéma restent ceux corrigés dans le passage E1–E5.

**Vérifié :** `npm run typecheck`, `node --test tests/audit.test.cjs` (17/17, y compris le test qui valide chaque analyse du jeu contre le schéma courant), `npm run build`, et chargement réel des 9 nouvelles images via `/game/<fichier>.jpg` (200 sur les 9). Pas de test de gameplay bout-en-bout dans un vrai navigateur.

**Limite non résolue, à trancher par le porteur ou Codex :** la tension révélée par l'échec de la chaise Eames (E5 trop stricte pour des objets emblématiques dont le prix neuf est un fait de notoriété publique, pas une invention) n'a pas été traitée. Option possible pour plus tard : autoriser un `retail_price_new` sous `general_estimate` mais avec son propre badge "non vérifié", plutôt qu'une interdiction totale — pas fait ici pour rester dans la portée de la demande initiale (élargir le pool).

Journal — 2026-09-17, Claude Code : pool du jeu élargi de 5 à 14 objets (9 nouveaux + 2 écartés sur 11 tentés), suite à un retour direct du porteur sur le manque de variété. Confirmé au passage que `general_estimate` permet de récupérer des objets qui échouaient totalement avant (guitare, perceuse). Une tension non résolue documentée (E5 vs objets de notoriété publique, cas de la chaise Eames). 17/17 tests, build et chargement des assets vérifiés.

## Mise en production et internationalisation, 1er octobre 2026

Deux chantiers menés en parallèle à la demande directe du porteur.

**Déploiement** : repo poussé sur `github.com/simox666/valyo`, projet connecté sur Vercel (plan Hobby gratuit), `ANTHROPIC_API_KEY` configurée en variable d'environnement de production. Domaine `valyo.si` ajouté dans Vercel (A `216.198.79.1` sur l'apex, CNAME `www` vers la cible fournie par Vercel) et Zone DNS OVH mise à jour en conséquence — configuration DNS vérifiée correcte directement sur le serveur faisant autorité d'OVH. Point bloquant actuel, hors du contrôle du code : le domaine `valyo.si` est toujours au statut « Enregistrement en cours » côté registre `.si` (confirmé via `whois -h whois.register.si valyo.si` → `No entries found`, et preuve DNSSEC/NSEC3 de non-existence côté serveurs racine `.si`) — ni la propagation DNS ni l'accès public au domaine ne peuvent avancer tant que ce n'est pas résolu par OVH/le registre slovène. Le site est pleinement fonctionnel sur l'URL Vercel (`valyo-three.vercel.app`) en attendant.

**Internationalisation** : ajout de l'anglais, du néerlandais et de l'espagnol en plus du français, à la fois pour l'interface et pour les résultats générés par l'IA (décision explicite du porteur — pas seulement l'habillage visuel).

- **Librairie** : `next-intl`, avec routage par segment `app/[locale]/...` (`localePrefix: "as-needed"` — le français reste sur les URLs sans préfixe pour ne pas casser les liens déjà en circulation, `en`/`nl`/`es` prennent un préfixe `/en`, `/nl`, `/es`).
- **Restructuration** : `app/page.tsx`, `app/layout.tsx`, `app/scan/page.tsx`, `app/game/page.tsx` déplacés sous `app/[locale]/`. `app/api/*` reste hors du routage par locale (les API ne sont pas servies par URL localisée).
- **Dictionnaires** : `messages/{fr,en,nl,es}.json`, un fichier par langue couvrant toute l'interface statique (accueil, scan, résultat, jeu).
- **Pipeline IA localisé** : `lib/prompts.ts` accepte maintenant un `locale` (`SupportedLocale`) et instruit le modèle d'écrire ses résultats dans la langue correspondante au lieu du français fixe ; `lib/vision.ts` et `app/api/analyze/route.ts` propagent ce paramètre, avec validation côté serveur contre une liste fermée (`fr`/`en`/`nl`/`es`) — une valeur inconnue ou absente retombe sur le français par défaut, jamais transmise telle quelle au prompt.
- **Formatage des montants** : `Intl.NumberFormat` utilisait un `"fr-FR"` fixe dans `ResultCard.tsx` et `GameReveal.tsx` — remplacé par une table de correspondance locale → tag BCP-47 (`en-US`, `nl-NL`, `es-ES`).
- **Sélecteur de langue** : nouveau composant `components/LanguageSwitcher.tsx` (menu déroulant, conserve la page courante en changeant de locale), affiché sur l'accueil.

**Limite assumée, pas résolue** : le contenu du jeu « Devine le prix » (`lib/game/items.generated.json`) reste en français — c'est du contenu pré-généré une fois par de vrais appels payants (voir sections précédentes), et le traduire impliquerait soit de le régénérer dans chaque langue (coût réel x4), soit une traduction a posteriori qui romprait la garantie « jamais de texte halluciné sur le raisonnement de prix ». L'habillage du jeu (boutons, libellés de manche, score) est bien traduit ; les objets eux-mêmes (`category`/`brand`/`model`/`reasoning_summary`) ne le sont pas. Signalé au porteur comme compromis, pas tranché pour l'instant.

**Vérifié** : `npx tsc --noEmit` propre, `npm run build` réussi (17 routes générées statiquement : 4 locales × accueil/scan/jeu + API), `node tests/audit.test.cjs` 17/17 (inchangé — le mock de `lib/vision` au niveau module n'est pas affecté par le nouveau paramètre optionnel). Test réel bout-en-bout en anglais sur le serveur de dev local : photo de la machine à café Rocket Espresso déjà utilisée, `locale: "en"`, 34.8s, résultat entièrement en anglais (identification, `reasoning_summary`, `next_photo_request`) avec `price_basis: "general_estimate"` cohérent. Les 4 routes de langue testées une à une en HTTP (200 partout) avec vérification du contenu réel (`<h1>` traduit, attribut `lang` correct sur chaque page).

Journal — 2026-10-01, Claude Code : site déployé sur Vercel + GitHub (`simox666/valyo`), domaine `valyo.si` configuré mais bloqué en attente d'enregistrement registre `.si` (hors de notre contrôle). Internationalisation complète de l'interface et du pipeline IA (fr/en/nl/es) via `next-intl`, vérifiée par un test réel en anglais. Limite documentée : contenu du jeu reste français uniquement. Prochaine action : porteur suit l'activation du domaine côté OVH ; Codex peut revoir le routage `[locale]` et la validation de `locale` côté API.
