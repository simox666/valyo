# Valyo — Spécifications fonctionnelles

Version 1.0 · 12 novembre 2026 · Document de référence pour un agent de développement

## 1. Objet et statut du document

Concevoir un réseau social francophone consacré aux nouvelles technologiques et scientifiques. Les utilisateurs viennent découvrir des nouvelles, en discuter et, lorsqu’une démonstration existe, essayer les outils présentés. Ils peuvent poursuivre leurs échanges dans des salons thématiques en chat et en vocal.

La priorité est l’acquisition et la fidélisation des utilisateurs. La monétisation sera étudiée ultérieurement. **Valyo est un nom de travail** ; l’utilisation du domaine `valyo.si` reste à confirmer avant publication.

Ce document décrit le comportement attendu, pas une architecture imposée. Il peut être transmis directement à un agent de développement. Le livrable attendu est une application fonctionnelle, avec données persistantes et échanges réels, et non une reproduction des simulations de la maquette.

### 1.1 Décisions exprimées par le porteur du projet

- Réseau social de niche autour de l’IA, des nouvelles technologies et des sciences.
- Suivre les nouvelles, en discuter et tester si possible.
- Nouvelles gérées par un agent éditorial automatisé.
- Publication de nouvelles également ouverte aux membres.
- Création de salons par les membres, autour d’un sujet ou depuis une publication.
- Discussions de groupe par écrit et oralement.
- Croissance de la communauté avant monétisation.

### 1.2 Choix proposés pour rendre la V1 réalisable

Les choix suivants sont les valeurs par défaut de cette spécification. Ils sont modifiables et ne doivent pas être présentés comme des exigences déjà validées individuellement par le porteur du projet.

- Interface française, accessible sur ordinateur et mobile par navigateur.
- Consultation des publications publiques sans compte ; compte nécessaire pour contribuer.
- Salons publics ou sur invitation ; chat permanent et vocal facultatif.
- Publications publiques en V1 ; confidentialité gérée au niveau des salons.
- Suivi de thèmes, de membres et de salons ; notifications internes.
- Source requise pour une actualité ; facultative pour une question ou un retour d’expérience.
- Aucun paiement, abonnement payant, prix en argent ou publicité dans la V1.
- IA, robotique et espace comme premiers thèmes configurables, sans limiter le réseau à ces sujets.

## 2. Résultat recherché et périmètre

### 2.1 Promesse utilisateur

« Découvrir les avancées qui m’intéressent, comprendre ce qu’elles changent et retrouver des personnes avec qui en parler ou les essayer. »

### 2.2 Parcours central

1. Un visiteur découvre une publication publique depuis un lien partagé.
2. Il consulte son résumé, sa source et les commentaires.
3. Il crée un compte pour commenter, suivre un sujet ou rejoindre un salon.
4. Il rejoint un salon existant ou en crée un depuis la publication.
5. Il échange dans le chat et peut rejoindre le vocal du même salon.
6. Il suit le salon et retrouve les réponses à son retour.

### 2.3 Fonctionnalités incluses dans la V1

| Domaine | Fonctionnalités attendues |
|---|---|
| Comptes | Inscription, connexion, récupération d’accès, profil, déconnexion, suppression du compte |
| Actualités | Collecte automatisée, sélection, sources, publication, correction et détection des doublons |
| Contributions | Actualités de membres, questions et retours d’expérience |
| Discussions | Commentaires, réponses et partage par lien |
| Découverte | Fil, thèmes, recherche de publications, de membres et de salons publics |
| Salons | Création autonome ou depuis une publication, accès public ou sur invitation, gestion des membres |
| Chat | Messages persistants, réception en temps réel, modification et suppression de ses messages |
| Vocal | Connexion audio réelle, participants présents, micro, sortie et modération |
| Fidélisation | Suivis, éléments non lus et notifications internes |
| Sécurité communautaire | Signalement, blocage, modération et sanctions |
| Administration | Gestion des thèmes, des sources, de l’agent, des contenus et des comptes |

### 2.4 Hors périmètre de la V1

- Messagerie privée entre personnes, application mobile native.
- Vidéo, partage d’écran, enregistrement ou transcription du vocal.
- Rencontres programmées, calendrier et rappels d’événements.
- Newsletter, notifications push, gamification, classements et badges de réputation.
- Paiements, sponsorisation, abonnements payants et récompenses financières.
- Hébergement et exécution de modèles d’IA ou de démonstrations externes dans la plateforme.
- Agents qui simulent des membres ou répondent automatiquement au nom des utilisateurs.
- Personnalisation par apprentissage automatique ; un classement explicable suffit au lancement.

