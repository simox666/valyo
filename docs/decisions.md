# Valyo — Décisions de mise en œuvre

Complète [specifications-fonctionnelles.md](specifications-fonctionnelles.md), qui reste la référence.
Chaque point porte un statut :

- **Proposé** : recommandation à valider par le porteur du projet. Ne pas coder le comportement concerné avant validation, sauf mention contraire.
- **Validé** : décision prise, applicable.
- **Appliqué** : déjà en place dans le code.

Dernière mise à jour : 12 novembre 2026.

## 0. Décisions — résumé

Le porteur du projet a validé D1 à D7 le 12 novembre 2026. Restent ouverts : le choix du modèle d’IA et le plafond de budget (D3), et la vérification une par une des sources de la liste indicative (D2).

| # | Décision | Recommandation | Bloque |
|---|---|---|---|
| D1 | Public initial (validé) | 30 à 50 personnes invitées, francophones (Belgique, France), curieuses d'IA ; ouverture large ensuite | Lancement, choix des sources |
| D2 | Premières sources éditoriales (validé ; vérification des flux et conditions d’usage à faire) | Sources primaires d'abord (laboratoires, agences, revues), presse ensuite ; liste au §3.1 | Activation de l'agent |
| D3 | Fournisseur d’IA et budget (API Claude et modèle Claude Opus 5.5 validés le 12 novembre 2026, clé détenue par le porteur ; plafond fixé à 20 USD par mois pour la phase de test le 13 novembre 2026) | API Claude, plafond mensuel fixé par le porteur, coupure automatique au plafond | Exécution de l'agent |
| D4 | Règles de l’agent et critères d’acceptation (validé) | §3 | Publication automatique publique |
| D5 | Permissions des salons et sanctions (validé) | §4 | Étapes 3 à 5 |
| D6 | Limites de longueur et de fréquence (validé) | §4.6, déjà appliquées pour l'étape 1 | Étapes 3 à 5 pour le reste |
| D7 | Indicateur de liens entre membres (validé) | §5, appliqué pour les commentaires | — |
| D8 | Format éditorial : récapitulatif et « Développer ce sujet » (rythme, jours, heure et taille validés ; déclenchement des développements encore proposé) | §6 | Contrat de l'agent |

## 1. Livraison progressive — Validé

Ordre : socle communautaire, agent éditorial, salons et chat, vocal, puis préparation au lancement.
La V1 cible inclut le vocal réel. Chaque étape est livrée de bout en bout, avec un scénario de vérification
automatisé (`tests/e2e-smoke.mjs`) et la liste des écarts restants dans le README.

| Étape | État | Dépendances externes |
|---|---|---|
| 1. Socle communautaire | Livrée | PostgreSQL et Resend en production |
| 2. Agent éditorial | Règles validées (D4, D8). Restent : modèle et plafond de budget (D3), vérification des sources une par une (D2), contrat technique de Codex, essai en brouillon | Clé API d'IA, sources autorisées, tâche planifiée |
| 3. Salons et chat | Règles validées (D5, D6). Restent : choix du service temps réel, contrat technique | Service temps réel (à choisir) |
| 4. Vocal | Règles validées (D5). Reste : choix du service audio | Service audio WebRTC (à choisir) |
| 5. Préparation au lancement | — | — |

## 2. Éviter de disperser les premières discussions — Validé le 12 novembre 2026

- **Rôles expliqués à l'écran.** Commentaires : « Réagir à cette publication. » Salons : « Poursuivre la discussion dans le temps, à plusieurs, par écrit ou à voix haute. »
- **Avant de créer un salon depuis une publication,** afficher d'abord les salons publics déjà associés, avec leur activité récente (membres, dernier message), et « Rejoindre » comme action principale. « Créer un autre salon » reste disponible en action secondaire.
- **Création sans publication :** suggérer les salons publics actifs du même thème avant la validation.
- **Annuaire et page de thème :** trier les salons publics par activité des 7 derniers jours, pas par date de création.
- **Sous une publication :** afficher au plus 3 salons associés, puis « Voir tous les salons ».

## 3. Règles de l'agent éditorial — Validé le 12 novembre 2026 (D2, D4)

Aucune publication automatique publique avant la validation de ces règles et le passage des critères du §3.6.

### 3.1 Sources autorisées et priorité

Liste indicative à valider. La disponibilité d'un flux RSS ou d'une API, et les conditions d'usage de chaque source, restent à vérifier une par une.

