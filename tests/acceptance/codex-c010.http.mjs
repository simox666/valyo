// Recette des raccordements HTTP C010, sur une copie SANS secrets avec base jetable.
// ADMIN_EMAILS=admin-e2e@example.test ; BASE_URL=http://localhost:3217
import assert from "node:assert/strict";
import { test } from "node:test";

const base = process.env.BASE_URL;
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):3217$/.test(base)) throw new Error("Serveur de recette isolé sur le port 3217 exigé");
const suffix = Date.now().toString(36);
let sequence = 0;

class Client {
  cookie = "";
  async request(method, path, body) {
    const response = await fetch(base + path, {
      method, redirect: "manual", signal: AbortSignal.timeout(30_000),
      headers: { Origin: base, Cookie: this.cookie, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { data = {}; }
    return { status: response.status, data };
  }
  async signup(email) {
    const handle = `c010_${suffix}_${++sequence}`;
    this.email = email ?? `${handle}@example.test`;
    const link = await this.request("POST", "/api/auth/request-link", { email: this.email });
    assert.equal(link.status, 200);
    assert.ok(link.data.devLink, "le serveur doit fonctionner sans fournisseur d'e-mail");
    const url = new URL(link.data.devLink);
    assert.equal(url.origin, base);
    assert.equal((await this.request("GET", url.pathname + url.search)).status, 303);
    const me = await this.request("GET", "/api/me");
    assert.equal(me.status, 200);
    if (!me.data.onboarded) assert.equal((await this.request("POST", "/api/onboarding", { handle, displayName: "Démonstration C010", acceptRules: true, themeIds: [] })).status, 200);
    this.id = me.data.id;
    return this;
  }
}

let admin;
async function administrator() {
  if (!admin) admin = await new Client().signup("admin-e2e@example.test");
  return admin;
}

test("ACC02 HTTP — la levée transmet l'identifiant de la sanction au service", async () => {
  const admin = await administrator();
  const member = await new Client().signup();
  const sanction = await admin.request("POST", "/api/admin/moderation/actions", { targetUserId: member.id, kind: "suspend", durationDays: 7, reason: "Suspension de recette C010" });
  assert.equal(sanction.status, 201);
  const lift = await admin.request("POST", "/api/admin/moderation/actions", { targetUserId: member.id, actionId: sanction.data.actionId, kind: "lift", reason: "Levée individuelle de recette" });
  assert.equal(lift.status, 201, JSON.stringify(lift.data));
  assert.equal((await member.request("GET", "/api/me")).data.status, "active");
});

test("ACC06 HTTP — le rechargement de l'historique fournit aussi son curseur de reprise", async () => {
  const owner = await new Client().signup();
  const room = await owner.request("POST", "/api/rooms", { name: "Démonstration instantané C010", visibility: "public" });
  assert.equal(room.status, 201);
  assert.equal((await owner.request("POST", `/api/rooms/${room.data.roomId}/messages`, { clientId: "snapshot", body: "Message à retrouver après resynchronisation" })).status, 201);
  const history = await owner.request("GET", `/api/rooms/${room.data.roomId}/messages`);
  assert.equal(history.status, 200);
  assert.equal(history.data.messages.length, 1);
  assert.ok(Number.isSafeInteger(history.data.cursor) && history.data.cursor > 0, "le client doit recevoir un curseur cohérent avec l'historique");
});

test("ACC09 HTTP — un compte banni conteste sans rouvrir de session communautaire", async () => {
  const admin = await administrator();
  const member = await new Client().signup();
  const ban = await admin.request("POST", "/api/admin/moderation/actions", { targetUserId: member.id, kind: "ban", reason: "Bannissement de recette C010" });
  assert.equal(ban.status, 201);
  assert.equal((await member.request("GET", "/api/me")).status, 401);
  const guest = new Client();
  const access = await guest.request("POST", "/api/appeals/access", { email: member.email });
  assert.equal(access.status, 200);
  assert.ok(access.data.devLink, "lien de développement réservé au serveur de test");
  const token = new URL(access.data.devLink, base).searchParams.get("token");
  assert.ok(token);
  const payload = { actionId: ban.data.actionId, body: "Contestation de test, je demande un examen de la décision.", token };
  assert.equal((await guest.request("POST", "/api/appeals", payload)).status, 201);
  assert.equal((await guest.request("GET", "/api/me")).status, 401);
  assert.equal((await guest.request("POST", "/api/appeals", payload)).status, 410);
});

test("ACC09 HTTP — les liens de contestation sont limités après cinq demandes cumulées", async () => {
  const admin = await administrator();
  const member = await new Client().signup(); // consomme déjà un lien de connexion
  assert.equal((await admin.request("POST", "/api/admin/moderation/actions", { targetUserId: member.id, kind: "ban", reason: "Compte de test du quota C010" })).status, 201);
  const guest = new Client();
  for (let i = 0; i < 4; i++) assert.equal((await guest.request("POST", "/api/appeals/access", { email: member.email })).status, 200);
  const overflow = await guest.request("POST", "/api/appeals/access", { email: member.email });
  assert.equal(overflow.status, 429, "le quota partagé de cinq liens doit compter aussi les contestations");
});