## 3. Acteurs et permissions

| Acteur | Droits |
|---|---|
| Visiteur | Lire publications et commentaires publics, consulter profils publics et salons publics sans lire leur chat |
| Membre | Publier, commenter, suivre, signaler, bloquer, créer un salon et rejoindre les salons autorisés |
| Propriétaire de salon | Modifier son salon, gérer invitations et rôles, exclure ou bannir un participant, archiver le salon |
| Modérateur de salon | Modérer messages et participants du salon ; aucun droit de changer le propriétaire ou de supprimer le salon |
| Modérateur de plateforme | Traiter les signalements accessibles, modérer contenus publics et comptes ; accès aux salons privés limité au contenu signalé et au contexte nécessaire |
| Administrateur | Gérer configuration, sources, agent, comptes et incidents ; accès exceptionnel aux contenus privés tracé |
| Agent éditorial | Publier et corriger ses propres contenus selon les règles éditoriales ; aucun pouvoir de sanction sur les membres |

Un utilisateur ne peut modifier que ses propres contributions, sauf action explicite de modération. Une exclusion d’un salon interdit le chat et le vocal de ce salon. Une suspension de plateforme interdit toute contribution et toute nouvelle connexion au vocal.

## 4. Comptes, profils et premiers pas

### F01 — Inscription et connexion

- Inscription par adresse e-mail avec vérification de sa possession ; le mécanisme exact de connexion relève de l’implémentation.
- Choix d’un pseudonyme unique, d’un nom affiché et acceptation des règles de communauté.
- Après inscription, sélection facultative de centres d’intérêt ; l’étape peut être ignorée.
- Une action nécessitant un compte propose de se connecter puis ramène à la publication ou au salon concerné.
- Un refus d’accès ne doit jamais être contournable par l’URL directe.

### F02 — Profil et préférences

- Profil public : pseudonyme, nom affiché, avatar facultatif, courte présentation, thèmes et publications publiques.
- L’adresse e-mail n’est jamais affichée publiquement.
- Les salons privés, appartenances privées et notifications ne sont pas visibles sur le profil public.
- Le membre peut suivre un autre membre, gérer ses thèmes et ses préférences de notification.
- Suppression du compte : confirmation explicite, fermeture des sessions, retrait du profil et anonymisation des contributions conservées pour la continuité des discussions. La politique de conservation doit être affichée avant confirmation.
- Un propriétaire doit transférer ses salons ou les archiver avant de supprimer son compte. Les règles finales de conservation des données et les mentions applicables sont à valider avant mise en production.

## 5. Fil, découverte et publications

### F03 — Fil d’actualités

- Le fil mélange les publications de l’agent et des membres, avec une distinction visible de l’auteur.
- Deux vues : « Pour vous » et « Récentes ». « Récentes » suit strictement la date de publication.
- « Pour vous » privilégie les thèmes et auteurs suivis, puis complète avec les publications publiques récentes. À ancienneté comparable, les échanges de plusieurs membres distincts peuvent départager les résultats.
- En l’absence de préférences, afficher le fil général récent. Ne jamais afficher un écran vide uniquement parce que le membre ne suit personne.
- Exclure les contenus retirés, les auteurs bloqués et les contenus non autorisés.
- Filtrage par thème, chargement progressif et conservation de la position lors du retour depuis une publication.

### F04 — Publier en tant que membre

Trois types de contribution :

| Type | Champs obligatoires | Champs facultatifs |
|---|---|---|
| Actualité | Titre, texte ou résumé, au moins une URL source, au moins un thème | URL de démonstration |
| Question | Titre, texte, au moins un thème | Sources |
| Retour d’expérience | Titre, texte, au moins un thème | Sources, URL de l’outil testé |

- Publication immédiate après les contrôles de validité et d’abus ; une alerte de modération peut mettre la contribution en attente avec un statut expliqué à son auteur.
- L’agent peut proposer un résumé à la demande du membre. Ce brouillon reste modifiable et n’est publié qu’après action du membre. Cette assistance est facultative pour publier.
- Une actualité portant sur une URL déjà partagée affiche la publication existante et propose de rejoindre sa discussion. Le membre peut maintenir sa publication si elle apporte un autre point de vue ; aucune fusion automatique de ses propos.
- Possibilité de modifier et de supprimer sa contribution. Une modification significative affiche « Modifié » avec sa date.
- Après suppression, la page affiche un état indisponible. Les salons associés demeurent accessibles à leurs membres ; le contenu supprimé n’y est pas recopié.

