"use client";

import { useEffect, useMemo, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { PRESETS, RANGES, creatureFor, describeGravity, describeLight, describePressure, describeTemperature, describeWater, type Planet } from "@/lib/simulateurs/creature.ts";
import { CreatureSketch } from "./CreatureSketch";

const fr = (n: number, digits = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits });
const LOCOMOTION = { marche: "Marche", vol: "Vole", flotte: "Flotte dans l’air", fouit: "Vit sous la surface", nage: "Nage" } as const;

function Slider({ id, label, value, unit, hint, range, onChange }: {
  id: string; label: string; value: string; unit: string; hint: string;
  range: { min: number; max: number; step: number; current: number }; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <span className="font-mono text-sm tabular-nums text-accent">{value} {unit}</span>
      </div>
      <input id={id} type="range" min={range.min} max={range.max} step={range.step} value={range.current}
        onChange={(e) => onChange(Number(e.target.value))} aria-describedby={`${id}-repere`} className="mt-2 h-8 w-full accent-accent" />
      <p id={`${id}-repere`} className="text-xs text-muted">{hint}</p>
    </div>
  );
}

export function CreatureLab({ initial }: { initial: Planet }) {
  const [planet, setPlanet] = useState<Planet>(initial);
  const [view, setView] = useState<"illustration" | "croquis">("illustration");
  const creature = useMemo(() => creatureFor(planet), [planet]);
  const path = `/simulateurs/creature?g=${planet.g}&t=${planet.t}&p=${planet.p}&l=${planet.l}&w=${planet.w}`;
  // L'adresse suit les réglages : un lien partagé redonne exactement la même créature.
  useEffect(() => { window.history.replaceState(null, "", path); }, [path]);
  const set = (key: keyof Planet) => (v: number) => setPlanet((prev) => ({ ...prev, [key]: v }));
  const same = (a: Planet, b: Planet) => a.g === b.g && a.t === b.t && a.p === b.p && a.l === b.l && a.w === b.w;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
      {/* Mobile : la créature d'abord, les curseurs juste dessous, pour voir l'effet de chaque réglage. */}
      <section className="card order-2 space-y-5 p-5 md:order-none" aria-labelledby="planete">
        <div>
          <h2 id="planete" className="label-mono text-accent">Votre planète</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <li key={preset.name}>
                <button type="button" aria-pressed={same(preset.planet, planet)} onClick={() => setPlanet(preset.planet)}
                  className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-medium ring-1 transition ${same(preset.planet, planet) ? "bg-accent-soft text-accent ring-accent/40" : "bg-white text-ink ring-line hover:ring-ink"}`}>
                  {preset.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Slider id="gravite" label="Gravité" value={fr(planet.g)} unit="g" hint={describeGravity(planet.g)} range={{ ...RANGES.g, current: planet.g }} onChange={set("g")} />
        <Slider id="temperature" label="Température" value={String(planet.t).replace("-", "−")} unit="°C" hint={describeTemperature(planet.t)} range={{ ...RANGES.t, current: planet.t }} onChange={set("t")} />
        <Slider id="atmosphere" label="Atmosphère" value={fr(planet.p)} unit="bar" hint={describePressure(planet.p)} range={{ ...RANGES.p, current: planet.p }} onChange={set("p")} />
        <Slider id="lumiere" label="Lumière de l’étoile" value={`× ${fr(planet.l)}`} unit="" hint={describeLight(planet.l)} range={{ ...RANGES.l, current: planet.l }} onChange={set("l")} />
        <Slider id="mers" label="Mers" value={String(planet.w)} unit="%" hint={describeWater(planet.w, planet.t)} range={{ ...RANGES.w, current: planet.w }} onChange={set("w")} />
      </section>

      <div className="contents md:block md:space-y-5">
        <section className="card order-1 overflow-hidden" aria-live="polite" aria-labelledby="espece">
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div className="min-w-0">
              <p className="label-mono text-accent">Espèce probable</p>
              <h2 id="espece" className="mt-1 text-xl font-bold leading-snug">{creature.common}</h2>
              <p className="font-mono text-sm italic text-muted">{creature.name}</p>
            </div>
            <ShareButton path={path} title={`${creature.common} (${creature.name}) — ma créature sur Valyo`} />
          </div>
          <div role="group" aria-label="Type d’image" className="mx-5 mt-3 inline-flex gap-1 rounded-lg bg-chip p-1 text-sm">
            {(["illustration", "croquis"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 ${view === v ? "bg-white font-semibold text-ink ring-1 ring-line" : "text-soft hover:text-ink"}`}>
                {v === "illustration" ? "Illustration" : "Croquis à l’échelle"}
              </button>
            ))}
          </div>
          {view === "illustration" ? (
            <>
              {/* Planche sur fond crème fixe (#F7F7F3) : c'est le fond des illustrations, en clair comme en sombre. */}
              <div className="mt-3 bg-[#F7F7F3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={creature.family} src={`/creatures/${creature.family}.webp`} width={800} height={800}
                  alt={`Illustration : ${creature.common}, ${creature.name}`} className="mx-auto block aspect-square w-full max-w-[300px] sm:max-w-[520px]" />
              </div>
              {creature.extras.length > 0 && (
                <p className="px-5 py-3 text-sm text-soft">
                  <span className="font-semibold text-ink">Chez cette espèce :</span> {creature.extras.join(", ")}.{" "}
                  <button type="button" onClick={() => setView("croquis")} className="font-semibold text-accent hover:underline">Voir sur le croquis</button>
                </p>
              )}
            </>
          ) : (
            <div className="px-3 pt-2"><CreatureSketch creature={creature} /></div>
          )}
          <dl className="grid grid-cols-3 divide-x divide-hairline border-t border-hairline text-center">
            <div className="px-2 py-3"><dt className="label-mono">Taille</dt><dd className="mt-0.5 font-display text-lg font-bold">{fr(creature.heightM, 2)} m</dd></div>
            <div className="px-2 py-3"><dt className="label-mono">Masse</dt><dd className="mt-0.5 font-display text-lg font-bold">{creature.massKg >= 1000 ? `${fr(creature.massKg / 1000)} t` : `${fr(creature.massKg)} kg`}</dd></div>
            <div className="px-2 py-3"><dt className="label-mono">Mode de vie</dt><dd className="mt-0.5 text-sm font-semibold leading-tight">{LOCOMOTION[creature.locomotion]}</dd></div>
          </dl>
          {creature.caveat && <p className="border-t border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">{creature.caveat}</p>}
        </section>

        <section className="card order-3 p-5" aria-labelledby="pourquoi">
          <h2 id="pourquoi" className="label-mono text-accent">Pourquoi cette allure ?</h2>
          <dl className="mt-3 space-y-3.5">
            {creature.traits.map((trait) => (
              <div key={trait.label}>
                <dt className="text-sm"><span className="font-semibold">{trait.label}</span> <span className="text-soft">· {trait.value}</span></dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-soft">{trait.why}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
