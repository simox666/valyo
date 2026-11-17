# Transmission à Claude — C016

14 novembre 2026. Le porteur demande de terminer le parcours « Publier », puis de te
redonner la main. Les tests approfondis restent reportés. Cette transmission est le
point de reprise actuel ; C014 et C015 sont l’historique, pas des lots à recommencer.

## Livré

- Page `/publier` élargie avec introduction, trois cartes de choix du type et conseils adaptés.
- Formulaire commun création/édition : libellés et exemples selon le type, compteurs de caractères, thèmes 1 à 3, sources jusqu’à 5, lien de test hors question. Type figé en édition.
- Étapes Rédiger → Relire l’aperçu → Publier. Le schéma de validation existant est réutilisé avant l’aperçu ; les contrôles serveur restent inchangés. Erreurs associées aux champs et récapitulatif avec focus.
- Aperçu complet : type, auteur, titre, texte, thèmes, sources et lien Tester. Retour à la rédaction sans perdre la saisie. Pas d’envoi au clic sur « Voir l’aperçu » ; envoi explicite par « Publier maintenant ».
- Doublon : publications existantes proposées et confirmation explicite conservée. Les erreurs après confirmation reviennent au formulaire/aperçu sans effacer le contenu. Verrou client contre les envois simultanés.
- Après création réussie : confirmation, Voir ma publication, Partager le lien et Créer un salon sur ce sujet. Le lien utilise `/salons/nouveau?post=:id`, qui associe déjà la publication et préremplit son thème. En édition, retour à la publication après enregistrement.

Le formulaire existait déjà : C016 en améliore le parcours et l’aperçu. Ce lot n’ajoute
ni assistance IA ni sauvegarde persistante des brouillons. La saisie reste en mémoire
durant le parcours, pas après fermeture/rechargement de l’onglet.

## Fichiers et préservation

- `components/PostForm.tsx` : parcours et interface communs.
- Nouveau `components/PostPreview.tsx` : rendu de relecture, liens http(s) contrôlés.
- `app/publier/page.tsx` et `app/p/[id]/modifier/page.tsx` : mise en page et nom affiché de l’auteur.
- README, décisions D9, état du lot C011 et journal C016 actualisés.

Aucun fichier serveur métier, route API, migration, dépendance ou variable modifié.
Les sources C010/C013, UI1/C014 et UI2/C015 sont conservées. L’arbre Git reste largement
non suivi, avec suppressions indexées de l’ancienne application : ne pas nettoyer/reset.
Aucun commit ni changement d’index. Sauvegarde avant C016 :
`/private/tmp/valyo-c016-avant-2oi8tlj6`.

## Aperçu à essayer

- [Publier](http://localhost:3217/publier)
- [Modifier la publication fictive](http://localhost:3217/p/e6e9f504-6232-4bd4-bbbf-072e912eab19/modifier)
- [Salons C015](http://localhost:3217/salons)

Connexion locale : `demo_c014_mwgmvekk_0@example.test`, puis suivre le lien de
développement affiché à l’écran. Compte fictif existant, aucun e-mail réel envoyé.
L’aperçu tourne dans `/private/tmp/valyo-c014-apres-iuvc_7vm`, base distincte `demo-db`,
port 3217 ; les quatre fichiers applicatifs C016 y sont synchronisés. Ce dossier est
temporaire : les sources durables sont dans le dépôt. Le port 3000, son `.next`, les
secrets et la base courante sont préservés.

## Contrôles et limites

- `npm run typecheck` et `git diff --check` réussis.
- Contrôles HTTP ciblés réussis : rendu 200 et contenu attendu de `/publier`, de la page
  de modification et de la création de salon depuis la publication fictive ; redirection
  307 du visiteur vers la connexion avec retour `/publier`.
- Ces contrôles n’ont créé ni modifié aucune publication. Le script ponctuel est conservé
  dans `/private/tmp/valyo-c016-render.mjs`, sans jeton incorporé.
- La tentative de navigateur natif n’a pas permis de garder la fenêtre d’aperçu ciblée.
  Arrêt de cette tentative sans prolonger la recette ni agir sur une page personnelle.
  Pas de capture C016 ni de parcours création/confirmation déclaré vérifié dans le navigateur.
- Suites complètes et build non relancés ; les 152/152 tests C014 restent historiques.
  Mobile/clavier, interactions et erreurs réseau/doublons restent à exercer ultérieurement.
  Les limites PostgreSQL/charge/fournisseur des transmissions antérieures restent ouvertes.

## Reprise attendue

Commencer par lire `docs/coordination-agents.md`, la présente transmission et
`docs/interface-c015.md`. Faire essayer le parcours visible et corriger tout défaut
concret constaté. Pour un contrôle ciblé, suivre : type → champs/thèmes → aperçu → retour
sans perte → envoi dans la base fictive → confirmation → publication/salon ; vérifier aussi
une source déjà partagée et l’édition au type figé. Ne pas lancer un nouvel audit général
par défaut : le porteur souhaite poursuivre des fonctionnalités visibles.

La prochaine fonctionnalité au-delà de ce lot reste à choisir avec le porteur.
Conserver les restrictions sur PM, vocal réel, publication éditoriale publique et API
payantes. Cette note ne lance pas automatiquement ton outil.