### F05 — Lire et discuter

- Chaque publication possède une URL stable, partageable et consultable selon ses droits.
- Afficher auteur, type, date, thèmes, texte, sources et éventuelle date de modification.
- Les contenus automatisés portent la mention « Agent éditorial ». Ne pas les attribuer à une personne fictive.
- Les sources ouvrent leur page d’origine ; le bouton « Tester » apparaît uniquement si une URL de démonstration est fournie. Préciser qu’il mène vers un service externe ; afficher les restrictions connues sans inventer la gratuité ou l’accessibilité.
- Commentaires et réponses avec un seul niveau d’imbrication en V1.
- L’auteur peut modifier ou supprimer son commentaire ; les réponses à un commentaire supprimé restent lisibles sous la mention « Commentaire supprimé ».
- Sous la publication : salons publics associés, bouton « Rejoindre » et bouton « Créer un salon ». Les salons privés n’apparaissent qu’aux utilisateurs déjà autorisés.
- Action « Copier le lien » avec confirmation et solution de repli si le navigateur refuse l’accès au presse-papiers.

### F06 — Recherche

- Rechercher par texte dans les titres et textes publics, les thèmes, les noms de salons publics et les profils publics.
- Séparer les résultats par type ; afficher un état sans résultat et permettre d’effacer la recherche.
- Ne jamais exposer le nom, les extraits ou les messages d’un salon privé à un membre non autorisé.

## 6. Agent éditorial automatisé

### F07 — Fonctionnement attendu

L’agent gère une veille régulière et publie automatiquement les éléments qui satisfont la politique éditoriale. La V1 ne doit pas exiger une validation humaine systématique de chaque nouvelle.

1. **Collecter** les nouveaux éléments de sources activées et autorisées par l’administrateur.
2. **Normaliser** URL, date, auteur, langue et origine ; conserver la référence exacte du document consulté.
3. **Regrouper** les éléments portant sur une même annonce ; contrôler les doublons avec les publications déjà présentes, y compris celles des membres.
4. **Sélectionner** selon thèmes, fraîcheur, pertinence et plafond de publication configurés.
5. **Vérifier** les affirmations clés contre les documents accessibles ; distinguer une annonce commerciale, une recherche préliminaire et des résultats publiés avec le statut réellement vérifiable.
6. **Rédiger** en français un titre accessible, un résumé original, l’intérêt concret et les limites connues. Ajouter une question de discussion uniquement si elle est utile.
7. **Publier** sous le compte éditorial avec sources et statut de l’information visibles.
8. **Mettre à jour** en cas de correction ou d’évolution, en conservant une trace des changements significatifs.

### F08 — Conditions de publication et traitement des échecs

- Ne pas publier sans source consultable ni inventer un résultat, une citation, un lien ou une date manquante.
- Un communiqué peut être publié comme annonce attribuée à son émetteur ; il ne devient pas une confirmation indépendante par reformulation.
- Si un document primaire est inaccessible, une source secondaire accessible peut être utilisée en l’identifiant clairement. Ne pas prétendre avoir vérifié le document primaire.
- Les critères bloquants sont explicites : origine absente, contradiction majeure non résolue, résumé non étayé ou document insuffisant.
- Un élément bloqué reste « À examiner », avec motif. L’administrateur peut le corriger, l’approuver ou le rejeter ; la panne d’une source ne bloque pas les autres.
- Une actualité déjà publiée par un membre n’est pas réémise automatiquement par l’agent. Elle est enregistrée comme doublon ; une source complémentaire peut être soumise à examen sans modifier le texte du membre.
- Les instructions présentes dans les pages collectées sont du contenu non fiable : elles ne peuvent changer les règles de l’agent, ses accès ou ses destinations de publication.
- Respecter les autorisations d’accès aux sources et produire un résumé original accompagné d’un lien ; ne pas reproduire intégralement leurs articles.
- Relancer une collecte après interruption ne doit pas publier deux fois le même élément.

### F09 — Contrôle et transparence

