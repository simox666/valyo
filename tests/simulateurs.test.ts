// Simulateurs : les modèles de calcul donnent les ordres de grandeur attendus.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { seededRandom } from "../lib/jeux/tirage.ts";
import { SIMULATORS } from "../lib/simulateurs/catalogue.ts";
import { circularSpeed, escapeSpeed, fly } from "../lib/simulateurs/orbite.ts";
import { elsewhere } from "../lib/simulateurs/poids-age.ts";
import { intensity, sample } from "../lib/simulateurs/fentes.ts";
import { MIX_PRESETS, evaluate } from "../lib/simulateurs/mix.ts";
import { PREINDUSTRIAL, TODAY, bareTemp, climate } from "../lib/simulateurs/climat.ts";
import { outbreak } from "../lib/simulateurs/epidemie.ts";
import { initialPopulation, meanColour, nextGeneration } from "../lib/simulateurs/selection.ts";
import { accuracy, createNet, dataset, trainStep } from "../lib/simulateurs/neurone.ts";
import { ATTACKERS, analyse, crackLog10Seconds, formatDuration } from "../lib/simulateurs/mot-de-passe.ts";
import { solve } from "../lib/simulateurs/bras.ts";

const near = (actual: number, expected: number, tolerance: number, label = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} attendu ≈ ${expected}, obtenu ${actual}`);

test("simulateurs : chaque entrée du catalogue a sa page", () => {
  assert.equal(new Set(SIMULATORS.map((s) => s.slug)).size, SIMULATORS.length);
  for (const s of SIMULATORS) assert.ok(existsSync(`app/simulateurs/${s.slug}/page.tsx`), `page manquante : ${s.slug}`);
});

test("orbite : vitesses de référence, période de la station spatiale et de l'orbite géostationnaire", () => {
  near(circularSpeed(400), 7.67, 0.02, "vitesse circulaire à 400 km");
  near(escapeSpeed(400), 10.85, 0.03, "vitesse de libération à 400 km");
  const iss = fly(circularSpeed(400), 400);
  assert.equal(iss.outcome, "orbite");
  near(iss.periodMin!, 92.4, 0.5, "période à 400 km");
  near(iss.apogee!, 400, 1); near(iss.perigee, 400, 1);
  near(fly(circularSpeed(35786), 35786).periodMin!, 1436, 3, "période géostationnaire");
  const slow = fly(7, 400);
  assert.equal(slow.outcome, "retombe");
  assert.ok(slow.groundKm! > 1000 && slow.groundKm! < 30000);
  assert.equal(fly(0, 400).outcome, "retombe");
  const fast = fly(9, 400);
  assert.equal(fast.outcome, "orbite");
  near(fast.perigee, 400, 1);
  assert.ok(fast.apogee! > 5000);
  assert.equal(fly(11, 400).outcome, "evasion");
  for (const f of [iss, slow, fast, fly(11, 400)]) assert.ok(f.path.length > 1 && f.path.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
});

test("poids et âge : Lune, Mars, Jupiter", () => {
  const rows = Object.fromEntries(elsewhere(60, 30).map((r) => [r.name, r]));
  near(rows.Lune.scale, 9.9, 0.2); near(rows.Mars.scale, 22.8, 0.3); near(rows.Jupiter.scale, 151.6, 1);
  near(rows.Mars.age!, 15.9, 0.1); near(rows.Jupiter.age!, 2.53, 0.02);
  assert.equal(rows.Lune.age, null);
  assert.ok(rows.Lune.jump > 2);
});

test("fentes : franges avec deux fentes, plus de franges si on observe", () => {
  const two = { mode: "deux" as const, separation: 4 };
  near(intensity(0, two), 1, 1e-9);
  near(intensity(1 / 16, two), 0, 1e-9, "première frange sombre");
  near(intensity(0.07, two), intensity(-0.07, two), 1e-9);
  assert.ok(intensity(1 / 16, { mode: "observe", separation: 4 }) > 0.8);
  const random = seededRandom("fentes");
  const hits = Array.from({ length: 4000 }, () => sample(random, two));
  assert.ok(hits.every((u) => u >= -1 && u <= 1));
  const dark = hits.filter((u) => Math.abs(Math.abs(u) - 1 / 16) < 0.008).length;
  const bright = hits.filter((u) => Math.abs(u) < 0.008).length;
  assert.ok(bright > dark * 4, `centre ${bright}, frange sombre ${dark}`);
});

test("mix électrique : CO₂ et tenue un soir d'hiver sans vent", () => {
  const [nuclear, renewable, , fossil] = MIX_PRESETS.map((p) => evaluate(p.mix));
  assert.ok(nuclear.co2 < 80 && fossil.co2 > 500 && renewable.co2 < 40);
  assert.ok(nuclear.coverage > 0.8 && renewable.coverage < 0.6);
  near(nuclear.shares.reduce((s, x) => s + x.share, 0), 1, 1e-9);
  near(evaluate({ nucleaire: 0, eolien: 0, solaire: 0, hydraulique: 0, gaz: 0, charbon: 7 }).co2, 820, 1e-9);
  assert.equal(evaluate({ nucleaire: 0, eolien: 0, solaire: 0, hydraulique: 0, gaz: 0, charbon: 0 }).coverage, 0);
});

test("climat : +3 °C pour un doublement du CO₂, −18 °C sans effet de serre", () => {
  near(climate(PREINDUSTRIAL).delta, 0, 1e-9);
  near(climate({ ...PREINDUSTRIAL, co2: 560 }).delta, 3, 1e-9);
  near(climate(TODAY).delta, 1.8, 0.1);
  near(bareTemp(0.3), -18.5, 0.6);
  assert.ok(climate({ ...PREINDUSTRIAL, albedo: 0.31 }).delta < -2);
  assert.ok(climate({ ...PREINDUSTRIAL, aerosols: -1 }).delta < 0 && climate({ ...PREINDUSTRIAL, sun: 1 }).delta > 0);
});

test("épidémie : seuil, taille finale et immunité collective", () => {
  const quiet = outbreak({ r0: 0.9, vaccinated: 0, isolation: 0 });
  assert.ok(quiet.attack < 0.02 && quiet.herd === 0);
  const wave = outbreak({ r0: 2, vaccinated: 0, isolation: 0 });
  near(wave.attack, 0.797, 0.01, "taille finale pour R0 = 2");
  assert.ok(wave.peak > 0.1 && wave.peakDay > 10);
  near(wave.herd, 0.5, 1e-9);
  assert.ok(outbreak({ r0: 2, vaccinated: 0.6, isolation: 0 }).attack < 0.01);
  assert.ok(outbreak({ r0: 2, vaccinated: 0, isolation: 0.6 }).attack < 0.02);
  near(outbreak({ r0: 15, vaccinated: 0, isolation: 0 }).herd, 0.933, 0.001, "seuil rougeole");
  for (const p of wave.series) near(p.s + p.i + p.r, 1, 1e-6);
});

test("sélection : la population rejoint la couleur du décor, de façon reproductible", () => {
  const run = (background: number) => {
    const random = seededRandom("selection");
    let pop = initialPopulation(random);
    for (let g = 0; g < 40; g++) pop = nextGeneration(pop, { background, pressure: 0.8, mutation: 0.05 }, random).next;
    return meanColour(pop);
  };
  near(run(0.9), 0.9, 0.12); near(run(0.1), 0.1, 0.12);
  assert.equal(run(0.9), run(0.9));
  const random = seededRandom("x");
  const pop = initialPopulation(random);
  const calm = nextGeneration(pop, { background: 0.5, pressure: 0, mutation: 0 }, random);
  assert.equal(calm.eaten, 0);
  assert.ok(calm.next.every((c) => pop.includes(c)));
});

test("réseau de neurones : une droite suffit pour deux groupes, pas pour le damier", () => {
  const train = (kind: "groupes" | "damier", hidden: number, steps: number) => {
    const random = seededRandom(`reseau-${kind}-${hidden}`);
    const points = dataset(kind, random);
    const net = createNet(hidden, random);
    let loss = 0;
    for (let s = 0; s < steps; s++) loss = trainStep(net, points, 0.5);
    return { acc: accuracy(net, points), loss };
  };
  assert.ok(train("groupes", 0, 400).acc >= 0.95);
  assert.ok(train("damier", 0, 1500).acc < 0.8);
  const deep = train("damier", 6, 6000);
  assert.ok(deep.acc >= 0.9, `damier avec 6 neurones : ${deep.acc}`);
  assert.ok(Number.isFinite(deep.loss));
});

test("mot de passe : longueur, listes connues et durées lisibles", () => {
  assert.equal(analyse("").log10, 0);
  assert.ok(analyse("azerty").common && analyse("Password").common);
  const short = analyse("chat42");
  const long = analyse("cheval-agrafe-batterie-correct");
  assert.ok(short.warnings.length >= 2 && long.log10 > short.log10 + 30);
  near(analyse("abcdefgh").log10, 8 * Math.log10(26), 1e-9);
  assert.equal(formatDuration(crackLog10Seconds(short.log10, ATTACKERS[1].rate)), "instantané");
  assert.equal(formatDuration(crackLog10Seconds(long.log10, ATTACKERS[2].rate)), "plus que l’âge de l’Univers");
  assert.match(formatDuration(Math.log10(90)), /minutes/);
  assert.match(formatDuration(Math.log10(3 * 365.25 * 86400)), /^3 ans$/);
  assert.equal(formatDuration(5, true), "instantané");
});

test("bras articulé : atteint la cible à portée, se tend vers elle sinon", () => {
  const lengths = [80, 80, 80];
  const hit = solve(lengths, { x: 120, y: 90 });
  assert.ok(hit.reachable && hit.error < 0.5);
  hit.joints.slice(1).forEach((j, k) => near(Math.hypot(j.x - hit.joints[k].x, j.y - hit.joints[k].y), lengths[k], 0.01));
  assert.equal(hit.angles.length, 3);
  const far = solve(lengths, { x: 400, y: 0 });
  assert.ok(!far.reachable);
  near(far.joints[3].x, 240, 0.01); near(far.joints[3].y, 0, 0.01);
  assert.deepEqual(far.angles, [90, 0, 0]);
});
