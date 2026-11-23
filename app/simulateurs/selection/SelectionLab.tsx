"use client";

import { useMemo, useRef, useState } from "react";
import { Slider, Stat, fr } from "@/components/sim/ui";
import { seededRandom } from "@/lib/jeux/tirage.ts";
import { POPULATION, initialPopulation, meanColour, nextGeneration } from "@/lib/simulateurs/selection.ts";

const W = 400;
const H = 190;
// 0 = sable clair, 1 = presque noir.
const shade = (c: number) => `hsl(32 18% ${Math.round(88 - c * 72)}%)`;
const name = (c: number) => (c < 0.25 ? "très clair" : c < 0.45 ? "clair" : c < 0.6 ? "moyen" : c < 0.8 ? "foncé" : "très foncé");

export function SelectionLab() {
  const random = useRef(seededRandom("selection-valyo"));
  const [pop, setPop] = useState(() => initialPopulation(seededRandom("depart")));
  const [history, setHistory] = useState<number[]>(() => [meanColour(initialPopulation(seededRandom("depart")))]);
  const [eaten, setEaten] = useState(0);
  const [background, setBackground] = useState(0.85);
  const [pressure, setPressure] = useState(0.7);
  const [mutation, setMutation] = useState(0.05);
  const spots = useMemo(() => { const r = seededRandom("places"); return Array.from({ length: POPULATION }, () => ({ x: 14 + r() * (W - 28), y: 14 + r() * (H - 28) })); }, []);

  function advance(generations: number) {
    let current = pop;
    let last = 0;
    const means: number[] = [];
    for (let g = 0; g < generations; g++) {
      const step = nextGeneration(current, { background, pressure, mutation }, random.current);
      current = step.next;
      last = step.eaten;
      means.push(meanColour(current));
    }
    setPop(current);
    setEaten(last);
    setHistory((h) => [...h, ...means].slice(-200));
  }
  function restart() {
    const fresh = initialPopulation(seededRandom("depart"));
    random.current = seededRandom("selection-valyo");
    setPop(fresh); setHistory([meanColour(fresh)]); setEaten(0);
  }
  const mean = meanColour(pop);
  const chart = history.map((m, k) => `${k ? "L" : "M"}${((k / Math.max(1, history.length - 1)) * W).toFixed(1)} ${(60 - m * 60).toFixed(1)}`).join(" ");

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
      <section className="card order-2 space-y-5 p-5 md:order-none" aria-label="Réglages du milieu">
        <Slider id="decor" label="Couleur du décor" display={name(background)} hint="un tronc clair couvert de lichen, ou noirci par la suie" min={0} max={1} step={0.05} value={background} onChange={setBackground} />
        <Slider id="predateurs" label="Pression des prédateurs" display={`${Math.round(pressure * 100)} %`} min={0} max={1} step={0.05} value={pressure} onChange={setPressure} />
        <Slider id="mutation" label="Variation entre parents et petits" display={`${Math.round(mutation * 100)} %`} hint="sans variation, la population ne peut pas changer" min={0} max={0.2} step={0.01} value={mutation} onChange={setMutation} />
      </section>
      <section className="card order-1 overflow-hidden" aria-live="polite">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Population de teinte moyenne ${name(mean)} sur un décor ${name(background)}`} className="block h-auto w-full">
          <rect width={W} height={H} fill={shade(background)} />
          {pop.map((c, k) => <ellipse key={k} cx={spots[k].x} cy={spots[k].y} rx="8" ry="5.5" fill={shade(c)} stroke="#1B2430" strokeOpacity="0.25" strokeWidth="0.8" />)}
        </svg>
        <div className="flex flex-wrap gap-2 border-t border-hairline px-5 py-3">
          <button type="button" onClick={() => advance(1)} className="btn-primary px-3 py-2">Génération suivante</button>
          <button type="button" onClick={() => advance(10)} className="btn-secondary px-3 py-2">+ 10 générations</button>
          <button type="button" onClick={restart} className="btn-secondary px-3 py-2">Recommencer</button>
        </div>
        <dl className="grid grid-cols-3 gap-2 px-4 pb-4">
          <Stat label="Génération" value={String(history.length - 1)} />
          <Stat label="Teinte moyenne" value={name(mean)} detail={`écart au décor : ${fr(Math.abs(mean - background) * 100, 0)} %`} />
          <Stat label="Mangés" value={`${eaten} / ${POPULATION}`} detail="à la dernière génération" />
        </dl>
        <div className="border-t border-hairline px-5 py-4">
          <p className="label-mono">Teinte moyenne au fil des générations</p>
          <svg viewBox={`0 -4 ${W} 68`} className="mt-2 h-auto w-full text-ink" role="img" aria-label="Évolution de la teinte moyenne, comparée à celle du décor">
            <path d={`M0 ${60 - background * 60} H${W}`} stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
            <g className="text-accent"><path d={chart} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></g>
          </svg>
          <p className="mt-1 text-xs text-muted">En pointillé : la teinte du décor. Foncé en haut, clair en bas.</p>
        </div>
      </section>
    </div>
  );
}