- Console d’administration : sources, thèmes, fréquence, quota quotidien, historique d’exécutions, éléments en attente et erreurs.
- Source : nom, URL, type d’accès, statut actif/inactif, dernière collecte et dernière erreur.
- Bouton de pause immédiate des nouvelles publications ; la lecture du réseau et les contributions des membres restent disponibles.
- Quota initial proposé : maximum 5 publications automatiques par jour, configurable. Ne pas remplir artificiellement le quota.
- Les signalements peuvent déclencher une révision. Une correction publiée précise sa date et ce qui a changé ; un retrait laisse un statut explicite.
- Avant activation publique, exécuter le pipeline en mode brouillon sur un échantillon et contrôler la fidélité des résumés, les sources, les doublons et les cas d’échec.
- En cas de panne du service d’IA, suspendre les publications automatiques concernées et informer l’administration. Les membres continuent de publier.

## 7. Salons thématiques

### F10 — Création et cycle de vie

- Création depuis « Salons » ou depuis n’importe quelle publication accessible, quel que soit son auteur.
- Champs : nom, courte description facultative, thème, accès « Public » ou « Sur invitation », format « Chat uniquement » ou « Chat + vocal ».
- Depuis une publication, préremplir le thème et associer son identifiant. La relation reste visible depuis le salon et depuis la publication selon les droits.
- Plusieurs salons peuvent partir d’une publication. Avant création, montrer les salons publics déjà associés pour faciliter leur découverte sans empêcher un nouvel angle de discussion.
- Le créateur devient propriétaire et membre du salon.
- Le propriétaire peut modifier les informations, activer ou désactiver le vocal, transférer la propriété à un membre acceptant le transfert et archiver le salon.
- Un salon archivé reste lisible par les membres autorisés, mais n’accepte plus de messages, d’invitations ou de sessions vocales.
- En V1, le niveau public/privé est fixé à la création pour éviter de rendre involontairement publics des échanges privés.

### F11 — Accès, invitations et découverte

- Salon public : titre et description visibles publiquement ; un membre connecté peut le rejoindre et accéder à l’historique.
- Salon privé : seuls les membres autorisés accèdent au salon, à ses messages et à son vocal.
- Invitation : lien révocable et à durée limitée, créé par le propriétaire ou un modérateur autorisé. À l’ouverture, connexion requise puis acceptation explicite de l’invitation.
- Valeur par défaut proposée : invitation valable 7 jours, à usage unique. Le propriétaire peut en émettre une nouvelle.
- Une invitation expirée, utilisée ou révoquée ne donne aucun accès. Une personne bannie ne peut pas revenir par une autre invitation tant que le bannissement reste actif.
- Quitter un salon privé retire l’accès à son historique et coupe le vocal. Revenir exige une nouvelle invitation.
- L’annuaire met en avant les salons publics ; les salons privés du membre apparaissent uniquement dans « Mes salons ».
- « Suivre » contrôle les notifications ; rejoindre un salon et le suivre sont deux actions distinctes. Le créateur suit son salon par défaut.

### F12 — Chat de groupe

- Messages textuels persistants, avec auteur et heure, reçus sans recharger la page.
- URLs cliquables ; fichiers joints et import d’images hors périmètre de la V1.
- Afficher les états envoi en cours, envoyé et échec ; une relance ne crée pas de doublon.
- Après reconnexion, récupérer les messages manqués et conserver un repère des non-lus.
- Modification et suppression par l’auteur ; retrait par un modérateur avec motif enregistré.
- L’historique se charge progressivement. Les membres autorisés peuvent lire les messages antérieurs à leur arrivée.
- Ne pas afficher une présence, un participant ou un message simulé dans l’application livrée.

### F13 — Vocal de groupe

- Le vocal appartient au salon et partage exactement ses droits d’accès.
- Rejoindre et quitter sont des actions explicites ; le chat reste utilisable en parallèle.
- Demander l’accès au microphone seulement à la demande de l’utilisateur. Micro coupé à l’entrée par défaut.
- Afficher les participants connectés, l’état de leur micro et l’indication de prise de parole lorsque disponible.
- En cas de permission refusée, proposer l’écoute seule si disponible, expliquer comment réessayer et laisser le chat accessible.
- Prévoir les états connexion, connecté, reconnexion et échec. Une déconnexion ne doit pas laisser une présence active indéfiniment.
- Un modérateur peut couper le micro ou expulser un participant du vocal. Après coupure imposée, le participant ne peut le réactiver qu’après restitution du droit de parole. Le modérateur ne peut jamais activer à distance le micro d’autrui.
- Une exclusion du salon ou suspension de compte coupe immédiatement la session vocale concernée et retire l’accès au chat.
- Une session se ferme lorsque le dernier participant quitte. Aucun enregistrement ni transcription en V1.
- Capacité initiale proposée : 12 participants connectés simultanément par salon, configurable. Si la limite est atteinte, afficher « Vocal complet » ; le chat demeure disponible.

