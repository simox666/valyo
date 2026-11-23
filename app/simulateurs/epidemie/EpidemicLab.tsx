"use client";

import { useMemo, useState } from "react";
import { Choice, Slider, Stat, fr } from "@/components/sim/ui";
import { DISEASES, outbreak } from "@/lib/simulateurs/epidemie.ts";

const W = 400;
const H = 180;
const DOTS = 200;

export function EpidemicLab() {
  const [r0, setR0] = useState(2.8);
  const [vaccinated, setVaccinated] = useState(0);
  const [isolation, setIsolation] = useState(0);
  const result = useMemo(() => outbreak({ r0, vaccinated: vaccinated / 100, isolation: isolation / 100 }), [r0, vaccinated, isolation]);
  const days = Math.max(60, result.days);
  const line = (key: "s" | "i" | "r") => result.series.map((p, k) => `${k ? "L" : "M"}${((p.day / days) * W).toFixed(1)} ${(H - p[key] * H).toFixed(1)}`).join(" ");
  const vaccDots = Math.round((vaccinated / 100) * DOTS);
  const sickDots = Math.min(DOTS - vaccDots, Math.round(result.attack * DOTS));
  const started = result.reproduction > 1;
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
      <section className="card order-2 space-y-5 p-5 md:order-none" aria-label="Réglages de l’épidémie">
        <div><p className="label-mono mb-2 text-accent">Maladie</p>
          <Choice label="Maladie" options={DISEASES.map((d) => ({ value: d.r0, label: d.name }))} value={DISEASES.some((d) => d.r0 === r0) ? r0 : null} onChange={setR0} /></div>
        <Slider id="r0" label="Contagiosité (R0)" display={fr(r0)} hint="personnes contaminées par un malade, si personne n’est protégé" min={0.5} max={18} step={0.1} value={r0} onChange={setR0} />
        <Slider id="vaccin" label="Population vaccinée" display={`${vaccinated} %`} min={0} max={95} step={1} value={vaccinated} onChange={setVaccinated} />
        <Slider id="isolement" label="Réduction des contacts" display={`${isolation} %`} hint="isolement des malades, gestes barrières, télétravail" min={0} max={80} step={5} value={isolation} onChange={setIsolation} />
      </section>
      <section className="card order-1 space-y-4 p-5" aria-live="polite">
        <div>
          <p className="label-mono text-accent">Résultat</p>
          <h2 className="mt-1 text-xl font-bold">{!started ? "L’épidémie ne démarre pas" : result.attack > 0.5 ? "Une grande vague" : "Une vague limitée"}</h2>
          <p className="mt-1 text-sm text-soft">
            {started
              ? `Chaque malade contamine ${fr(result.reproduction)} personnes au début : le nombre de cas grandit, puis retombe quand il ne reste plus assez de personnes à contaminer.`
              : `Chaque malade contamine moins d’une personne (${fr(result.reproduction, 2)}) : les quelques cas s’éteignent d’eux-mêmes.`}
          </p>
        </div>
        <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Courbes des personnes saines, malades et rétablies au fil des jours" className="h-auto w-full text-ink">
          <path d={`M0 ${H} H${W}`} stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <path d={line("s")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
          <path d={line("r")} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
          <g className="text-accent"><path d={line("i")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /></g>
          <text x="0" y={H + 14} fontSize="10" className="fill-current font-mono" opacity="0.7">jour 0</text>
          <text x={W} y={H + 14} fontSize="10" textAnchor="end" className="fill-current font-mono" opacity="0.7">jour {Math.round(days)}</text>
        </svg>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft">
          <li><span aria-hidden className="mr-1.5 inline-block h-0.5 w-5 bg-accent align-middle" />malades au même moment</li>
          <li><span aria-hidden className="mr-1.5 inline-block h-0.5 w-5 bg-ink align-middle" />rétablis</li>
          <li><span aria-hidden className="mr-1.5 inline-block w-5 border-t border-dashed border-ink align-middle" />jamais touchés</li>
        </ul>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Au pic" value={`${fr(result.peak * 100)} %`} detail={started ? `malades en même temps, vers le jour ${result.peakDay}` : "malades en même temps"} />
          <Stat label="Au total" value={`${fr(result.attack * 100)} %`} detail="de la population infectée" />
          <Stat label="Immunité collective" value={result.herd > 0 ? `${fr(result.herd * 100, 0)} %` : "inutile"} detail={result.herd > 0 ? "de vaccinés pour bloquer la maladie" : "la maladie s’éteint seule"} />
          <Stat label="Sur 200 personnes" value={`${sickDots} infectées`} detail={`${vaccDots} vaccinées, ${DOTS - vaccDots - sickDots} épargnées`} />
        </dl>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(25, minmax(0, 1fr))" }} role="img" aria-label={`Sur 200 personnes : ${sickDots} infectées, ${vaccDots} vaccinées, ${DOTS - vaccDots - sickDots} épargnées`}>
          {Array.from({ length: DOTS }, (_, k) => (
            <span key={k} className={`aspect-square rounded-full ${k < sickDots ? "bg-accent" : k < sickDots + vaccDots ? "bg-success" : "bg-line-strong"}`} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft">
          <li><span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />infectées</li>
          <li><span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-success align-middle" />vaccinées</li>
          <li><span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-line-strong align-middle" />épargnées</li>
        </ul>
      </section>
    </div>
  );
}
