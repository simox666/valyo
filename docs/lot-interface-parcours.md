# Lot interface et parcours — mission Claude

13 novembre 2026. Cadrage Codex, demandé et validé dans son intention par le porteur. Ce lot complète C010 ; il ne remplace pas les corrections ACC01–ACC09.

**État au 14 novembre — reprise Codex demandée après C014 :** UI1 implémenté en C014.
La tranche UI2 C015 apporte l’annuaire filtrable et les salons personnels avec non-lus,
la page salon centrée sur le chat et une boîte de notifications filtrable avec lecture
individuelle. Voir [interface-c015.md](interface-c015.md) pour l’aperçu et les fichiers.
Le porteur demande de différer les autres tests : TypeScript et rendu des trois pages
contrôlés, capture ordinateur de l’annuaire ; recette complète, mobile et clavier encore dues.

**Complément C016 autorisé ensuite :** parcours de rédaction guidé, aperçu complet et
confirmation après publication implémentés. Passage à Claude demandé après cette livraison ;
voir [transmission-claude-c016.md](transmission-claude-c016.md). Les limites de recette
ci-dessus restent ouvertes.

## Résultat attendu

Une évolution visible et utilisable de l’accueil, de la navigation, de la lecture d’une publication et du chat. Un membre doit immédiatement comprendre où trouver les nouvelles, les personnes qui en discutent et ses propres conversations. Chaque livraison doit être démontrable dans le navigateur.

Priorités validées : navigation claire ; accueil valorisant actualités, salons actifs et discussions ; parcours « lire → discuter → rejoindre un salon » ; chat plus complet et agréable ; recette navigateur avec captures avant/après. Les corrections de confidentialité restent prioritaires. La messagerie individuelle, le vrai vocal et une activation éditoriale publique ne sont pas ajoutés par cette demande.

Les choix de mise en page ci-dessous sont le cadrage d’implémentation de Codex. Conserver l’identité et les couleurs actuelles en les structurant mieux ; une refonte de marque n’est pas nécessaire. Ne pas installer un nouveau framework d’interface pour ce lot.

## Ordre de travail et transmission

1. Capturer les écrans existants sur une base de démonstration séparée, avant modification. Consigner URL, rôle du compte et largeur. Ces captures constituent le point de comparaison réel.
2. Fermer les défauts de confidentialité et de cohérence C010 sur les parcours concernés. Navigation et composants visuels indépendants peuvent avancer pendant les corrections ; ne pas valider un chat privé avant les régressions corrigées.
3. Livrer une première tranche visible : navigation + accueil + lecture d’une publication. La transmettre dans le journal, puis continuer salons/chat sans attendre une revue de chaque écran.
4. Livrer salons + chat + notifications utilisables ; exécuter la recette et fournir captures après dans les mêmes conditions.

Les fonctions indisponibles doivent afficher un état honnête. Ne pas présenter une série de cartes et boutons sans parcours fonctionnel comme une livraison terminée.

## 1. Navigation compréhensible

- Donner une place stable à **Accueil**, **Salons**, **Recherche** et, pour les comptes connectés, **Notifications** avec compteur exact. Mettre en évidence la destination courante.
- Garder une action principale **Publier**. Réunir profil, paramètres, sanctions personnelles et déconnexion dans un menu de compte accessible au clavier. L’administration reste réservée aux personnes autorisées.
- Sur mobile, proposer une navigation compacte qui permet d’atteindre les mêmes fonctions sans plusieurs lignes de liens serrés. Si un menu est utilisé : nom accessible, état ouvert annoncé, focus maîtrisé et fermeture clavier.
- Utiliser **Salons / Discussions de groupe** de façon explicite. Aucun libellé « Messages » ne doit laisser croire qu’une messagerie privée existe.
- Garder un chemin de retour vers la publication ou le salon après connexion. Aucun lien principal ne mène vers un écran non opérationnel sans explication.

## 2. Accueil qui montre la vie de Valyo

Sur ordinateur, proposer une zone principale de lecture et une zone secondaire pour la communauté, avec une largeur globale permettant de respirer. La colonne de texte reste lisible. Sur mobile, remettre les mêmes blocs dans un ordre utile, sans défilement horizontal.