## 8. Notifications, blocage et modération

### F14 — Notifications internes

- Déclencheurs : réponse à un commentaire, nouveau message dans un salon suivi, démarrage d’un vocal dans un salon suivi et décision de modération concernant le membre.
- Regrouper les messages d’un même salon en une notification avec compteur ; ne pas notifier ses propres actions.
- Lien direct vers la conversation et marquage lu/non lu. Éviter de notifier un message déjà consulté dans la conversation active.
- Préférences : couper les notifications d’un salon ou les notifications vocales ; possibilité de tout marquer comme lu.
- Une perte d’accès retire le contenu privé des notifications et interdit l’ouverture de l’ancienne destination.

### F15 — Signalement et blocage

- Signaler une publication, un commentaire, un message, un salon ou un participant vocal, avec motif et précision facultative.
- Un signalement vocal contient le salon, le participant et l’heure, sans prétendre fournir une preuve audio.
- Bloquer un membre masque ses publications et commentaires dans les espaces publics et empêche ses invitations vers le bloqueur.
- Le blocage n’expulse pas une personne d’un salon partagé. Signaler clairement cette limite avant confirmation ; les protections du salon relèvent de ses modérateurs. Ne pas promettre un filtrage individuel de la voix en V1.
- Protéger les contributions et invitations contre le spam par des limites configurables, avec message explicite en cas de dépassement.

### F16 — Traitement de modération

- File de signalements : motif, contenu concerné, date, historique utile et statut.
- Actions : classer sans suite, retirer un contenu, avertir, exclure d’un salon, suspendre temporairement ou bannir de la plateforme selon le rôle.
- Enregistrer qui a agi, quand et pourquoi ; informer la personne concernée sans divulguer l’identité du signalant.
- Pour les salons privés, l’accès de modération porte sur le contenu signalé et le contexte strictement nécessaire, pas sur une exposition générale des conversations.
- Les décisions de sanction relèvent d’un humain autorisé ; l’agent éditorial n’applique pas de sanctions.

## 9. Écrans et états attendus

| Écran | Contenu et actions principales |
|---|---|
| Fil | Publications, vues Pour vous/Récentes, filtres, accès à la rédaction |
| Publication | Contenu, sources, commentaires, partage, salons associés, création de salon |
| Rédaction | Type, titre, texte, sources, thèmes, aperçu et validation |
| Découverte | Thèmes et recherche de contenus, membres et salons publics |
| Profil | Présentation, publications publiques, suivi, signalement et blocage |
| Annuaire des salons | Salons publics, mes salons et création |
| Création de salon | Nom, thème, description, accès, format et éventuelle publication d’origine |
| Salon | Contexte, chat, vocal éventuel, participants, suivi et gestion selon les droits |
| Notifications | Activité regroupée, lu/non lu, accès aux conversations |
| Paramètres | Compte, thèmes suivis, préférences, blocages et suppression |
| Administration | Agent, sources, thèmes, modération et état des services |

Chaque écran doit prévoir chargement, absence de contenu, erreur récupérable et refus d’accès. Les formulaires conservent la saisie lors d’une erreur récupérable et indiquent précisément le champ à corriger. Les actions destructrices ou de transfert demandent une confirmation explicite.

## 10. Données fonctionnelles à conserver

Cette liste définit les informations métier, pas un schéma de base de données imposé.

