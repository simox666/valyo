"""Appels au site Valyo : préparation du Short, voix, livraison par e-mail.

L'automate ne détient qu'un jeton. Les clés d'IA (script) et de voix restent sur le serveur.
Chaque appel est retenté en cas de panne passagère du réseau ou du serveur.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

RETRIES = 3


class ValyoError(Exception):
    """Refus ou panne côté site, avec le message à montrer tel quel."""


def load_env(path: Path) -> None:
    """Lit un fichier .env simple (CLÉ=valeur) sans écraser ce que l'environnement définit déjà."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def _call(path: str, *, body: bytes, content_type: str, timeout: int = 120) -> bytes:
    base = os.environ.get("VALYO_URL", "https://www.valyo.si").rstrip("/")
    token = os.environ.get("VALYO_SHORTS_TOKEN", "")
    if not token:
        raise ValyoError("VALYO_SHORTS_TOKEN est vide : remplis le fichier .env (voir .env.example).")
    request = urllib.request.Request(
        base + path, data=body, method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": content_type, "User-Agent": "valyo-shorts/1"},
    )
    last = "erreur inconnue"
    for attempt in range(1, RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")
            try:
                detail = json.loads(detail).get("error", detail)
            except ValueError:
                pass
            last = f"{error.code} : {detail[:300]}"
            # 4xx : la demande elle-même est refusée, la répéter ne changerait rien.
            if error.code < 500 and error.code != 429:
                raise ValyoError(last) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            last = f"réseau : {error}"
        if attempt < RETRIES:
            time.sleep(4 * attempt)
    raise ValyoError(f"{path} : {last} (après {RETRIES} essais)")


def prepare(dry_run: bool) -> dict:
    """Les trois articles du jour et leur script. `dry_run` : rien n'est enregistré côté site."""
    return json.loads(_call("/api/shorts/preparer", body=json.dumps({"dryRun": dry_run}).encode(), content_type="application/json"))


def voice(text: str) -> bytes:
    """Une phrase lue par la voix de synthèse, en WAV."""
    return _call("/api/shorts/voix", body=json.dumps({"text": text}).encode(), content_type="application/json")


def deliver(day: str, video: bytes) -> dict:
    """Envoie la vidéo au site, qui la transmet par e-mail aux administrateurs."""
    return json.loads(_call(f"/api/shorts/livrer?day={day}", body=video, content_type="video/mp4", timeout=300))
