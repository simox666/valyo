// Limite par adresse IP des demandes de lien de connexion (en mémoire, fenêtre glissante).
import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, createIpLimiter } from "../lib/ip-limit.ts";

test("limite par IP : bloque au-delà du maximum, puis rouvre quand la fenêtre a glissé", () => {
  let now = 0;
  const limiter = createIpLimiter(3, 1000, () => now);
  for (let k = 0; k < 3; k++) assert.equal(limiter.allow("1.2.3.4"), true);
  assert.equal(limiter.allow("1.2.3.4"), false);
  assert.equal(limiter.allow("5.6.7.8"), true, "une autre adresse n'est pas touchée");
  assert.equal(limiter.allow(null), true, "sans adresse connue, on laisse passer");
  now = 999;
  assert.equal(limiter.allow("1.2.3.4"), false);
  now = 1001;
  assert.equal(limiter.allow("1.2.3.4"), true);
});

test("limite par IP : adresse lue dans l'en-tête de l'hébergeur", () => {
  const request = (headers: Record<string, string>) => new Request("https://exemple.test", { headers });
  assert.equal(clientIp(request({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "9.9.9.9");
  assert.equal(clientIp(request({ "x-real-ip": "8.8.8.8" })), "8.8.8.8");
  assert.equal(clientIp(request({})), null);
});
