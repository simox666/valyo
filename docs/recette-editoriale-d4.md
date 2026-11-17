# Recette éditoriale D4 — grille de lecture des 40 éléments

Préparée le 13 novembre 2026 (lot d'accélération, tâche A4). Statut : **prête, non exécutée**.

Cette grille organise la recette humaine exigée par `docs/decisions.md` §3.6 avant toute
activation publique : le pipeline tourne en mode brouillon sur **au moins 40 éléments réels**
et **chaque résumé est relu par une personne**. **Aucune fixture, aucun contrôle automatique
et aucune autoévaluation par un modèle ne remplace cette lecture humaine de documents réels.**
Les fixtures et vérifications automatisées ne servent qu'à préparer le terrain : si elles
passent, la recette humaine reste entièrement due.

## 1. Conditions préalables

- Essai technique minimal réussi (protocole `docs/protocole-premier-essai-claude.md`).
- Sources vérifiées et activées une par une (D2, voir `docs/sources-editoriales-d2.md`).
- Budget D3 en place (20 USD/mois en phase de test) ; la recette des 40 éléments consommera
  une partie de ce budget : estimer le coût AVANT de lancer (aperçu de la console, bornes par requête).
- Mode brouillon obligatoire pendant toute la recette ; aucune publication publique.

## 2. Composition de l'échantillon (40 éléments au minimum)

Répartition visée, à ajuster selon l'actualité réelle — on ne force jamais un cas en
fabriquant un document :

| Catégorie | Cible | Pourquoi |
|---|---|---|
| Répartis sur les thèmes actifs (IA, robotique, espace) | ≥ 8 par thème | Couverture des domaines annoncés |
| Sources primaires (priorité 1) | ≈ 20 | Voie nominale |
| Publications scientifiques dont prépublications | ≥ 6 | Statut « prépublication non relue » à contrôler |
| Presse spécialisée | ≥ 4 | Attribution et accessibilité de la source primaire |
| **Cas difficiles, dont :** | ≥ 10 | C'est là que l'agent échoue ou doit se bloquer |
| — doublons (même annonce, plusieurs sources) | ≥ 3 | Regroupement règles 1 à 3, `doublon_incertain` |
| — communiqués commerciaux | ≥ 2 | Jamais présentés comme confirmation indépendante |
| — prépublications non relues | ≥ 2 | Statut affiché correctement |
| — source primaire inaccessible | ≥ 2 | Repli presse « en le disant », ou blocage |
| — informations contradictoires | ≥ 1 | Motif `contradiction` attendu |

Les marqueurs de fixtures (`[[fixture:…]]`, voir `lib/editorial/providers/test.ts`) simulent
ces familles de cas pour les tests automatisés ; ils ne comptent **pas** dans les 40 éléments.

## 3. Grille de lecture — une ligne par élément

À remplir dans `docs/essais-agent/recette-d4-<date>.md` (copier ce tableau). Le relecteur
ouvre chaque source citée et compare mot à mot.

| # | Date | Thème | Source(s) | Statut affiché | L1 | L2 | L3 | L4 | L5 | Verdict | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|

Colonnes de lecture (oui / non + note libre) :

- **L1 — Rien d'inventé.** Aucun lien, chiffre, citation, date ou nom absent des documents consultés.
- **L2 — Sources accessibles et correspondantes.** Chaque source citée s'ouvre et décrit bien ce que le résumé affirme.
- **L3 — Fidélité.** Le résumé ne déforme pas : pas d'exagération, de généralisation ni de certitude ajoutée.
- **L4 — Statut exact.** Annonce / prépublication non relue / résultat publié : conforme au document.
- **L5 — Regroupement et motifs.** Doublons regroupés ou signalés `doublon_incertain` ; cas bloqués avec le bon motif §3.4.

**Verdict** : `fidèle` / `corrigé` (révision A7 avec motif) / `bloqué` (examen justifié) / `défaillant` (erreur passée inaperçue des garde-fous).

## 4. Critères d'acceptation (decisions.md §3.6 — inchangés)

| Critère | Seuil |
|---|---|
| Lien, chiffre, citation ou date inventés (L1 = non) | **0** |
| Sources accessibles et correspondant au résumé (L2) | **100 %** |
| Résumés jugés fidèles (L3 et L4) | **≥ 90 %**, les autres corrigés ou bloqués |

Un élément correctement **bloqué** par l'agent (examen avec motif juste) compte comme un
comportement attendu, pas comme un échec. Un élément `défaillant` au-delà des seuils reporte
l'activation : correction, puis **nouvelle recette complète** sur un nouvel échantillon.

## 5. Traçabilité

- Résultats datés dans `docs/essais-agent/`, sans clé ni identifiant externe de lot.
- Chaque correction passe par la révision éditoriale (motif, historique, vérification invalidée).
- Le verdict final (« recette D4 réussie/échouée le <date>, n/40, écarts ») est consigné dans
  `docs/decisions.md` ; lui seul peut débloquer la discussion d'activation publique.
