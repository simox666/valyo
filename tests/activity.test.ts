// Anomalie A003 : une panne de mesure ne bloque pas la page et n'empêche pas de réessayer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createActivityRecorder } from "../lib/activity.ts";

test("une écriture en échec ne lève pas d'erreur et sera retentée", async () => {
  const calls: string[] = [];
  let fail = true;
  const record = createActivityRecorder(async (id, day) => {
    calls.push(`${id}:${day}`);
    if (fail) throw new Error("base indisponible");
  }, () => new Date("2026-11-12T23:59:00Z"));

  await assert.doesNotReject(record("u1"), "l'échec est avalé");
  fail = false;
  await record("u1");
  await record("u1");
  assert.deepEqual(calls, ["u1:2026-11-12", "u1:2026-11-12"], "retentée après l'échec, puis mise en cache après le succès");
});

test("le jour enregistré est le jour UTC", async () => {
  const days: string[] = [];
  let now = new Date("2026-11-12T23:30:00Z"); // 00 h 30 le 13 à Bruxelles
  const record = createActivityRecorder(async (_id, day) => void days.push(day), () => now);
  await record("u1");
  now = new Date("2026-11-13T00:30:00Z");
  await record("u1");
  assert.deepEqual(days, ["2026-11-12", "2026-11-13"]);
});
