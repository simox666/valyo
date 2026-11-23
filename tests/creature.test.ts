// Simulateur de créature : mêmes réglages → même créature, et les règles annoncées tiennent
// (plus de gravité → plus de pattes et plus petit ; air dense et gravité faible → vol puis flottaison).
import assert from "node:assert/strict";
import { test } from "node:test";
import { EARTH, PRESETS, RANGES, clampPlanet, creatureFor } from "../lib/simulateurs/creature.ts";

test("créature : résultat déterministe et complet sur toute la grille des curseurs", () => {
  for (let g = RANGES.g.min; g <= RANGES.g.max + 1e-9; g += 0.5) {
    for (let t = RANGES.t.min; t <= RANGES.t.max; t += 20) {
      for (let p = RANGES.p.min; p <= RANGES.p.max + 1e-9; p += 0.5) {
        const a = creatureFor({ g, t, p });
        assert.deepEqual(a, creatureFor({ g, t, p }));
        assert.match(a.name, /^[A-Z][a-z]+ [a-z]+$/);
        assert.ok(a.common.length > 5 && a.traits.length >= 5);
        assert.ok(a.heightM > 0 && a.massKg > 0 && Number.isFinite(a.massKg));
        for (const k of ["legLength", "legWidth", "bodyW", "bodyH", "neck", "tail", "wings", "eyes", "nostrils", "ears", "coverDensity"] as const) {
          assert.ok(a[k] >= 0 && a[k] <= 1, `${k} hors bornes pour g=${g} t=${t} p=${p}`);
        }
        for (const trait of a.traits) assert.ok(trait.label && trait.value && trait.why.length > 20);
      }
    }
  }
});

test("créature : la gravité tasse et multiplie les appuis", () => {
  const light = creatureFor({ g: 0.3, t: 15, p: 0.5 });
  const heavy = creatureFor({ g: 2.8, t: 15, p: 0.5 });
  assert.equal(light.locomotion, "marche");
  assert.equal(heavy.locomotion, "marche");
  assert.ok(heavy.legs > light.legs);
  assert.ok(heavy.heightM < light.heightM);
  assert.ok(heavy.legWidth > light.legWidth && heavy.legLength < light.legLength);
});

test("créature : l'air dense fait voler puis flotter ; sans air, la vie se cache", () => {
  assert.equal(creatureFor(EARTH).locomotion, "marche");
  assert.equal(creatureFor({ g: 1, t: 15, p: 3 }).locomotion, "vol");
  const floater = creatureFor({ g: 0.3, t: 15, p: 4 });
  assert.equal(floater.locomotion, "flotte");
  assert.ok(floater.sacs >= 2 && floater.legs === 0);
  const airless = creatureFor({ g: 0.4, t: -60, p: 0 });
  assert.equal(airless.locomotion, "fouit");
  assert.ok(airless.caveat);
});

test("créature : le revêtement suit la température", () => {
  assert.equal(creatureFor({ g: 1, t: -60, p: 1 }).cover, "fourrure");
  assert.equal(creatureFor({ g: 1, t: 20, p: 1 }).cover, "peau");
  assert.equal(creatureFor({ g: 1, t: 80, p: 1 }).cover, "ecailles");
  assert.equal(creatureFor({ g: 1, t: 115, p: 1 }).cover, "carapace");
  assert.ok(creatureFor({ g: 1, t: 80, p: 1 }).ears > 0);
});

test("créature : les réglages venus d'une adresse sont ramenés dans les bornes", () => {
  assert.deepEqual(clampPlanet({}), EARTH);
  assert.deepEqual(clampPlanet({ g: "99", t: "-999", p: "abc" }), { g: RANGES.g.max, t: RANGES.t.min, p: EARTH.p });
  assert.deepEqual(clampPlanet({ g: "0.44", t: "17", p: "1.26" }), { g: 0.4, t: 15, p: 1.3 });
  for (const preset of PRESETS) assert.deepEqual(clampPlanet(preset.planet), preset.planet);
});
