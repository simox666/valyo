// Créneaux dans un fuseau explicite : changements d'heure sans doublon ni décalage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { slotsBetween, zonedToUtc } from "../lib/editorial/time.ts";

const TZ = "Europe/Brussels";

test("7 h à Bruxelles en heure d'été et d'hiver", () => {
  assert.equal(zonedToUtc(2026, 10, 23, 7, 0, TZ).toISOString(), "2026-10-23T05:00:00.000Z");
  assert.equal(zonedToUtc(2026, 10, 26, 7, 0, TZ).toISOString(), "2026-10-26T06:00:00.000Z");
  assert.equal(zonedToUtc(2027, 3, 29, 7, 0, TZ).toISOString(), "2027-03-29T05:00:00.000Z");
});

test("créneaux autour du passage à l'heure d'hiver : une occurrence par jour, clés uniques", () => {
  const rules = [{ weekday: 7, time: "02:30" }, { weekday: 1, time: "07:00" }];
  const slots = slotsBetween(rules, TZ, new Date("2026-10-24T00:00:00Z"), new Date("2026-10-27T00:00:00Z"));
  assert.deepEqual(slots.map((s) => s.key), ["2026-10-25T02:30[Europe/Brussels]", "2026-10-26T07:00[Europe/Brussels]"]);
  assert.equal(new Set(slots.map((s) => s.at.getTime())).size, slots.length);
});

test("créneaux autour du passage à l'heure d'été : l'heure inexistante donne une seule occurrence", () => {
  const slots = slotsBetween([{ weekday: 7, time: "02:30" }], TZ, new Date("2027-03-27T00:00:00Z"), new Date("2027-03-29T00:00:00Z"));
  assert.equal(slots.length, 1);
  assert.equal(slots[0].key, "2027-03-28T02:30[Europe/Brussels]");
});

test("trois créneaux par semaine sur un mois : 13 occurrences, toutes à 7 h locales", () => {
  const rules = [1, 3, 5].map((weekday) => ({ weekday, time: "07:00" }));
  const slots = slotsBetween(rules, TZ, new Date("2026-10-01T00:00:00Z"), new Date("2026-10-31T23:59:00Z"));
  assert.equal(slots.length, 13);
  for (const s of slots) {
    const local = new Intl.DateTimeFormat("fr-BE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(s.at);
    assert.equal(local, "07:00");
  }
});
