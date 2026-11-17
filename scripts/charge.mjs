// Plan de charge reproductible (lot d'accélération E41) : N connexions simultanées,
// chat et flux SSE compris, avec métriques.
//
//   BASE_URL=http://localhost:3100 CHARGE_CLIENTS=100 npm run charge
//
// À lancer UNIQUEMENT contre un serveur de test (base dédiée, jamais la production) :
// le scénario crée des comptes et des messages. Variables :
//   BASE_URL           serveur cible (défaut http://localhost:3000)
//   CHARGE_CLIENTS     nombre de membres simulés (défaut 100)
//   CHARGE_ECRIVAINS   proportion qui écrit dans le chat (défaut 0.2)
//   CHARGE_MESSAGES    messages par écrivain (défaut 3)
//
// Scénario par client : inscription (lien de développement), adhésion à un salon
// commun, ouverture du flux SSE, puis messages pour la part « écrivains ». Métriques :
// réussites/échecs par étape, durée d'inscription, latence envoi → réception SSE
// (p50/p95/max sur les flux ouverts), messages reçus par flux.
//
// La capacité n'est JAMAIS annoncée comme vérifiée sans une exécution documentée
// (serveur, base, matériel, résultats). La partie « 12 participants vocaux » attend
// le vrai vocal (E42).

import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CLIENTS = Number(process.env.CHARGE_CLIENTS || 100);
const WRITER_RATIO = Number(process.env.CHARGE_ECRIVAINS || 0.2);
const MESSAGES = Number(process.env.CHARGE_MESSAGES || 3);
const run = `charge-${Date.now().toString(36)}`;

const quantile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null);

class Client {
  constructor(name) {
    this.name = name;
    this.cookie = "";
  }
  async request(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        Origin: BASE,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    let data = null;
    try {
      data = await res.clone().json();
    } catch {}
    return { status: res.status, data, location: res.headers.get("location") };
  }
  async signUp() {
    const started = Date.now();
    const link = await this.request("POST", "/api/auth/request-link", { email: `${this.name}@charge.test`, next: "/" });
    assert.equal(link.status, 200, `lien refusé pour ${this.name}`);
    const url = new URL(link.data.devLink);
    await this.request("GET", url.pathname + url.search);
    const onboard = await this.request("POST", "/api/onboarding", { handle: this.name.replace(/[^a-z0-9_]/g, "_"), displayName: this.name, acceptRules: true, themeIds: [] });
    assert.equal(onboard.status, 200, `inscription refusée pour ${this.name}`);
    return Date.now() - started;
  }
}

console.log(`Plan de charge : ${CLIENTS} clients contre ${BASE} (écrivains ${Math.round(WRITER_RATIO * 100)} %, ${MESSAGES} messages chacun).`);

// 1. Le premier client crée le salon commun.
const owner = new Client(`${run}_0`);
const signupDurations = [await owner.signUp()];
let res = await owner.request("POST", "/api/rooms", { name: `Salon de charge ${run}`, description: "", themeId: null, visibility: "public", format: "chat", postId: null });
assert.equal(res.status, 201, "création du salon de charge");
const roomId = res.data.roomId;

// 2. Inscriptions et adhésions par vagues (20 à la fois pour ne pas saturer les liens de connexion).
const clients = [owner];
const failures = { signup: 0, join: 0, send: 0, stream: 0 };
for (let start = 1; start < CLIENTS; start += 20) {
  const wave = Array.from({ length: Math.min(20, CLIENTS - start) }, (_, i) => new Client(`${run}_${start + i}`));
  await Promise.all(
    wave.map(async (c) => {
      try {
        signupDurations.push(await c.signUp());
        const joined = await c.request("POST", `/api/rooms/${roomId}/join`);
        if (joined.status !== 200) failures.join++;
        clients.push(c);
      } catch {
        failures.signup++;
      }
    }),
  );
}
console.log(`Inscriptions : ${clients.length} réussies, ${failures.signup} échouées.`);

// 3. Tous les clients ouvrent un flux SSE et mesurent la latence de chaque message reçu.
const latencies = [];
const received = new Map();
const sentAt = new Map(); // clientId de message → horodatage d'envoi
const controllers = [];
await Promise.all(
  clients.map(async (c) => {
    const controller = new AbortController();
    controllers.push(controller);
    try {
      const streamRes = await fetch(`${BASE}/api/rooms/${roomId}/stream?cursor=0`, { headers: { Cookie: c.cookie }, signal: controller.signal });
      if (streamRes.status !== 200) {
        failures.stream++;
        return;
      }
      received.set(c.name, 0);
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      (async () => {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let index;
            while ((index = buffer.indexOf("\n\n")) >= 0) {
              const frame = buffer.slice(0, index);
              buffer = buffer.slice(index + 2);
              if (!frame.startsWith("event: message")) continue;
              received.set(c.name, received.get(c.name) + 1);
              const match = frame.match(/"clientId":"(charge-[a-z0-9-]+)"/);
              void match; // le corps ne contient pas clientId : latence mesurée via le marqueur du texte
              const marker = frame.match(/charge-marque-(\d+)/);
              if (marker) latencies.push(Date.now() - Number(marker[1]));
            }
          }
        } catch {}
      })();
    } catch {
      failures.stream++;
    }
  }),
);
console.log(`Flux SSE ouverts : ${received.size}, échecs : ${failures.stream}.`);

// 4. Les « écrivains » envoient leurs messages, horodatage dans le corps pour mesurer la latence.
const writers = clients.filter((_, i) => i % Math.round(1 / WRITER_RATIO || 1) === 0);
for (let round = 0; round < MESSAGES; round++) {
  await Promise.all(
    writers.map(async (c, i) => {
      const id = `w${i}-r${round}`;
      const sent = await c.request("POST", `/api/rooms/${roomId}/messages`, { clientId: id, body: `charge-marque-${Date.now()} message ${id}` });
      if (sent.status !== 201 && sent.status !== 200 && sent.status !== 429) failures.send++;
      sentAt.set(id, Date.now());
    }),
  );
  await new Promise((r) => setTimeout(r, 1000));
}
// Laisser les flux rattraper (intervalle de lecture 1,5 s), puis couper.
await new Promise((r) => setTimeout(r, 6000));
for (const controller of controllers) controller.abort();

const sortedLatencies = latencies.sort((a, b) => a - b);
const sortedSignups = signupDurations.sort((a, b) => a - b);
const expected = writers.length * MESSAGES;
const totalReceived = [...received.values()].reduce((a, b) => a + b, 0);
console.log(`\nRésultats (${new Date().toISOString()}) — À DOCUMENTER avec serveur, base et matériel :`);
console.log(`- clients : ${clients.length}/${CLIENTS} ; échecs — inscription ${failures.signup}, adhésion ${failures.join}, flux ${failures.stream}, envoi ${failures.send}`);
console.log(`- inscriptions (ms) : p50 ${quantile(sortedSignups, 0.5)}, p95 ${quantile(sortedSignups, 0.95)}, max ${sortedSignups.at(-1)}`);
console.log(`- messages envoyés attendus : ${expected} ; événements reçus (tous flux) : ${totalReceived}`);
console.log(`- latence envoi → réception SSE (ms) : p50 ${quantile(sortedLatencies, 0.5)}, p95 ${quantile(sortedLatencies, 0.95)}, max ${sortedLatencies.at(-1) ?? "—"} (${sortedLatencies.length} mesures)`);
console.log(`\nRappel : cette exécution ne vaut que pour l'environnement où elle a tourné ; aucune capacité n'est « vérifiée » sans rapport daté.`);
