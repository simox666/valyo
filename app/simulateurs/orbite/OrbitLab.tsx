"use client";

import { useMemo, useState } from "react";
import { Choice, Slider, Stat, fr } from "@/components/sim/ui";
import { ALTITUDES, ATMOSPHERE, R_EARTH, fly } from "@/lib/simulateurs/orbite.ts";

const VERDICT = {
  retombe: { title: "L’engin retombe", text: "Il ne va pas assez vite : sa trajectoire recoupe l’atmosphère avant d’avoir fait le tour de la Terre." },
  orbite: { title: "En orbite", text: "Il tombe en permanence, mais va assez vite pour que le sol se dérobe sous lui : il tourne sans moteur." },
  evasion: { title: "Il quitte la Terre", text: "Il dépasse la vitesse de libération : la gravité le ralentit sans jamais le faire revenir." },
} as const;

export function OrbitLab() {
  const [speed, setSpeed] = useState(7.7);
  const [altitude, setAltitude] = useState<number>(400);
  const flight = useMemo(() => fly(speed, altitude), [speed, altitude]);
  const r0 = R_EARTH + altitude;
  const extent = Math.max(r0 * 1.2, ...flight.path.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))) * 1.06;
  const d = flight.path.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(0)} ${(-y).toFixed(0)}`).join(" ");
  const verdict = VERDICT[flight.outcome];
  const period = flight.periodMin;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
      <section className="card order-2 space-y-5 p-5 md:order-none" aria-label="Réglages du lancement">
        <div>
          <p className="label-mono mb-2 text-accent">Altitude de départ</p>
          <Choice label="Altitude de départ" options={ALTITUDES.map((a) => ({ value: a.km, label: a.label }))} value={altitude} onChange={setAltitude} />
        </div>
        <Slider id="vitesse" label="Vitesse de lancement" display={`${fr(speed)} km/s`} hint={`soit ${fr(speed * 3600, 0)} km/h`} min={0} max={12} step={0.1} value={speed} onChange={setSpeed} />
        <div className="space-y-2 text-sm">
          <button type="button" onClick={() => setSpeed(Math.round(flight.circular * 10) / 10)} className="btn-secondary w-full justify-between px-3 py-2">
            <span className="text-left">Vitesse d’orbite circulaire</span><span className="shrink-0 whitespace-nowrap font-mono text-accent">{fr(flight.circular, 2)} km/s</span>
          </button>
          <button type="button" onClick={() => setSpeed(Math.min(12, Math.ceil(flight.escape * 10) / 10))} className="btn-secondary w-full justify-between px-3 py-2">
            <span className="text-left">Vitesse de libération</span><span className="shrink-0 whitespace-nowrap font-mono text-accent">{fr(flight.escape, 2)} km/s</span>
          </button>
        </div>
      </section>

      <section className="card order-1 overflow-hidden" aria-live="polite">
        <div className="px-5 pt-5">
          <p className="label-mono text-accent">Résultat</p>
          <h2 className="mt-1 text-xl font-bold">{verdict.title}</h2>
          <p className="mt-1 text-sm text-soft">{verdict.text}</p>
        </div>
        <svg viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`} role="img" aria-label={`Trajectoire : ${verdict.title}`} className="mx-auto block aspect-square w-full max-w-[440px] text-ink">
          <circle r={R_EARTH + ATMOSPHERE} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" vectorEffect="non-scaling-stroke" />
          <circle r={R_EARTH} fill="#5B8DB8" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path d={`M${-R_EARTH * 0.5} ${-R_EARTH * 0.2} q${R_EARTH * 0.2} ${-R_EARTH * 0.5} ${R_EARTH * 0.6} ${-R_EARTH * 0.3} q${-R_EARTH * 0.1} ${R_EARTH * 0.5} ${-R_EARTH * 0.4} ${R_EARTH * 0.6} Z`} fill="#8DB580" opacity="0.8" />
          <g className="text-accent">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle key={d} r={extent * 0.022} fill="currentColor">
              <animateMotion dur="7s" repeatCount="indefinite" path={d} />
            </circle>
          </g>
          <circle cx="0" cy={-r0} r={extent * 0.014} fill="currentColor" />
        </svg>
        <dl className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {flight.outcome === "orbite" && period !== null && (
            <>
              <Stat label="Point le plus bas" value={`${fr(flight.perigee, 0)} km`} />
              <Stat label="Point le plus haut" value={`${fr(flight.apogee ?? 0, 0)} km`} />
              <Stat label="Un tour en" value={period < 120 ? `${fr(period, 0)} min` : `${fr(period / 60)} h`} detail={Math.abs(period - 1436) < 20 ? "un jour : il reste au-dessus du même point" : undefined} />
            </>
          )}
          {flight.outcome === "retombe" && (
            <>
              <Stat label="Distance au sol" value={`${fr(flight.groundKm ?? 0, 0)} km`} detail="avant de toucher terre" />
              <Stat label="Il manque" value={`${fr(Math.max(0, flight.circular - speed), 2)} km/s`} detail="pour une orbite circulaire" />
            </>
          )}
          {flight.outcome === "evasion" && <Stat label="Au-delà de" value={`${fr(flight.escape, 2)} km/s`} detail="la vitesse de libération à cette altitude" />}
        </dl>
      </section>
    </div>
  );
}