**Zone de lecture :**
- Titre et présentation courts ; éviter un grand bloc d’introduction qui repousse le contenu. Pour un membre connecté, montrer directement ce qu’il peut lire et retrouver.
- Préserver « Pour vous / Récentes », thèmes, pagination, position au retour et règles de classement. « Récentes » reste strictement chronologique.
- Améliorer les cartes : hiérarchie titre/résumé, thème, type, auteur humain/agent, source identifiable, date et nombre de commentaires réel. Distinguer un récapitulatif de l’agent sans le faire passer pour une publication humaine.
- Proposer des actions explicites **Lire et discuter** et, si des salons autorisés existent, un accès à ceux-ci. Éviter plusieurs actions concurrentes de même poids.

**Zone communauté :**
- **Salons publics actifs** : trois à cinq salons, thème, activité persistée récente, nombre de membres et lien clair. Réutiliser le tri par activité des sept derniers jours ; aucun message privé ni participant « en ligne » inventé.
- **Mes discussions**, pour le membre : ses salons avec indicateur exact de nouveaux messages et dernière activité. Les salons privés apparaissent exclusivement à leur membre autorisé ; leur contenu ne doit pas être mis en cache pour un autre utilisateur.
- Une mise en avant de **Discussions récentes** peut utiliser des publications publiques ayant reçu des commentaires ; les libellés et comptes correspondent à des données réelles. Pas de nouveau classement par apprentissage automatique.

Une base vide reste explicite : proposer lire les thèmes, publier ou créer un salon. Les démonstrations enrichies sont séparées et clairement identifiées ; ne pas peupler la base courante de faux membres pour remplir l’accueil. N’afficher un récapitulatif éditorial que s’il a été réellement publié selon ses règles ; la pause de l’agent n’est pas cachée par un faux article.

## 3. Publication : lire, réagir, approfondir ensemble

- Présenter clairement titre, résumé/texte, auteur, sources, statut scientifique lorsqu’il existe et restrictions connues du lien Tester.
- Organiser les actions par intention : **Commenter** pour réagir ici, **Rejoindre un salon** pour poursuivre une discussion de groupe, **Partager** pour le lien.
- Montrer les salons publics associés et les privés autorisés, leur thème et activité. **Rejoindre** est prioritaire ; **Créer un autre salon** reste disponible.
- Si aucun salon n’existe : le dire et proposer **Créer un salon sur ce sujet**. Préremplir le thème et conserver le lien à la publication.
- Après adhésion, amener au chat de ce salon ; si déjà membre, afficher **Ouvrir la discussion**. Retour vers la publication d’origine clairement accessible.
- Conserver les réponses de commentaires à un niveau, l’état d’un contenu supprimé, le blocage et les boutons de signalement selon les droits.

## 4. Salons : rendre l’échange immédiatement accessible

- Séparer visuellement **Mes salons** et **Découvrir des salons**. Proposer des cartes lisibles avec public/privé, thème, description et activité réelle.
- Éviter un annuaire apparemment vide lorsque tous les salons publics affichés appartiennent déjà au membre : message adapté ou liste conservant les salons avec l’état « Membre ».
- Sur un salon public visité sans adhésion, expliquer en une phrase comment accéder à la discussion et afficher l’action de connexion/adhésion appropriée.
- Dans le salon : titre et contexte compacts, publication d’origine lorsqu’elle est disponible, chat au premier plan. Mettre membres, invitation, suivi et gestion dans des espaces secondaires accessibles ; ne pas obliger à parcourir la liste des membres avant d’écrire.
- Salons archivés, exclusion et perte d’accès ont un état clair, sans zone de saisie encore active ni contenu privé nouvellement reçu.

## 5. Chat complet et agréable

Ce travail reprend et complète ACC06/ACC07 ; ne pas créer un second composant de chat concurrent.

