# Revue des corrections R1–R8

Codex, 17 septembre 2026. Revue du dépôt après le second passage de relais Claude Code. Aucun code applicatif modifié, aucune lecture de `.env.local`, aucun appel fournisseur payant. Git toujours absent.

**Verdict : corrections substantielles confirmées, Lot 1 encore en corrections demandées.** La déclaration « les 8 constats corrigés » est trop large.

## Résultats vérifiés

- Les sept tests initiaux passent. Les ajouts de dépendances au harnais par Claude Code n'ont pas changé les assertions initiales.
- `npm run typecheck` réussit.
- Quatre tests supplémentaires ajoutés : un réussi (filtrage analytics), trois échoués. Total : **8 réussites, 3 échecs**, via `node --test tests/audit.test.cjs`.
- Build non relancé pour éviter le conflit `.next` avec le développement local signalé dans le passage de relais. Le build annoncé par Claude reste un résultat rapporté. Lint toujours non configuré selon le dépôt, non réexécuté.
- Aucun test navigateur/mobile dans cette passe. Le premier test iPhone signalé dans le journal est conservé comme essai rapporté, pas comme validation générale.

## Points restant à corriger

### C1 / R1 — P1 : une source sans prix autorise toujours une estimation

`lib/schema.ts`, condition `hasAnyPrice && data.price_sources.length === 0` : une URL HTTP(S) et `price: null` suffisent à faire accepter 100–200 EUR. Reproduit par le nouveau test « a source without any observed price cannot support a valuation ».

Attendu : au minimum une observation chiffrée admissible pour soutenir le montant publié ; validation des montants des sources, cohérence de devise/type et lien entre preuve et résultat. L'architecture reste une recherche puis une extraction LLM, sans calcul distinct ou vérification des preuves. La décision d'utiliser la recherche web pour le pilote ne supprime pas cette exigence. Les prix négatifs/inversés du résultat sont désormais rejetés et c'est acquis.

### C2 / R3 — P1 avant accès externe : un client refusé épuise le quota de tous

`lib/rateLimit.ts`, `checkRateLimit` : le compteur global augmente même quand la limite IP est dépassée. Reproduction hors ligne : 10 demandes autorisées de A, 190 refusées de A, puis première demande de B refusée. Attendu : séparer la protection contre abus et le budget d'analyses admises ; ne pas consommer ce dernier pour des demandes déjà rejetées.

Autres limites toujours ouvertes : compteurs non distribués, aucun plafond en euros ni accès pilote, IP tirée directement de `x-forwarded-for` sans contrat de proxy de confiance, Map sans éviction des IP expirées. Les en-têtes sont contrôlables par le client sur un Node exposé directement. Le stopgap documenté ne suffit donc pas à valider une ouverture publique.

### C3 / R4 — P2 : signature de fichier ne signifie pas image valide

`lib/imageValidation.ts`, `hasJpegMagic` : trois octets `FF D8 FF`, encodés en base64, sont acceptés comme JPEG. Reproduit par « a truncated JPEG signature is not a usable image ». Attendu : contrôle serveur de décodabilité/dimensions avec limites de ressources ; ne pas simplement ajouter un quatrième octet au test de signature. La taille globale du body reste non bornée avant `req.json()`. Null, MIME inconnu et faux base64 simple sont maintenant correctement rejetés.

### C4 / R6 — P2 : correction manuelle toujours absente

`app/scan/page.tsx` : reprise avec conservation des photos, bouton Passer et protection contre réponses périmées ajoutés. Cependant aucun champ de correction ni transmission d'une correction au fournisseur. Attendu : livrer cette fonction du Lot 1 ou obtenir un report produit explicite ; ne pas la compter comme corrigée.

L'annulation au démontage reste absente : le contrôleur est local à `runAnalysis`, et seul le timeout client l'annule. Une navigation peut laisser le traitement se poursuivre. Vérification par lecture seulement, pas de scénario navigateur exécuté.

### C5 / R7 — P2 : le délai serveur n'est toujours pas implémenté dans le pipeline

`app/api/analyze/route.ts` et `lib/vision.ts` : `maxDuration = 120` est une déclaration d'hébergement, pas un timeout du pipeline Node. Aucun signal ou deadline n'est passé aux appels SDK ; l'abandon client à 150 s ne garantit pas l'arrêt des appels facturés. Attendu : délai global serveur et propagation aux appels, stratégie de retry bornée, mesure des phases. Les chiffres de limites de plans Vercel dans les commentaires n'ont pas été vérifiés ici : les vérifier au déploiement selon la configuration réelle.

### C6 / R8 — P2 : message d'erreur fournisseur ni borné ni expurgé

`app/api/analyze/route.ts`, bloc catch : `err.message` est journalisé intégralement malgré le commentaire « bounded, safe ». Passer d'un objet complet au message ne garantit pas l'absence de contenu sensible ou la taille du log. Attendu : liste fermée de catégories/codes avec identifiant de diagnostic, sans message fournisseur brut.

Le filtrage d'événements est confirmé par test ; les aperçus convertis, leur révocation et `ImageBitmap.close()` sont présents à la lecture. Pas de preuve de fuite de données réelle dans cette revue.

## Corrections acquises

R2 : ancien prix conseillé/vente rapide supprimés, prix neuf rendu, libellés qualitatifs et message sans prix ajoutés. R5 : URLs restreintes HTTP(S), test réussi. Attention mineure : une seule borne d'occasion non nulle reste autorisée et affichera une fourchette contenant un tiret ; traiter cet état explicitement.

## Prochain passage de relais

Claude Code : corriger C1–C6 en petits lots, garder les tests de reproduction et documenter les points partiels. Codex : retester les contrats puis ajouter les parcours navigateur de reprise/correction. La sélection des sources (Lot 2) peut continuer conformément à la décision du porteur ; elle ne valide ni la provenance des résultats actuels ni le budget du pilote.