| Priorité | Type | Exemples | Usage |
|---|---|---|---|
| 1 | Source primaire | Blogs officiels des laboratoires d'IA, NASA, ESA, CNRS, Inria, communiqués d'universités | Publiable seule, attribuée à son émetteur |
| 2 | Publication scientifique | Revues à comité de lecture, prépublications (arXiv) | Statut « prépublication non relue » affiché si non publiée |
| 3 | Presse spécialisée | Médias tech et science reconnus, francophones en priorité | Publiable si la source primaire est inaccessible, en le disant |

Une annonce commerciale ou un communiqué reste attribué à son émetteur et n'est jamais présenté comme une confirmation indépendante.

### 3.2 Fraîcheur

- Élément collecté ignoré s'il date de plus de 72 heures, ou de plus de 7 jours pour une publication scientifique.
- Date absente ou incohérente : « À examiner », jamais de date inventée.

### 3.3 Regroupement d'une même annonce

Deux éléments décrivent la même annonce si l'une des conditions suivantes est remplie :
1. même URL normalisée (règle déjà appliquée aux publications des membres) ;
2. même lien vers le document primaire ;
3. même émetteur, même objet (produit, mission, article) et dates à moins de 72 heures d'écart, confirmé par une comparaison des contenus.

Le groupe est publié une seule fois, avec la source la mieux classée en principal et les autres en complément.
Une annonce déjà publiée par un membre n'est jamais republiée par l'agent : elle est enregistrée comme doublon (F08).

### 3.4 Motifs de passage en « À examiner »

| Code | Motif |
|---|---|
| `origine_absente` | Pas d'URL ou d'émetteur identifiable |
| `source_inaccessible` | Document primaire et secondaires inaccessibles |
| `date_manquante` | Date absente ou incohérente |
| `resume_non_etaye` | Une affirmation du résumé ne se retrouve pas dans le document consulté |
| `contradiction` | Deux sources se contredisent sur un point clé |
| `statut_incertain` | Impossible de dire s'il s'agit d'une annonce, d'une prépublication ou d'un résultat publié |
| `doublon_incertain` | Regroupement douteux avec une publication existante |
| `instructions_suspectes` | La page contient des instructions destinées à un agent (traitées comme du contenu non fiable) |

### 3.5 Quota

Tout quota est un plafond, jamais un objectif. Une période sans élément qui satisfait les règles ne produit
aucune publication. Depuis D8 (§6), le quota de 5 publications par jour est remplacé par le format
« récapitulatif + développements » : son plafond est le nombre de nouvelles par récapitulatif et de développements.

### 3.6 Essai en brouillon et critères d'acceptation

Avant activation publique, le pipeline tourne en mode brouillon sur au moins 40 éléments réels, répartis
sur les thèmes actifs et incluant volontairement des cas difficiles : doublons, communiqués, prépublications,
sources inaccessibles, informations contradictoires. Chaque résumé est relu par une personne. Les résultats
sont documentés dans `docs/essais-agent/`.

| Critère | Seuil d'acceptation |
|---|---|
| Lien, chiffre, citation ou date inventés | 0 |
| Sources des publications proposées accessibles et correspondant au résumé | 100 % |
| Résumés jugés fidèles par le relecteur | au moins 90 % ; les autres corrigés ou bloqués |
| Doublons non détectés | au plus 1 sur l'échantillon |
| Cas insuffisants ou contradictoires placés en « À examiner » | 100 % |
| Annonces commerciales présentées comme confirmées | 0 |

Un seuil manqué impose une correction puis un nouvel essai complet.

## 4. Permissions et sanctions — Validé le 12 novembre 2026 (D5, D6)

Tous ces contrôles s'appliquent côté serveur, à chaque requête **et aux connexions déjà ouvertes**
(chat en temps réel et vocal) : jetons d'accès de courte durée (5 minutes au plus), revérifiés au
renouvellement, et déconnexion forcée côté serveur lors d'une sanction.

### 4.1 Départ du propriétaire et transfert

- Le propriétaire ne peut pas quitter son salon ni supprimer son compte sans l'avoir transféré à un membre qui accepte, ou archivé (spécification F02).
- Le transfert est une proposition : il prend effet quand le destinataire l'accepte, et expire au bout de 7 jours.
- Si le propriétaire est banni de la plateforme, la propriété passe au modérateur du salon le plus ancien ; sans modérateur, le salon est archivé et l'équipe de modération en est informée.
- Une simple suspension ne transfère rien : les modérateurs du salon continuent d'agir.

