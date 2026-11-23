"use client";

import { useState } from "react";
import { Slider, Stat, fr } from "@/components/sim/ui";
import { PREINDUSTRIAL, TODAY, bareTemp, climate, type ClimateInput } from "@/lib/simulateurs/climat.ts";

const PRESETS: { name: string; input: ClimateInput }[] = [
  { name: "Avant l’industrie", input: PREINDUSTRIAL },
  { name: "Aujourd’hui", input: TODAY },
  { name: "CO₂ doublé", input: { ...PREINDUSTRIAL, co2: 560 } },
  { name: "Ère glaciaire", input: { co2: 180, albedo: 0.31, sun: 0, aerosols: 0 } },
];
const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fr(Math.abs(n), digits)}`;
const MIN = 6;
const MAX = 24;

export function ClimateLab() {
  const [input, setInput] = useState<ClimateInput>(TODAY);
  const result = climate(input);
  const set = (key: keyof ClimateInput) => (v: number) => setInput((prev) => ({ ...prev, [key]: v }));
  const at = (t: number) => `${Math.min(100, Math.max(0, ((t - MIN) / (MAX - MIN)) * 100))}%`;
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
      <section className="card order-2 space-y-5 p-5 md:order-none" aria-label="Réglages du climat">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <button key={p.name} type="button" onClick={() => setInput(p.input)} className="inline-flex min-h-9 items-center rounded-lg bg-white px-2.5 text-sm font-medium ring-1 ring-line hover:ring-ink">{p.name}</button>)}
        </div>
        <Slider id="co2" label="CO₂ dans l’air" display={`${input.co2} ppm`} hint="280 avant l’industrie, environ 425 aujourd’hui" min={180} max={1200} step={5} value={input.co2} onChange={set("co2")} />
        <Slider id="albedo" label="Albédo" display={`${fr(input.albedo * 100)} %`} hint="part de la lumière renvoyée par les nuages, la glace, les sols clairs" min={0.28} max={0.32} step={0.002} value={input.albedo} onChange={set("albedo")} />
        <Slider id="soleil" label="Puissance du Soleil" display={`${signed(input.sun)} %`} hint="elle varie d’environ 0,1 % au cours d’un cycle solaire" min={-2} max={2} step={0.1} value={input.sun} onChange={set("sun")} />
        <Slider id="aerosols" label="Aérosols" display={`${signed(input.aerosols)} W/m²`} hint="particules de pollution ou de volcans, qui font de l’ombre" min={-2} max={0} step={0.1} value={input.aerosols} onChange={set("aerosols")} />
      </section>
      <section className="card order-1 space-y-4 p-5" aria-live="polite">
        <div>
          <p className="label-mono text-accent">Température moyenne à l’équilibre</p>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums">{fr(result.temp)} °C</p>
          <p className="text-sm text-soft"><span className={`font-semibold ${result.delta > 0.05 ? "text-accent" : "text-ink"}`}>{signed(result.delta)} °C</span> par rapport à l’ère préindustrielle</p>
        </div>
        <div className="relative h-9" role="img" aria-label={`Thermomètre de ${MIN} à ${MAX} degrés : ${fr(result.temp)} degrés`}>
          <div className="absolute inset-x-0 top-3 h-3 rounded-full" style={{ background: "linear-gradient(90deg,#7FA8D8,#DCE5EC 35%,#F0D9A8 60%,#D9603A)" }} />
          <span className="absolute top-1.5 h-6 w-px bg-ink" style={{ left: at(14) }} />
          <span className="absolute top-0 h-9 w-1.5 -translate-x-1/2 rounded-full bg-ink ring-2 ring-white" style={{ left: at(result.temp) }} />
        </div>
        <p className="-mt-2 flex justify-between font-mono text-[11px] text-muted"><span>{MIN} °C</span><span>trait : 14 °C</span><span>{MAX} °C</span></p>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Effet du CO₂" value={`${signed(result.parts.co2, 2)} W/m²`} />
          <Stat label="Effet de l’albédo" value={`${signed(result.parts.albedo, 2)} W/m²`} />
          <Stat label="Effet du Soleil" value={`${signed(result.parts.sun, 2)} W/m²`} />
          <Stat label="Effet des aérosols" value={`${signed(result.parts.aerosols, 2)} W/m²`} />
        </dl>
        <p className="text-sm text-soft">Sans aucun effet de serre, avec cet albédo, la Terre serait à <strong className="font-semibold text-ink">{fr(bareTemp(input.albedo, input.sun), 0).replace("-", "−")} °C</strong> : c’est l’effet de serre naturel qui la rend habitable.</p>
      </section>
    </div>
  );
}
