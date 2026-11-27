# Shorts quotidiens de Valyo

Chaque matin, cet automate fabrique une vidéo verticale de 35 à 45 secondes, « Les 3 news science et IA du jour »,
et te l'envoie par e-mail avec le titre et la description à coller dans YouTube. **Rien n'est publié automatiquement** :
c'est toi qui publies, depuis l'application YouTube.

## Ce qui se passe, dans l'ordre

1. **Le site choisit trois articles** de presse des dernières 24 heures (ceux qui ont le plus fait réagir, un thème
   différent par article, jamais un article déjà utilisé, pas de publicité).
2. **Claude Haiku écrit le script** : une accroche, trois phrases reformulées, une question de débat. L'appel final
   « Rejoins le débat sur valyo.si », le `#Shorts` du titre et la description avec les sources sont ajoutés par le code.
3. **La voix de synthèse** (celle du site) lit chaque phrase.
4. **L'automate monte la vidéo** : couleurs et polices du site, une carte par news, sous-titres, écran final.
   Aucune image d'article n'est utilisée.
5. **Le site t'envoie la vidéo par e-mail**, à l'adresse des administrateurs (`ADMIN_EMAILS`).

Les clés d'IA et de voix restent sur le serveur du site. L'automate ne connaît qu'un jeton, `VALYO_SHORTS_TOKEN`.

Coût par vidéo : moins de 3 centimes (script et voix). GitHub Actions est gratuit à ce volume.

## Mise en route sur GitHub (à faire une fois)

1. Ouvre le dépôt sur github.com, puis **Settings > Secrets and variables > Actions > New repository secret**.
2. Nom : `VALYO_SHORTS_TOKEN`. Valeur : celle de la variable du même nom sur Railway
   (service web > Variables), ou celle du fichier `automation/shorts/.env` sur ta machine.
3. Le fichier `.github/workflows/short-quotidien.yml` doit se trouver sur la **branche par défaut** du dépôt :
   GitHub ne lance les tâches planifiées que depuis elle.
4. Onglet **Actions > Short quotidien > Run workflow** : laisse « Essai » coché et lance. La vidéo d'essai se
   télécharge ensuite en bas de la page du lancement (« Artifacts »). Rien n'est envoyé ni enregistré.
5. Relance en décochant « Essai » : tu reçois le mail. Ensuite, la tâche tourne seule tous les matins à 5 h 30 UTC.

Pour arrêter : onglet **Actions > Short quotidien > « … » > Disable workflow**.

## Publier la vidéo reçue

Dans l'application YouTube : **+ > Importer une vidéo**, choisis la pièce jointe, colle le titre et la description
du mail, et réponds **oui** à « Contenu modifié ou synthétique » (la voix est une voix de synthèse).
Si la vidéo ne te convient pas, ne fais rien.

## Essayer sur ta machine

Depuis le dossier `automation/shorts`, dans un terminal :

```bash
python3 -m venv .venv                      # crée un environnement Python isolé dans ce dossier (une seule fois)
./.venv/bin/pip install -r requirements.txt   # installe Pillow (images) et un FFmpeg embarqué (vidéo)
cp .env.example .env                       # puis ouvre .env et colle la valeur du jeton

./.venv/bin/python -m valyo_shorts.main --plan exemple-plan.json --voix muette
# essai hors ligne : aucune connexion, aucun coût, vidéo muette dans le dossier out/

./.venv/bin/python -m valyo_shorts.main --dry-run
# essai réel : articles du jour, script et voix (environ 2 centimes), rien d'envoyé ni d'enregistré

./.venv/bin/python -m valyo_shorts.main
# le Short du jour, envoyé par e-mail et noté comme fait (relancer le même jour renvoie la même vidéo)

./.venv/bin/python -m unittest discover -s tests
# les tests de l'automate, sans réseau
```

## Réglages (variables sur Railway, service web)

| Variable | Rôle | Par défaut |
|---|---|---|
| `VALYO_SHORTS_TOKEN` | Jeton partagé avec l'automate. Le vider coupe tout accès. | — |
| `VALYO_SHORTS_MODELE` | Modèle qui écrit le script | `claude-haiku-5-5` |
| `VALYO_SHORTS_VOIX` | Voix OpenAI utilisée pour les Shorts | celle du site (`marin`) |

## Limites connues

- **Sous-titres** : le service de voix ne donne pas l'instant de chaque mot ; le minutage est estimé à partir de la
  longueur des mots. Il peut se décaler d'une fraction de seconde sur une phrase longue.
- **Pas d'envoi automatique sur YouTube** : une vidéo envoyée par l'API depuis un projet Google non audité reste
  bloquée en privé. À rebrancher après un audit de conformité de Google.
- **S'il n'y a pas trois articles récents inutilisés**, il n'y a pas de Short ce jour-là : la tâche échoue avec un
  message clair, et GitHub t'envoie son mail d'échec habituel.

## Où est le code

- Côté site : `lib/shorts/` (choix des articles, script, journal) et `app/api/shorts/` (trois points d'entrée protégés).
- Automate : `automation/shorts/valyo_shorts/` — `client.py` (appels au site), `audio.py` (bande-son),
  `subtitles.py`, `design.py` (mise en page), `video.py` (rendu), `main.py`.
