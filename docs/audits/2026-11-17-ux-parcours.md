# Valyo — Audit UX et fonctionnement des parcours — 17 novembre 2026

Auteur : Claude, à la demande du porteur. Méthode : copie locale isolée du code courant, base
vierge, données vivantes créées par l'API (3 membres, publications, question résolue, relais,
mention, salon avec rendez-vous, messages privés), puis chaque parcours photographié en
ordinateur (1288 px) et mobile (390 px) et chaque capture examinée. 30+ pages couvertes :
visiteur, inscription, premiers pas, fil, article, question, salon, annuaire, messages,
notifications, profil, paramètres, publier, recherche, à creuser, inviter.

## Fonctionnement : rien de cassé

- **0 erreur JavaScript et 0 réponse HTTP ≥ 400** sur l'ensemble des parcours.
- Tous les enchaînements aboutissent : inscription → premiers pas → fil personnalisé ;
  mention → notification ; réponse → meilleure réponse → badge « Résolue » partout ;
  relais → bandeau chez l'abonné ; salon → article d'origine → rendez-vous annoncé ;
  messages privés ; progression (série, palier, découverte) ; recherche.
- L'API du popup « Salons sur ce sujet » répond en ~15 ms (le « Chargement… » d'une capture
  était un artefact du test, vérifié).
- Aucun débordement horizontal en mobile.

## Constats UX, par priorité

**Statut (17 novembre, soir) : P1 et P2 (constats 1 à 6) corrigés, vérifiés au navigateur sur les six comportements, et déployés sur www.valyo.si.** Le P3 (constats 7 à 11) reste ouvert, à reprendre dans un prochain lot de finitions.

### P1 — à traiter en premier

1. **Le fil est dominé par les boutons « Synthèse IA de l'article ».** Chaque carte d'actu
   empile un gros bouton plein orange, un lien source orange et la pastille « Salon » orange :
   dans « Les plus récentes », cinq boutons identiques rythment la page plus fort que les
   titres. Amplifié en mobile (deux CTA orange par carte). *Reco : dans le fil, bouton en
   contour discret ; le plein orange reste sur la page de lecture.*
2. **Preuve sociale en double sur une même carte.** Bandeau « Relayé par Paul » + ligne
   « Parmi vos abonnements, Paul a réagi » : Paul deux fois, deux encarts gris empilés.
   *Reco : quand un bandeau relais est présent, masquer la ligne « Parmi vos abonnements ».*

### P2 — améliorations nettes

3. **Article, visiteur : double état vide des commentaires** (« Connectez-vous pour
   commenter » puis « Aucun commentaire pour l'instant »). *Un seul bloc suffit.*
4. **Recherche : les sections sans résultat s'affichent quand même** (« Aucun membre ne
   correspond », « Aucun thème… »). *N'afficher que les sections avec résultats.*
5. **Profil : « Le meilleur de X » redondant** quand le membre n'a qu'une ou deux
   publications, déjà listées juste dessous. *N'afficher la section qu'à partir de ~3
   contributions remarquées.*
6. **Salon : « Modifier / Supprimer » affichés en permanence** sous chacun de ses propres
   messages. *Les montrer au survol (ordinateur) / à l'appui (mobile).*

### P3 — polissage

7. Cases des thèmes : « Cy » orphelin seul sur une deuxième ligne en ordinateur.
8. Connexion : le bouton « Recevoir le lien » paraît désactivé/délavé avant la saisie ;
   l'état visuel peut faire croire à une panne.
9. Carte de l'annuaire des salons : césure « 2 messages cette / semaine ».
10. « Pour vous » proposé aux visiteurs alors qu'il équivaut aux « plus récentes ».
11. Les mentions @pseudo restent en texte brut dans les extraits des cartes (elles ne
    deviennent des liens que sur la page) — cohérence mineure.

## Points forts confirmés

Premiers pas (checklist 3 étapes, carte « Présentez-vous ») ; états vides qui guident
(Messages mobile propose directement les personnes suivies, « À creuser » explique la loupe) ;
article d'origine en tête de salon ; rendez-vous annoncés dans la discussion ; question
« Résolue » visible du fil à la page ; progression présente sans envahir ; formulaire de
publication en 3 étapes clair ; paramètres complets avec suppression de compte honnête.

## Limites de l'audit

Parcours rejoués en local (dev), pas sur www.valyo.si ; pas d'appel IA réel (boutons synthèse
non cliqués) ; pas de test d'accessibilité outillé (lecteur d'écran, contrastes mesurés) ni de
test utilisateur réel ; e-mails non ouverts (lien de connexion pris via le point de test).
Artefacts de capture à ne pas confondre avec des bugs : images « lazy » grises dans les
captures pleine page, champs profil vides (le script d'audit a utilisé POST au lieu de PATCH
sur /api/me), surcouche « N » de Next en mode dev.

Captures : `scratchpad/pw/captures-ux/` (session Claude du 17 novembre).