- Composer multiligne : Entrée pour envoyer, Maj+Entrée pour un saut de ligne, envoi bloqué pendant la composition IME ; bouton Envoyer utilisable au clavier et au toucher. Limite de 2 000 caractères annoncée, compteur utile près de la limite.
- Afficher auteur, date/heure, séparateurs de jours, regroupement raisonnable et état modifié. Éviter d’afficher chaque message comme une grande carte isolée.
- Proposer **Modifier**, **Supprimer**, **Signaler** et le retrait de modération selon les droits. Préserver le brouillon et montrer les erreurs au bon endroit. Confirmer les actions destructrices conformément aux spécifications.
- Rendre les URL http(s) cliquables avec attributs de sécurité ; ne jamais exécuter du HTML ou du code de membre.
- Charger les messages précédents au-delà de 50, en conservant l’ancrage du défilement. Pas de remontée brutale lors d’une insertion ou d’une modification.
- Suivre le bas de la conversation uniquement si la personne le suivait déjà. Sinon, afficher **N nouveaux messages** avec accès au bas ; ne pas voler la position de lecture.
- Marquer lu uniquement lorsque le salon est effectivement consulté, dans un onglet visible et avec les messages concernés affichés ; pas parce qu’un événement arrive en arrière-plan. Réessayer proprement un échec d’enregistrement du repère.
- Garder les états connexion/reconnexion/échec/envoi et la relance idempotente. La resynchronisation doit reprendre avec un curseur valide, sans boucle. Aucun faux statut de présence ou de frappe.
- À la révocation des droits : arrêter l’envoi et le flux, retirer les éléments privés d’interface qui ne sont plus autorisés, expliquer l’état sans révéler d’autres données privées.

## 6. Notifications et écrans utiles à la continuité

- Rendre les notifications lisibles par type : réponses, activité de salon, décision de modération avec motif et destination adaptée (ACC09).
- Distinguer nouveaux éléments et éléments lus ; accès direct à la conversation concernée, commande de lecture appropriée et compteur cohérent.
- Dans paramètres, rendre retrouvables les thèmes suivis, les blocages, les préférences effectivement implémentées et les sanctions personnelles.
- Aucun réglage fictif ni promesse de notification vocale avant la livraison du vocal réel.

## 7. Critères de livraison et preuves

Tester avec des comptes de visiteur, membre et administrateur, ainsi qu’un membre sans accès à un salon privé. Utiliser une base dédiée comportant des données de démonstration explicites : publications, commentaires, salons publics/privés, plus de 50 messages et une décision de modération. Conserver aussi un scénario de base vide.

| Parcours | Résultat observable |
|---|---|
| Arriver sur l’accueil | Actualités et accès aux discussions compréhensibles sans chercher dans l’administration |
| Lire → commenter → rejoindre | Parcours complet, retour au contexte après connexion, salon ouvert sur son chat |
| Retrouver son salon | Accès depuis accueil/navigation et non-lus exacts |
| Écrire/modifier/recharger le chat | Messages persistants, modification visible, aucun doublon |
| Lire d’anciens messages pendant de nouvelles arrivées | Historique accessible, position stable, indicateur de nouveaux messages |
| Quitter/perdre l’accès à un salon privé | Plus aucun nouveau message privé ; interface et notifications cohérentes |
| Naviguer au clavier et sur mobile | Focus visible, actions accessibles, aucune information essentielle hors écran |

**Captures réelles** dans `docs/recette-interface/` : avant et après pour accueil, publication et salon/chat ; ordinateur (par exemple 1440 × 900), mobile 390 px et vérification de la largeur 320 px. Capturer les mêmes données et le même rôle pour comparer. Documenter le navigateur et les dimensions ; fournir un index Markdown avec les images. Ne pas utiliser de maquettes générées comme preuve de navigateur.

Les captures attestent l’apparence ; joindre les résultats des parcours au clavier et des interactions. Si l’outil de navigateur est indisponible, livrer l’implémentation et signaler la recette manquante, sans annoncer la validation visuelle ; continuer les autres travaux utiles.

**Validation technique :** TypeScript, tests pertinents, régressions Codex C010, build et scénarios HTTP ; puis recette navigateur des parcours modifiés. Ne pas faire tourner simultanément build et dev sur le même `.next`. Garder le site local de présentation sur le bon port, avec migrations appliquées, et indiquer les URL concrètes à essayer. Aucun secret dans les captures ou rapports.

## Transmission attendue

Livraisons UI1 (accueil/navigation/publication), puis UI2 (salons/chat/notifications), puis preuves de recette. Pour chaque livraison : changements visibles, URL à ouvrir, captures disponibles, parcours vérifiés, tests et limites. Claude développe ; Codex effectue la contre-recette. Le porteur évalue l’expérience visible ; pas d’activation publique automatique.
