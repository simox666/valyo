# Valyo — Audit d'accessibilité — 17 novembre 2026

Auteur : Claude, suite de l'audit UX du même jour (dont c'était la limite déclarée). Méthode :
axe-core 4.10.2 (règles WCAG 2.1 A/AA + bonnes pratiques) injecté sur 16 pages clés d'une copie
locale avec données vivantes, ordinateur et mobile, états ouverts compris (composer déplié,
dialogue de relais) ; navigation au clavier scriptée ; contrastes des couleurs du système
calculés (formule WCAG). Résultats bruts : `scratchpad/pw/captures-a11y/resultats.json`.

## Résultat d'ensemble : bon socle

- **9 pages sur 16 sans aucune violation** : accueil (visiteur, membre, mobile), article,
  question résolue, salon en lecture, connexion, recherche, dialogue de relais.
- **Clavier** : lien d'évitement « Aller au contenu » en premier arrêt de tabulation ; ordre
  de tabulation logique (recherche → navigation → contenu) ; le dialogue de relais s'ouvre au
  clavier et Échap le ferme.
- **Couleurs du système toutes conformes AA** : encre/papier 14,6:1 ; soft 8,2:1 ;
  muted 5,3:1 ; accent sur blanc 5,2:1 ; accent sur fond saumon 4,6:1 ; vert « résolue »
  5,0:1. Aucun ajustement de palette nécessaire.
- Déjà en place : `lang`, `aria-live` sur les toasts, `prefers-reduced-motion` respecté,
  libellés sr-only sur les formulaires principaux, `<dialog>` natifs.

## Violations relevées, par gravité

### Critiques (2) — champs sans libellé

1. **Publier : l'entrée de fichier des photos** (`PhotoPicker`) n'a pas de libellé accessible.
2. **Paramètres : les deux entrées de fichier** (photo de profil, bannière), masquées en
   sr-only, n'ont pas non plus de libellé. Un lecteur d'écran annonce « entrée de fichier »
   sans dire laquelle.

### Sérieuses (6)

3. **Fil, encarts « Personnes à suivre » / « Souhaitez la bienvenue »** : le lien-avatar n'a
   pas de nom accessible (lien vide pour un lecteur d'écran, doublon du lien nommé voisin).
   *Reco : `tabIndex={-1} aria-hidden`, comme les autres avatars doublons du site.*
4. **Publier, bandeau orange** : « CONTRIBUER À VALYO » (blanc 70 %) et le sous-titre
   (blanc 80 %) passent sous 4,5:1 sur l'orange. *Reco : blanc 90–100 %.*
5. **Salon : deux petits textes** sous 4,5:1 — le séparateur de date et l'heure des messages
   (`text-neutral-500` sur papier/saumon). *Reco : `text-soft`.*
6. **Profil : le calendrier d'activité défilant** n'est pas atteignable au clavier
   (`overflow-x-auto` sans `tabindex`). *Reco : `tabindex=0` + `aria-label`.*
7. **Profil : les cases « non découvertes » du tableau périodique** (gris à 30 % d'opacité)
   sont sous les seuils — 22 nœuds, d'où l'essentiel du comptage. C'est un état volontairement
   éteint, et l'information existe en texte (« — », niveau, `sr-only`, `title`). *Reco a
   minima : remonter l'opacité vers 45–50 % ; le constat devient cosmétique.*

### Modérées (2)

8. **Messages : la page d'une conversation n'a pas de `<h1>`.** *Reco : le nom du
   correspondant en `h1`.*
9. **Notifications : deux repères `aside` sans étiquettes distinctes** (menu de gauche +
   colonne de droite). *Reco : `aria-label` sur le menu de gauche, partout.*

## Limites

Audit outillé et scripté, sans lecteur d'écran réel (VoiceOver/NVDA) ni testeur en situation
de handicap ; zoom 200 %, Windows High Contrast et daltonisme non testés ; pages
d'administration non couvertes. axe ne détecte qu'environ la moitié des problèmes possibles :
un passage VoiceOver sur les parcours publier/commenter/salon reste recommandé avant une bêta
élargie.

## Statut

**Corrigé et déployé le 17 novembre (soir) sur www.valyo.si.** Les neuf constats sont traités ;
l'audit axe rejoué sur les 16 pages ne relève plus AUCUNE violation. Détail notable : pour les
cases « non découvertes » du profil (constat 7), l'opacité à 45-60 % restait illisible — elles
sont désormais éteintes par le style (bordure pointillée, gris conforme AA à pleine opacité),
ce qui garde l'intention visuelle ET la lisibilité. Les entrées de fichier sont libellées, le
calendrier d'activité est atteignable au clavier, chaque conversation a un titre, le menu de
gauche est un repère étiqueté. 187/187 tests. Reste recommandé avant bêta élargie : un passage
VoiceOver réel sur publier/commenter/salon (hors outillage).
