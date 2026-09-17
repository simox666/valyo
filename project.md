# PriceMe — organisation du projet

Dernière mise à jour : 17 septembre 2026 (corrections R1-R8 par Claude Code suite à la revue Codex du même jour).

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

PriceMe est un site mobile permettant de photographier un objet, de l'identifier et d'obtenir, lorsque les références disponibles le permettent, une estimation de son prix neuf et de sa valeur d'occasion.

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
3. Ne pas utiliser les connaissances générales du modèle comme preuve d'un prix actuel.
4. Sans référence exploitable, indiquer que le prix est indisponible. Une fourchette large ne remplace pas des preuves.
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

## État observé du dépôt

Inventaire mis à jour le 17 septembre 2026 par Claude Code, après une session de test en conditions réelles avec le porteur (voir "Travaux réalisés" ci-dessous). Remplace le premier inventaire, qui datait déjà de quelques heures.

- Next.js 15, React 19, TypeScript, Zod (v4) et SDK Anthropic (`@anthropic-ai/sdk` ^0.126.0) déclarés dans `package.json`.
- Pages d'accueil et de scan, composants `PhotoInput` et `ResultCard` présents.
- Routes `/api/analyze` et `/api/event` présentes.
- Modules d'image (`lib/image.ts`), vision (`lib/vision.ts`), schéma (`lib/schema.ts`), prompts (`lib/prompts.ts`) et analytics (`lib/analytics.ts`) présents dans `lib/`.
- Scripts déclarés : `dev`, `build`, `start`, `lint`, `typecheck`.
- `lint` n'est pas utilisable en l'état : `next lint` déclenche une configuration ESLint interactive (choix de config au premier lancement) qui n'a pas été complétée — le script existe mais n'a jamais produit de résultat exploitable.
- Playwright n'est plus une dépendance du projet : utilisé ponctuellement comme outil de diagnostic (reproduction du bug HEIC dans de vrais moteurs Chromium/WebKit), puis retiré. Aucun script de tests automatisés n'existe dans le projet à ce stade — le Lot 0/Codex part de zéro sur ce plan.
- Dépôt Git initialisé le 17 septembre 2026 (commit `add2511`, 31 fichiers) — `.env.local` correctement exclu, vérifié avant commit. Les mentions "pas de commit — dépôt sans Git" dans les passages de relais ci-dessous sont antérieures à cette initialisation et reflètent l'état au moment où elles ont été écrites.
- Aucune persistance : pas de Supabase, pas de base de données, pas de stockage — les images ne sont traitées qu'en mémoire pour l'appel au fournisseur de vision, rien n'est sauvegardé. Conforme au périmètre actuel, à revoir au Lot 4.
- La présence d'un fichier ou d'une dépendance ne prouve pas que le comportement fonctionne — voir "Travaux réalisés" pour ce qui a été effectivement vérifié en conditions réelles, et ses limites.

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
| 1 | Stabiliser photo/import, identification, schéma, précisions et correction manuelle | Claude Code | Codex : parcours nominal, ambiguïtés, erreurs et mobile | Corrections demandées — revue du commit 22c9cdb ; restes D1–D3, voir dernier rapport |
| 2 | Choisir les références de prix et définir les règles de publication | Porteur + Claude Code ; analyse Codex | Provenance, droits, fraîcheur et exemples vérifiables | À revoir — décision de principe prise (continuer tel quel pour le pilote), voir politique des sources de prix ; revue juridique différée sciemment |
| 3 | Estimations neuf/occasion traçables ou résultat sans prix | Claude Code | Codex : calculs, séparation des types de prix et absence de fabrication | À faire — dépend du lot 2 |
| 4 | Confidentialité, limites d'usage, coûts et robustesse du parcours complet | Claude Code | Codex : contrôles techniques et limites documentées | À faire |
| 5 | Pilote 100 utilisateurs et analyse des résultats | Porteur + Claude Code | Codex : qualité des mesures et bilan des anomalies | À faire — dépend des lots 1 à 4 |
| 6 | Jeu avec références documentées, puis défis par lien | Claude Code | Codex : scoring, cohérence et équité des manches | À faire — après validation du socle |
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

Journal — 2026-09-17, Claude Code : D1-D3 corrigés (prix source négatif rejeté, validation d'image par décodage structurel réel via `image-size`, correction manuelle persistée à travers retry/photo suivante) ; 13/13 tests, typecheck et build OK, non-régression confirmée par appel réel. Pas encore commité — prochaine action : commit puis nouvelle revue Codex.

Journal — 2026-09-17, Codex : revue de 22c9cdb terminée, rapport et deux tests ajoutés ; prochain intervenant Claude Code pour D1–D3.
