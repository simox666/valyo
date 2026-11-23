"use client";

import { useEffect, useRef, useState } from "react";
import { Choice, Slider, fr } from "@/components/sim/ui";
import { sample, type SlitMode } from "@/lib/simulateurs/fentes.ts";

const W = 640;
const H = 320;
const SCREEN = 200; // hauteur de la zone d'impacts ; l'histogramme est dessous
const BINS = 128;
const MAX = 60000;
const MODES = [{ value: "deux", label: "Deux fentes" }, { value: "une", label: "Une seule fente" }, { value: "observe", label: "Deux fentes, observées" }] as const;
const RATES = [{ value: 0.2, label: "Une à une" }, { value: 4, label: "Rapide" }, { value: 60, label: "Très rapide" }] as const;
const EXPLAIN: Record<SlitMode, string> = {
  deux: "Chaque particule arrive en un seul point, mais pas n’importe où : certaines bandes ne sont jamais touchées. Tout se passe comme si chacune était passée par les deux fentes à la fois.",
  une: "Avec une seule fente, pas de franges : une simple tache, plus dense au centre.",
  observe: "Dès qu’on sait par quelle fente chaque particule est passée, les franges disparaissent : on retrouve la somme de deux taches.",
};

export function SlitsLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<SlitMode>("deux");
  const [separation, setSeparation] = useState(4);
  const [rate, setRate] = useState<number>(4);
  const [count, setCount] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const style = getComputedStyle(document.documentElement);
    const ink = `rgb(${style.getPropertyValue("--c-ink").trim().replace(/ /g, ", ")})`;
    const accent = `rgb(${style.getPropertyValue("--c-accent").trim().replace(/ /g, ", ")})`;
    const bins = new Array(BINS).fill(0);
    let total = 0;
    let carry = 0;
    let frame = 0;
    ctx.clearRect(0, 0, W, H);
    let raf = 0;
    const loop = () => {
      carry += rate;
      const n = Math.min(Math.floor(carry), MAX - total);
      carry -= Math.floor(carry);
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.55;
      for (let k = 0; k < n; k++) {
        const u = sample(Math.random, { mode, separation });
        const x = ((u + 1) / 2) * W;
        ctx.fillRect(x - 1, Math.random() * (SCREEN - 4) + 2, 2, 2);
        bins[Math.min(BINS - 1, Math.floor(((u + 1) / 2) * BINS))]++;
      }
      total += n;
      if (n) {
        const top = Math.max(...bins, 1);
        ctx.globalAlpha = 1;
        ctx.clearRect(0, SCREEN, W, H - SCREEN);
        ctx.fillStyle = accent;
        for (let b = 0; b < BINS; b++) {
          const h = (bins[b] / top) * (H - SCREEN - 12);
          ctx.fillRect((b * W) / BINS, H - h, W / BINS - 1, h);
        }
      }
      if (frame++ % 6 === 0) setCount(total);
      if (total < MAX) raf = requestAnimationFrame(loop);
      else setCount(total);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, separation, rate, run]);

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <canvas ref={canvas} width={W} height={H} role="img" aria-label="Écran : impacts des particules et leur répartition" className="block w-full bg-paper" />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3">
          <p className="text-sm" aria-live="polite"><span className="font-mono font-semibold tabular-nums text-accent">{fr(count, 0)}</span> particule{count > 1 ? "s" : ""} reçue{count > 1 ? "s" : ""}</p>
          <button type="button" onClick={() => setRun((r) => r + 1)} className="btn-secondary px-3 py-2">Vider l’écran</button>
        </div>
        <p className="border-t border-hairline px-5 py-3 text-sm text-soft">{EXPLAIN[mode]}</p>
      </section>
      <section className="card space-y-5 p-5" aria-label="Réglages de l’expérience">
        <div><p className="label-mono mb-2 text-accent">Montage</p><Choice label="Montage" options={MODES} value={mode} onChange={setMode} /></div>
        <div><p className="label-mono mb-2 text-accent">Cadence</p><Choice label="Cadence" options={RATES} value={rate} onChange={setRate} /></div>
        {mode === "deux" && <Slider id="ecart" label="Écart entre les fentes" display={`${separation} largeurs de fente`} hint="plus les fentes sont écartées, plus les franges sont serrées" min={2} max={8} step={1} value={separation} onChange={setSeparation} />}
      </section>
    </div>
  );
}
