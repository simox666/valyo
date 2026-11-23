"use client";

import { useEffect, useRef, useState } from "react";
import { Choice, Slider, Stat, fr } from "@/components/sim/ui";
import { seededRandom } from "@/lib/jeux/tirage.ts";
import { accuracy, createNet, dataset, predict, trainStep, type Net, type Point } from "@/lib/simulateurs/neurone.ts";

const SIZE = 360;
const CELLS = 36;
const BLUE = [47, 110, 170];
const ORANGE = [214, 96, 40];
const SETS = [{ value: "groupes", label: "Deux groupes" }, { value: "cercle", label: "Un cercle" }, { value: "damier", label: "Un damier" }] as const;
const CLASSES = [{ value: 0, label: "Poser du bleu" }, { value: 1, label: "Poser de l’orange" }] as const;

export function NeuronLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const net = useRef<Net>(createNet(0, seededRandom("reseau")));
  const points = useRef<Point[]>(dataset("groupes", seededRandom("points")));
  const [hidden, setHidden] = useState(0);
  const [brush, setBrush] = useState<0 | 1>(0);
  const [stats, setStats] = useState({ acc: 0, loss: 0, count: points.current.length, steps: 0 });
  const steps = useRef(0);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;
    const loop = () => {
      let loss = 0;
      for (let k = 0; k < 12; k++) loss = trainStep(net.current, points.current, 0.4);
      steps.current += 12;
      const cell = SIZE / CELLS;
      for (let cx = 0; cx < CELLS; cx++) {
        for (let cy = 0; cy < CELLS; cy++) {
          const p = predict(net.current, ((cx + 0.5) / CELLS) * 2 - 1, 1 - ((cy + 0.5) / CELLS) * 2);
          const mix = BLUE.map((b, k) => Math.round(b + (ORANGE[k] - b) * p));
          ctx.fillStyle = `rgba(${mix[0]}, ${mix[1]}, ${mix[2]}, ${0.25 + Math.abs(p - 0.5) * 0.9})`;
          ctx.clearRect(cx * cell, cy * cell, cell, cell);
          ctx.fillRect(cx * cell, cy * cell, cell, cell);
        }
      }
      for (const pt of points.current) {
        ctx.beginPath();
        ctx.arc(((pt.x + 1) / 2) * SIZE, ((1 - pt.y) / 2) * SIZE, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = pt.label ? `rgb(${ORANGE})` : `rgb(${BLUE})`;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      }
      if (frame++ % 8 === 0) setStats({ acc: accuracy(net.current, points.current), loss, count: points.current.length, steps: steps.current });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reset = (h: number) => { net.current = createNet(h, Math.random); steps.current = 0; };
  function tap(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const y = 1 - ((event.clientY - box.top) / box.height) * 2;
    if (points.current.length < 300) points.current = [...points.current, { x, y, label: brush }];
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
      <section className="card order-2 space-y-5 p-5 md:order-none" aria-label="Réglages du réseau">
        <div><p className="label-mono mb-2 text-accent">Points d’exemple</p>
          <Choice label="Points d’exemple" options={SETS} value={null} onChange={(kind) => { points.current = dataset(kind, Math.random); reset(hidden); }} /></div>
        <div><p className="label-mono mb-2 text-accent">Votre doigt</p><Choice label="Couleur à poser" options={CLASSES} value={brush} onChange={(v) => setBrush(v as 0 | 1)} /></div>
        <Slider id="caches" label="Neurones cachés" display={String(hidden)} hint={hidden === 0 ? "aucun : le réseau ne trace qu’une droite" : "chacun ajoute un pli à la frontière"} min={0} max={8} step={1} value={hidden} onChange={(h) => { setHidden(h); reset(h); }} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => reset(hidden)} className="btn-secondary px-3 py-2">Réapprendre de zéro</button>
          <button type="button" onClick={() => { points.current = []; reset(hidden); }} className="btn-secondary px-3 py-2">Effacer les points</button>
        </div>
      </section>
      <section className="card order-1 overflow-hidden">
        <canvas ref={canvas} width={SIZE} height={SIZE} onPointerDown={tap} role="img" aria-label="Zone d’apprentissage : touchez pour poser un point"
          className="mx-auto block aspect-square w-full max-w-[440px] cursor-crosshair touch-manipulation bg-paper" />
        <dl className="grid grid-cols-3 gap-2 p-4" aria-live="off">
          <Stat label="Points bien classés" value={stats.count ? `${Math.round(stats.acc * 100)} %` : "—"} detail={`${stats.count} points`} />
          <Stat label="Erreur" value={fr(stats.loss, 3)} detail="plus c’est bas, mieux c’est" />
          <Stat label="Essais" value={fr(stats.steps, 0)} detail="pas d’apprentissage" />
        </dl>
        <p className="border-t border-hairline px-5 py-3 text-sm text-soft">
          {hidden === 0 ? "Essayez « Un cercle » ou « Un damier » : une simple droite ne peut pas séparer ces points. Ajoutez des neurones cachés." : "Le fond montre ce que le réseau a appris : la couleur qu’il donnerait à un nouveau point posé à cet endroit."}
        </p>
      </section>
    </div>
  );
}
