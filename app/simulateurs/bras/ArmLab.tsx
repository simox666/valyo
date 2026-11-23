"use client";

import { useRef, useState } from "react";
import { Slider, Stat } from "@/components/sim/ui";
import { solve, type Vec } from "@/lib/simulateurs/bras.ts";

const REACH = 240;
const VIEW = { x: -270, y: -270, w: 540, h: 310 }; // en coordonnées SVG (y vers le bas) : base en (0, 0)

export function ArmLab() {
  const [segments, setSegments] = useState(3);
  const [target, setTarget] = useState<Vec>({ x: 130, y: 120 });
  const pose = useRef<Vec[] | undefined>(undefined);
  const lengths = Array.from({ length: segments }, () => REACH / segments);
  const result = solve(lengths, target, pose.current);
  pose.current = result.joints;

  function move(event: React.PointerEvent<SVGSVGElement>) {
    if (event.type === "pointermove" && event.buttons === 0 && event.pointerType === "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = VIEW.x + ((event.clientX - box.left) / box.width) * VIEW.w;
    const y = -(VIEW.y + ((event.clientY - box.top) / box.height) * VIEW.h);
    setTarget({ x: Math.round(x), y: Math.round(Math.max(-20, y)) });
  }
  const arm = result.joints.map((j, k) => `${k ? "L" : "M"}${j.x.toFixed(1)} ${(-j.y).toFixed(1)}`).join(" ");
  const tip = result.joints[result.joints.length - 1];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
      <section className="card order-2 space-y-5 p-5 md:order-none" aria-label="Réglages du bras">
        <Slider id="segments" label="Nombre de segments" display={String(segments)} hint="la longueur totale du bras reste la même" min={2} max={5} step={1} value={segments} onChange={(n) => { pose.current = undefined; setSegments(n); }} />
        <div>
          <p className="label-mono text-accent">Angles calculés</p>
          <ol className="mt-2 space-y-1 text-sm">
            {result.angles.map((a, k) => (
              <li key={k} className="flex justify-between gap-3"><span className="text-soft">{k === 0 ? "Épaule (depuis la verticale)" : `Articulation ${k + 1}`}</span><span className="font-mono tabular-nums">{a > 0 ? "+" : a < 0 ? "−" : ""}{Math.abs(a)}°</span></li>
            ))}
          </ol>
        </div>
      </section>
      <section className="card order-1 overflow-hidden">
        <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} onPointerDown={move} onPointerMove={move} role="img" aria-label="Bras articulé : touchez pour déplacer la cible"
          className="block h-auto w-full cursor-crosshair touch-none select-none bg-paper text-ink">
          <path d={`M${-REACH} 0 A${REACH} ${REACH} 0 0 1 ${REACH} 0`} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" opacity="0.35" />
          <path d={`M${VIEW.x} 0 H${VIEW.x + VIEW.w}`} stroke="currentColor" strokeWidth="1.5" />
          <path d="M-22 0 h44 l-8 -14 h-28 Z" fill="currentColor" />
          <path d={arm} fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          {result.joints.map((j, k) => <circle key={k} cx={j.x} cy={-j.y} r={k === result.joints.length - 1 ? 5 : 7} className="fill-white" stroke="currentColor" strokeWidth="3" />)}
          <g className="text-accent" stroke="currentColor" strokeWidth="2.5" fill="none">
            <circle cx={target.x} cy={-target.y} r="11" />
            <path d={`M${target.x - 17} ${-target.y} h34 M${target.x} ${-target.y - 17} v34`} />
          </g>
          {!result.reachable && <path d={`M${tip.x} ${-tip.y} L${target.x} ${-target.y}`} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />}
        </svg>
        <dl className="grid grid-cols-2 gap-2 p-4" aria-live="polite">
          <Stat label="Cible" value={result.reachable ? "à portée" : "hors de portée"} detail={result.reachable ? "la pince la touche" : "le bras se tend au maximum vers elle"} />
          <Stat label="Solutions possibles" value={segments === 2 ? "2" : "une infinité"} detail={segments === 2 ? "coude plié d’un côté ou de l’autre" : "le bras en choisit une proche de sa pose"} />
        </dl>
      </section>
    </div>
  );
}
