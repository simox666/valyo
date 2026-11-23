"use client";

import { useState } from "react";
import { fr } from "@/components/sim/ui";
import { elsewhere } from "@/lib/simulateurs/poids-age.ts";

export function WeightAgeLab() {
  const [weight, setWeight] = useState(70);
  const [age, setAge] = useState(30);
  const safeWeight = Math.min(300, Math.max(1, weight || 0));
  const safeAge = Math.min(120, Math.max(0, age || 0));
  const rows = elsewhere(safeWeight, safeAge);
  return (
    <div className="space-y-5">
      <section className="card grid grid-cols-2 gap-4 p-5" aria-label="Vos mesures sur Terre">
        <label className="block"><span className="label">Votre poids sur Terre (kg)</span>
          <input type="number" inputMode="decimal" min={1} max={300} value={weight || ""} onChange={(e) => setWeight(Number(e.target.value))} className="field" /></label>
        <label className="block"><span className="label">Votre âge (années)</span>
          <input type="number" inputMode="numeric" min={0} max={120} value={age || ""} onChange={(e) => setAge(Number(e.target.value))} className="field" /></label>
      </section>
      <section className="card overflow-x-auto" aria-live="polite">
        <table className="w-full min-w-[26rem] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th scope="col" className="label-mono px-4 py-3">Astre</th>
              <th scope="col" className="label-mono px-3 py-3 text-right">La balance affiche</th>
              <th scope="col" className="label-mono px-3 py-3 text-right">Votre âge</th>
              <th scope="col" className="label-mono px-4 py-3 text-right">Un saut de 40 cm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-hairline last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-semibold">{r.name}</th>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fr(r.scale)} kg</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.age === null ? <span className="text-muted">comme sur Terre</span> : r.age < 1 ? `${fr(r.age, 2)} an` : `${fr(r.age, r.age < 10 ? 1 : 0)} ans`}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{r.jump >= 1 ? `${fr(r.jump)} m` : `${fr(r.jump * 100, 0)} cm`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