### 4.2 Exclusion et bannissement d'un salon

| | Exclusion | Bannissement |
|---|---|---|
| Effet immédiat | Retrait du salon, du chat et du vocal | Idem |
| Retour dans un salon public | Possible après 24 heures | Impossible tant que le bannissement est actif |
| Retour dans un salon privé | Nouvelle invitation nécessaire | Aucune invitation ne fonctionne |
| Durée | Ponctuelle | 7 jours, 30 jours ou sans limite ; levée possible par le propriétaire ou un modérateur |

### 4.3 Suspension de compte

- Effet immédiat : toute contribution refusée (déjà appliqué à l'étape 1), sessions vocales coupées côté serveur, connexions temps réel fermées.
- Lecture du contenu public toujours possible ; durée affichée au membre avec le motif.
- Le bannissement de plateforme ferme en plus toutes les sessions et empêche la connexion.

### 4.4 Contexte privé lors d'un signalement

- Le modérateur de plateforme voit le message signalé, plus au maximum les 10 messages précédents et suivants, dans une fenêtre de 30 minutes.
- Aucun accès au reste de l'historique ni à la liste complète des membres d'un salon privé.
- Chaque consultation est journalisée : qui, quand, quel signalement.
- Pour un signalement vocal : salon, participant et horaire seulement, aucun audio.

### 4.5 Contestation d'une sanction

- Une contestation par sanction, dans les 14 jours, depuis la notification de décision.
- Examinée par une autre personne que l'auteur de la sanction quand c'est possible ; réponse motivée et tracée.
- La sanction reste active pendant l'examen.

### 4.6 Limites de longueur et de fréquence

Les valeurs marquées « Appliqué » sont en place. Les autres seront appliquées aux étapes concernées. Toutes sont configurables.

| Élément | Longueur | Fréquence | État |
|---|---|---|---|
| Demande de lien de connexion | — | 5 par adresse et par heure | Appliqué |
| Publication | titre 5–200, texte 10 000, 5 sources, 3 thèmes | 10 par heure | Appliqué |
| Commentaire | 5 000 | 60 par heure | Appliqué |
| Présentation de profil | 280 | — | Appliqué |
| Message de chat | 2 000 | 20 par minute et par salon | Étape 3 |
| Création de salon | nom 3–60, description 280 | 5 par jour | Étape 3 |
| Invitation | — | 20 par jour et par salon | Étape 3 |
| Signalement | précision 1 000 | 20 par jour | Étape 5 |

## 5. Indicateur de liens entre membres — Appliqué pour les commentaires (D7)

**Membres reliés et revenus.** Parmi les membres ayant terminé leur inscription une semaine donnée :

- **Relié** : dans les 7 jours suivant l'inscription, le membre a échangé avec une autre personne. Il a répondu à un autre membre, ou un autre membre lui a répondu (réponse à son commentaire, ou commentaire sur sa publication).
- **Revenu** : il a été actif (page consultée en étant connecté, ou contribution) entre le 8e et le 14e jour.
- **Indicateur** : part des nouveaux membres à la fois reliés et revenus. Les reliés et les revenus sont aussi affichés séparément.

Les échanges avec le compte de l'agent éditorial ne comptent pas : commenter une publication de l'agent ne relie à personne, sauf si un autre humain répond. Les messages de chat compteront aussi dès l'étape 3.

Le calcul est agrégé et ne lit aucun contenu. L'activité est enregistrée sous la forme d'un jour actif par membre. Les résultats sont consultables dans `/admin/indicateurs`, réservé aux administrateurs (variable `ADMIN_EMAILS`).

## 6. Format éditorial : le récapitulatif et « Développer ce sujet » — D8

Origine : le rituel hebdomadaire du porteur du projet, qui demande à Claude un résumé des dernières
nouvelles scientifiques et technologiques, puis choisit un sujet à développer. Valyo en fait un rituel partagé.
Ce format remplace la publication automatique au fil de l'eau (spécification F07 et F09 : 5 publications par jour).
Toutes les règles de vérification du §3 s'appliquent sans changement.

**Validé le 12 novembre 2026 :**
- **Rythme : trois récapitulatifs par semaine.**
- Le récapitulatif est une publication de l'agent qui liste les nouvelles retenues depuis le précédent, chacune en quelques lignes avec sa source et son statut (annonce, prépublication, résultat publié).
- Sous chaque nouvelle, un bouton « Développer ce sujet ». Un développement est un article de l'agent, sourcé, publié comme une publication normale (commentaires, salons), lié au récapitulatif d'origine.
- Le tri n'est pas urgent : il passe par le traitement par lots de l'API, moins cher.

**Validé le 14 novembre 2026 (« on fait comme ça » du porteur) :**
- **Jours et heure :** lundi, mercredi et vendredi à 7 h, heure de Bruxelles.
- **Taille :** au plus 8 nouvelles par récapitulatif. Comme pour le quota du §3.5, c'est un plafond : moins de nouvelles si moins d'éléments satisfont les règles.
- **Préparation :** 24 heures avant chaque créneau. Politique technique correspondante : `{"slots":[{"weekday":1,"time":"07:00"},{"weekday":3,"time":"07:00"},{"weekday":5,"time":"07:00"}],"maxItems":8,"prepLeadHours":24}`.
- **Essai réel de l'agent** autorisé par le porteur (protocole `protocole-premier-essai-claude.md`, 3 requêtes au plus, base dédiée).

**Proposé, à valider :**
- **Déclenchement d'un développement :** tout membre inscrit peut demander, une demande par membre et par sujet. Les sujets les plus demandés sont développés en premier, au plus 3 développements par récapitulatif. Le compteur de demandes est visible.
- **Publications à l'unité de l'agent :** aucune entre deux récapitulatifs. Seuls les récapitulatifs et les développements sont publiés, pour concentrer les discussions et maîtriser le coût.

## 6 bis. Priorité à l’interface et aux parcours — D9 validé le 13 novembre 2026

Suivi du 14 novembre : UI1 implémenté en C014. Le porteur demande de clôturer cette
session Codex et de transmettre à Claude pour poursuivre par des résultats plus visibles.
Le périmètre D9 reste inchangé ; les limites de recette sont consignées dans
`docs/transmission-claude-c014.md`, sans bloquer les parties indépendantes de la suite.

Instruction ultérieure du porteur, le même jour : Claude étant indisponible, Codex reprend
le développement et se concentre sur une évolution palpable et visible ; les autres
tests seront poursuivis plus tard. Cette instruction remplace la reprise par Claude
annoncée ci-dessus pour cette session. UI2 livré en C015, décrit dans
`docs/interface-c015.md`, avec vérifications limitées au typage, au rendu des pages et
à une observation de l’annuaire. Le périmètre produit et les contrôles serveur sont conservés.

Suite C016 : le porteur accepte le parcours « Publier » proposé (types explicites,
formulaire adapté, aperçu complet avant envoi, accès au contenu et au salon associé),
puis demande de terminer et de redonner la main à Claude. Livraison et transmission
dans `docs/transmission-claude-c016.md`. L’assistance IA, les brouillons persistés et
les activations publiques/payantes ne sont pas ajoutés à ce lot.

Le porteur confirme le prochain lot : navigation claire vers les fonctions existantes ; accueil valorisant actualités, salons actifs et discussions ; parcours « lire → discuter → rejoindre un salon » ; chat plus complet et agréable ; vérification au navigateur avec captures avant/après. Les corrections de confidentialité restent prioritaires.

Le cadrage d’implémentation est dans `lot-interface-parcours.md`. Cette validation ne modifie pas les choix D8 encore proposés et n’ajoute pas de messagerie privée. Développement confié à Claude, recette indépendante à Codex.

## 7. Choix produit restant ouverts

- Plafond mensuel (D3) : **20 USD par mois pour la phase de test**, décidé par le porteur le 13 novembre 2026 ; à revoir avant l'ouverture. Il doit être saisi dans la console Valyo par un administrateur pour être appliqué. Fournisseur Claude et modèle `claude-opus-5-5` validés ; clé API chez le porteur, jamais consignée. Tout essai réel reste soumis à l'acceptation du lot 2B par Codex et à son protocole d'essai minimal.
- Vérification une par une de la disponibilité et des conditions d'usage des sources indicatives (D2).
- Jours, taille et règles de déclenchement du format éditorial (D8, partie proposée).
- Nom et domaine définitifs, identité de l'exploitant, règles de communauté et politique de confidentialité définitives, accès des mineurs, responsable humain de la modération (spécification §15).
