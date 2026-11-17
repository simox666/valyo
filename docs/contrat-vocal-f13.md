# Vocal F13 — contrat d'intégration et comparaison des solutions

Préparé le 13 novembre 2026 (lot d'accélération, tâche E42). **Aucun abonnement souscrit,
aucun fournisseur activé** : ce document compare les offres sur leurs pages officielles et
soumet une recommandation à Codex. Sources consultées le 13 novembre 2026 :
[tarifs LiveKit Cloud](https://livekit.com/pricing), [tarifs Daily Video SDK](https://www.daily.co/pricing/video-sdk/),
[CPaaS 8x8 / JaaS](https://cpaas.8x8.com/au/pricing/).

## 1. Contrat d'intégration (exigences non négociables, spec F13 + D5)

1. **Mêmes droits que le salon.** Le jeton d'accès vocal est émis PAR NOTRE SERVEUR,
   depuis `lib/rooms/permissions.ts` : `canReadRoom` → écoute, `canWriteRoom` → parole.
   Aucun jeton côté client, aucune salle devinable (identifiant de salle = identifiant interne signé).
2. **Jetons courts.** Durée de vie ≤ 5 minutes (D5 §4) ; renouvellement par le client via
   notre API, qui revérifie les droits à chaque renouvellement.
3. **Micro coupé à l'entrée.** Publication audio désactivée par défaut ; l'activation est
   un geste explicite de la personne.
4. **Écoute seule.** Un jeton « écoute » sans droit de publication doit exister (membre
   sanctionné en cours d'examen, arrivée pendant une discussion).
5. **Révocation immédiate.** Exclusion/bannissement du salon ou suspension de plateforme →
   éjection côté serveur (API du fournisseur) dans la même action que la sanction, en plus
   de l'expiration courte du jeton. Même mécanique que l'événement `revoke` du chat.
6. **Aucun enregistrement.** Fonctions d'enregistrement/transcription désactivées au niveau
   du projet fournisseur ; vérifié en recette. Signalement vocal : salon, participant,
   horaire seulement (D5 §4.4) — jamais d'audio.
7. **Capacité initiale** : 12 participants simultanés par salon (configurable) ; au-delà,
   « Vocal complet », le chat reste disponible.
8. **Pas de faux vocal** : rien n'est livré tant qu'un fournisseur réel n'est pas branché.

## 2. Comparaison (pages officielles du 13 novembre 2026)

| Critère | LiveKit Cloud | Daily | Jitsi (JaaS / auto-hébergé) |
|---|---|---|---|
| Gratuit | 5 000 min participant/mois, 100 connexions simultanées | 10 000 min/mois | JaaS : plan gratuit annoncé, plafond MAU non publié ; auto-hébergé : gratuit |
| Payant (ordre de grandeur) | Ship 50 $/mois : 150 000 min puis 0,0005 $/min | 0,004 $/min vidéo ; **0,000 99 $/min audio seul** | JaaS : par utilisateur actif mensuel, grille non publique ; auto-hébergé : coût serveur |
| Jetons courts côté serveur | Oui (JWT à TTL, droits par grant) | Oui (meeting tokens à expiration) | Oui (JWT JaaS) / à construire soi-même |
| Écoute seule | Oui (`canPublish: false`) | Oui (permissions du token) | Partiel, selon configuration |
| Éjection côté serveur | Oui (API RemoveParticipant) | Oui (API eject) | Limitée hors JaaS |
| Enregistrement désactivable | Oui (opt-in uniquement) | Oui (opt-in uniquement) | Oui |
| Issue de secours sans fournisseur | **Serveur open source auto-hébergeable (même SDK)** | Non (service propriétaire) | Oui par nature |
| Risque contractuel | Faible : tarifs publics, pas d'engagement | Faible : tarifs publics | JaaS : grille opaque, à demander au commercial |

Écarté : Twilio Video (produit en fin de vie, annoncé par Twilio) ; Agora et Chime
(tarifs comparables à Daily mais sans issue open source, sans avantage décisif ici).

## 3. Ordre de grandeur pour Valyo

Hypothèse haute en phase de test : 4 sessions vocales/semaine × 10 participants × 60 min
≈ **9 600 minutes participant/mois**. C'est sous le palier gratuit de Daily (10 000) et
au-dessus de celui de LiveKit (5 000 ; dépassement au plan Ship : 50 $/mois, excessif pour
la phase de test, OU auto-hébergement gratuit).

## 4. Recommandation soumise à Codex

1. **Premier choix : LiveKit**, pour la seule raison STRUCTURELLE du lot : le serveur est
   open source et le même SDK fonctionne en Cloud et auto-hébergé — aucun enfermement, et
   l'exigence « contrat de droits côté serveur » s'y exprime précisément (grants par jeton).
   En phase de test : plan gratuit (5 000 min) ; si l'usage dépasse, bascule auto-hébergée
   (un petit serveur suffit pour 12 participants audio) plutôt qu'un abonnement.
2. **Second choix : Daily**, si l'on préfère ne rien héberger : palier gratuit plus large
   et tarif audio seul très bas, mais service propriétaire sans issue de secours.
3. **JaaS (8x8)** : écarté tant que la grille par utilisateur actif n'est pas publique.

Prochaine étape (après avis Codex et accord du porteur) : brancher l'émission de jetons
sur `permissions.ts` derrière une capacité désactivée, recette des 8 exigences du §1 sur
un projet de test gratuit, puis seulement l'interface.
