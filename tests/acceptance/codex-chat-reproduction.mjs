// Régression HTTP indépendante C010. À lancer seulement sur une base de recette.
// BASE_URL=http://localhost:3217 node tests/acceptance/codex-chat-reproduction.mjs
import assert from "node:assert/strict";
const base = process.env.BASE_URL;
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):3217$/.test(base)) throw new Error("Serveur isolé sur le port 3217 exigé");
const suffix = Date.now().toString(36);
class Client {
  cookie = "";
  async request(method, path, body) {
    const response = await fetch(base + path, { method, redirect: "manual", headers: { Origin: base, Cookie: this.cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = {}; }
    return { status: response.status, data };
  }
  async signup(name) {
    const link = await this.request("POST", "/api/auth/request-link", { email: `${name}-${suffix}@example.test` });
    assert.equal(link.status, 200);
    assert.ok(link.data.devLink, "Le mode sans e-mail est exigé");
    const url = new URL(link.data.devLink);
    assert.equal((await this.request("GET", url.pathname + url.search)).status, 303);
    assert.equal((await this.request("POST", "/api/onboarding", { handle: `${name}_${suffix}`, displayName: name, acceptRules: true, themeIds: [] })).status, 200);
  }
}
const owner = new Client(); const member = new Client();
await owner.signup("recetteowner"); await member.signup("recettemember");
const dummy = await owner.request("POST", "/api/rooms", { name: "Salon de décalage", visibility: "public" });
assert.equal(dummy.status, 201);
assert.equal((await owner.request("POST", `/api/rooms/${dummy.data.roomId}/messages`, { clientId: "offset", body: "Événement dans un autre salon" })).status, 201);
const created = await owner.request("POST", "/api/rooms", { name: "Salon privé de recette", visibility: "private" });
assert.equal(created.status, 201);
const room = created.data.roomId;
const invite = await owner.request("POST", `/api/rooms/${room}/invitations`, {});
assert.equal(invite.status, 201);
const token = invite.data.url.split("/").pop();
assert.ok(token);
assert.equal((await member.request("POST", "/api/invitations/accept", { token })).status, 200);
assert.equal((await owner.request("POST", `/api/rooms/${room}/messages`, { clientId: "before", body: "Message avant départ" })).status, 201);

const gapAbort = new AbortController();
const gap = await fetch(`${base}/api/rooms/${room}/stream?cursor=0`, { headers: { Cookie: member.cookie }, signal: gapAbort.signal });
const gapReader = gap.body.getReader();
const gapChunk = new TextDecoder().decode((await gapReader.read()).value);
console.log(JSON.stringify({ case: "curseur zero sans purge, sequence globale avec trou", sendsResync: gapChunk.includes("event: resync") }));
gapAbort.abort();
assert.equal(gapChunk.includes("event: resync"), false, "un trou de séquence globale ne déclenche pas de resynchronisation");

const abort = new AbortController();
const timer = setTimeout(() => abort.abort(), 7000);
const stream = await fetch(`${base}/api/rooms/${room}/stream`, { headers: { Cookie: member.cookie }, signal: abort.signal });
const reader = stream.body.getReader();
await reader.read(); // ready : le flux est maintenant ouvert avec les droits initiaux.
assert.equal((await member.request("POST", `/api/rooms/${room}/leave`, {})).status, 200);
const marker = "CONFIDENTIEL_APRES_DEPART";
assert.equal((await owner.request("POST", `/api/rooms/${room}/messages`, { clientId: "after", body: marker })).status, 201);
let text = "";
try {
  while (!text.includes(marker) && !text.includes("event: revoked")) {
    const chunk = await reader.read(); if (chunk.done) break;
    text += new TextDecoder().decode(chunk.value);
  }
} catch (error) { if (error.name !== "AbortError") throw error; }
finally { clearTimeout(timer); abort.abort(); }
console.log(JSON.stringify({ case: "flux privé après départ", receivesLaterPrivateMessage: text.includes(marker), revoked: text.includes("event: revoked") }));
assert.equal(text.includes(marker), false, "aucun message privé après le départ");
assert.ok(text.includes("event: revoked"), "le flux ouvert doit annoncer la perte d'accès");
