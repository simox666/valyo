"use client";

import { useState } from "react";
import { Slider, Stat, fr } from "@/components/sim/ui";
import { MIX_PRESETS, SOURCES, evaluate, type Mix, type SourceKey } from "@/lib/simulateurs/mix.ts";

// Une couleur fixe par source, lisible en clair comme en sombre.
const COLOURS: Record<SourceKey, string> = { nucleaire: "#8B6FC0", eolien: "#4FA8A0", solaire: "#E0A93B", hydraulique: "#4F86C6", gaz: "#C2704A", charbon: "#6B6F76" };

export function MixLab() {
  const [mix, setMix] = useState<Mix>(MIX_PRESETS[0].mix);
  const result = evaluate(mix);
  const coverage = Math.round(result.coverage * 100);
  const verdict =
    result.shares.every((s) => s.share === 0) ? "Aucune production : montez au moins un curseur."
    : coverage >= 100 ? "Le pays passe la soirée sans aide : ses moyens disponibles couvrent la pointe."
    : coverage >= 80 ? `Il manque ${100 - coverage} % de la puissance : il faut importer, vider des barrages ou demander aux gros consommateurs de s’effacer.`
    : `Il manque ${100 - coverage} % de la puissance : sans stockage massif ou centrales de secours, ce sont des coupures.`;
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
      <section className="card order-2 space-y-4 p-5 md:order-none" aria-label="Composition du mix">
        <div className="flex flex-wrap gap-1.5">
          {MIX_PRESETS.map((p) => <button key={p.name} type="button" onClick={() => setMix(p.mix)} className="inline-flex min-h-9 items-center rounded-lg bg-white px-2.5 text-sm font-medium ring-1 ring-line hover:ring-ink">{p.name}</button>)}
        </div>
        {result.shares.map((s) => (
          <Slider key={s.key} id={s.key} label={s.name} display={`${Math.round(s.share * 100)} %`} min={0} max={100} step={1} value={mix[s.key]} onChange={(v) => setMix((m) => ({ ...m, [s.key]: v }))} />
        ))}
        <p className="text-xs text-muted">Les pourcentages sont recalculés pour que le total fasse toujours 100 %.</p>
      </section>
      <section className="card order-1 space-y-4 p-5" aria-live="polite">
        <div>
          <p className="label-mono text-accent">Production de l’année</p>
          <div className="mt-2 flex h-7 overflow-hidden rounded-md ring-1 ring-line" role="img" aria-label={result.shares.filter((s) => s.share > 0).map((s) => `${s.name} ${Math.round(s.share * 100)} %`).join(", ")}>
            {result.shares.filter((s) => s.share > 0).map((s) => <span key={s.key} style={{ width: `${s.share * 100}%`, backgroundColor: COLOURS[s.key] }} />)}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-soft">
            {SOURCES.map((s) => <li key={s.key} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOURS[s.key] }} />{s.name}</li>)}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="CO₂ émis" value={`${fr(result.co2, 0)} g/kWh`} detail={result.co2 < 100 ? "très bas" : result.co2 < 300 ? "moyen" : "élevé"} />
          <Stat label="Sources bas-carbone" value={`${Math.round(result.lowCarbon * 100)} %`} />
        </dl>
        <div>
          <p className="label-mono text-accent">Un soir d’hiver sans vent</p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-chip"><div className={`h-full ${coverage >= 100 ? "bg-success" : "bg-accent"}`} style={{ width: `${Math.min(100, coverage)}%` }} /></div>
          <p className="mt-2 text-sm"><span className="font-display text-lg font-bold">{coverage} %</span> <span className="text-soft">de la demande de pointe est couverte.</span></p>
          <p className="mt-1 text-sm text-soft">{verdict}</p>
        </div>
      </section>
    </div>
  );
}