| Objet | Informations essentielles |
|---|---|
| Membre | Identifiant, pseudonyme, profil public, contact privé, statut, préférences, dates |
| Thème | Identifiant, nom, description et statut actif |
| Publication | Auteur humain/agent, type, titre, texte, thèmes, sources, statut, dates et révisions |
| Source éditoriale | Origine autorisée, configuration d’accès, statut et résultats de collecte |
| Élément de veille | Documents consultés, références, doublons, statut, motif de blocage, publication résultante |
| Commentaire | Auteur, publication, parent éventuel, texte, statut et dates |
| Salon | Propriétaire, thème, publication d’origine facultative, accès, format, statut |
| Appartenance | Membre, salon, rôle, état d’accès, suivi et dernier message lu |
| Invitation | Salon, émetteur, expiration, utilisation et révocation |
| Message | Salon, auteur, contenu, identifiant d’envoi, dates et statut |
| Session vocale | Salon, participants, droits de parole et état de connexion ; aucun contenu audio conservé |
| Suivi/blocage | Utilisateur concerné, cible, type et date |
| Notification | Destinataire, événement, cible, compteur et état de lecture |
| Signalement/action | Signalant, cible, motif, traitement, responsable et dates |

Toutes les autorisations doivent être contrôlées lors de la lecture et de l’écriture, ainsi que pour les connexions temps réel et vocales. Masquer un bouton ne suffit pas à protéger une donnée.

## 11. Qualité et exploitation

- Interface utilisable à partir de 320 px de largeur, au clavier et avec des libellés accessibles ; ne pas dépendre uniquement d’une couleur pour expliquer un état.
- Dates stockées de manière cohérente et affichées dans le fuseau du visiteur ; interface en français.
- Données de démonstration séparées des données réelles et identifiées comme telles.
- Secrets et identifiants de services absents de l’interface publique et des journaux accessibles aux membres.
- Chargement des liens sources et des aperçus protégé contre l’accès aux ressources internes ; contenu des membres affiché sans exécuter du code fourni par eux.
- Une panne du vocal ne doit pas empêcher le chat ; une panne de l’agent ne doit pas empêcher les contributions humaines.
- Prévoir sauvegarde et restauration des données, surveillance des erreurs et contrôle des coûts des services d’IA et d’audio.
- Objectifs provisoires de recette : messages reçus dans les 2 secondes et entrée dans un vocal en moins de 5 secondes sur une connexion stable, hors délai d’autorisation du microphone. Documenter les conditions de mesure et les limites constatées.
- Vérifier avant lancement un scénario de 100 utilisateurs connectés, dont 12 dans un même vocal. Il s’agit d’une cible de test initiale, pas d’une promesse de capacité maximale.

## 12. Mesure de l’usage

Mesurer de façon agrégée, sans copier le contenu des conversations dans les statistiques :

- Visites de publications publiques et inscriptions depuis ces pages.
- Passage inscription → première contribution ou premier salon rejoint.
- Utilisateurs actifs hebdomadaires et retour des nouveaux inscrits à 7 et 28 jours.
- Membres ayant publié, commenté ou envoyé un message ; proportion de publications recevant une réponse d’un autre membre.
- Salons actifs, participation aux vocaux et réutilisation des salons.
- Répartition des publications agent/membres, corrections éditoriales et signalements.

Définition initiale d’un utilisateur actif : membre ayant consulté une publication ou un salon, ou effectué une contribution durant la période. Distinguer l’activité de lecture de l’activité de contribution. Aucun volume d’inscriptions ne suffit seul à démontrer la fidélisation.

## 13. Critères de recette prioritaires

Les vérifications ci-dessous doivent être effectuées sur des comptes distincts lorsque le scénario l’exige. Les contrôles d’accès doivent aussi être testés par accès direct, et pas uniquement depuis l’interface.

