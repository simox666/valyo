// Démarrer une copie isolée avec next start sur 3218, NODE_ENV=production,
// APP_URL=http://localhost:3218, sans RESEND_API_KEY et sans DATABASE_URL.
// Cette requête doit être refusée AVANT tout accès à la base ou envoi d'e-mail.
import assert from "node:assert/strict";

const base = process.env.BASE_URL ?? "http://localhost:3218";
assert.equal(base, "http://localhost:3218", "Utiliser uniquement le serveur de recette isolé sur 3218.");
const response = await fetch(`${base}/api/appeals/access`, {
  method: "POST",
  headers: { origin: base, "content-type": "application/json" },
  body: JSON.stringify({ email: "production-guard@example.test" }),
});
assert.equal(response.status, 503, "L'absence du service d'e-mail doit fermer cette voie en production.");
const body = await response.json();
assert.equal(body.devLink, undefined);
assert.equal(response.headers.get("set-cookie"), null);
assert.ok(body.error);
console.log("✔ ACC09 production — 503 sans clé e-mail, aucun lien de développement ni session");