| ID | Scénario | Résultat attendu |
|---|---|---|
| R01 | Un visiteur ouvre un lien de publication | Il lit le contenu public ; commenter nécessite une connexion avec retour au contexte |
| R02 | Un membre publie une actualité valide | Elle persiste après rechargement, apparaît dans le fil et reste attribuée au membre |
| R03 | Un membre pose une question sans source | La publication est autorisée ; une actualité sans source est refusée avec explication |
| R04 | Une URL déjà publiée est proposée | Le doublon est signalé et le membre peut consulter la discussion existante |
| R05 | L’agent traite une source exploitable | Il publie automatiquement avec origine, date disponible et identification de l’agent |
| R06 | La source ne permet pas d’étayer le résumé | L’élément reste à examiner et n’est pas publié automatiquement |
| R07 | Une collecte est relancée ou tombe sur une publication membre existante | Aucun doublon automatique n’est créé et le contenu membre reste intact |
| R08 | L’administration met l’agent en pause | Aucune nouvelle publication automatique ne paraît ; le reste du réseau fonctionne |
| R09 | Un membre crée un salon depuis une publication humaine ou de l’agent | Le lien fonctionne dans les deux sens selon les droits ; le créateur est propriétaire |
| R10 | Un membre crée un salon sans publication | Le salon fonctionne sans référence d’origine artificielle |
| R11 | Un non-membre tente d’ouvrir un salon privé | Ni messages, ni participants, ni vocal ne sont accessibles, y compris par accès direct |
| R12 | Une invitation expire ou est révoquée | Elle ne permet plus de rejoindre le salon et affiche un état compréhensible |
| R13 | Deux membres échangent dans un salon | Les messages arrivent en temps réel, persistent et restent uniques après reconnexion |
| R14 | Deux membres rejoignent un vocal avec deux appareils | L’audio est réel ; micro initialement coupé, activation et sortie fonctionnent |
| R15 | Un membre refuse le microphone ou le vocal tombe en panne | L’état est expliqué ; le chat reste utilisable |
| R16 | Le plafond vocal est atteint | Le participant supplémentaire voit le refus et peut continuer dans le chat |
| R17 | Un modérateur coupe le micro ou exclut un participant | Les droits sont appliqués immédiatement et la reconnexion ne contourne pas la décision |
| R18 | Une contribution est signalée puis retirée | Le traitement et son motif sont tracés ; le signalant reste confidentiel |
| R19 | Un membre perd l’accès à un salon privé | Les anciennes notifications et connexions ne lui donnent plus accès au contenu |
| R20 | Un propriétaire archive son salon | L’historique autorisé reste consultable ; chat, invitations et vocal sont fermés |
| R21 | Un membre supprime une publication liée à un salon | Le contenu n’est plus affiché ; le salon reste utilisable avec origine indisponible |
| R22 | Un membre supprime son compte | Sessions fermées, profil retiré, propriété des salons résolue et contributions traitées selon la politique affichée |
| R23 | Une page collectée contient des instructions malveillantes | Elles ne modifient pas le comportement ni les permissions de l’agent |
| R24 | Utilisation sur mobile et au clavier | Les parcours principaux sont réalisables sans débordement ni contrôle inaccessible |

## 14. Ordre conseillé de réalisation

1. **Socle communautaire** : comptes, profils, thèmes, publications, commentaires et fil public.
2. **Agent éditorial** : collecte en brouillon, contrôle qualité, dédoublonnage, console et activation automatique maîtrisée.
3. **Salons et chat** : liens aux publications, invitations, rôles, messages persistants et temps réel.
4. **Vocal réel** : accès, présence, micro, modération et gestion des erreurs.
5. **Préparation au lancement** : recherche, notifications, modération transversale, statistiques, accessibilité et recette complète.

Les permissions et protections des données sont intégrées à chaque étape. Le vocal appartient à la V1 cible ; il ne doit pas être remplacé silencieusement par une simulation.

## 15. Consignes de livraison à l’agent de développement

- Utiliser ce document comme référence fonctionnelle et signaler les contradictions avant de développer le comportement concerné.
- Examiner le dépôt fourni et ses instructions avant de choisir l’architecture. Aucun dépôt existant ni aucune pile technique ne sont imposés ici ; ne pas réutiliser le précédent projet de valorisation d’objets sans instruction.
- Formaliser brièvement les choix d’authentification, stockage, temps réel, audio et exécution de l’agent, avec leurs dépendances et coûts prévisibles.
- Implémenter les parcours de bout en bout. Un bouton principal visible doit fonctionner ; les fonctions indisponibles doivent être indiquées explicitement.
- Distinguer données fictives, environnement de test et production. Ne jamais présenter un chat simulé ou une présence inventée comme un service réel.
- Livrer instructions de démarrage, configuration des services, migrations éventuelles, données de démonstration séparées, procédure de lancement et résultats de recette.
- Fournir une liste précise des écarts à cette spécification, des limites connues et des fonctionnalités réellement opérationnelles.
- L’absence d’un identifiant de service externe doit être documentée ; elle ne justifie pas d’annoncer une intégration réelle comme terminée.

### Points à confirmer avant mise en production

Nom et domaine définitifs ; identité de l’exploitant ; premières sources autorisées ; budget mensuel maximal ; fournisseurs de services ; règles de communauté ; politique de confidentialité et de conservation ; conditions d’accès des mineurs ; responsable humain de la modération.

Ces points n’empêchent pas de construire et tester la V1 avec des paramètres de développement clairement identifiés. Ils conditionnent sa configuration publique définitive.
