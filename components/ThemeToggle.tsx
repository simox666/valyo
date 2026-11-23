"use client";

import { useEffect, useState } from "react";

type Choice = "auto" | "clair" | "sombre";
const KEY = "valyo:apparence";
const LABELS: Record<Choice, string> = { auto: "Auto", clair: "Clair", sombre: "Sombre" };

/** Réglage « Apparence » : suit l'appareil (auto) ou force le clair / le sombre sur ce navigateur. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("auto");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "clair" || saved === "sombre") setChoice(saved);
    } catch { /* stockage indisponible : on reste en automatique */ }
  }, []);
  function pick(next: Choice) {
    setChoice(next);
    const root = document.documentElement;
    if (next === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next === "sombre" ? "dark" : "light");
    try {
      if (next === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch { /* le choix vaut au moins pour cette page */ }
  }
  return (
    <div role="group" aria-label="Apparence" className="mt-3 inline-flex items-center gap-1">
      <span className="mr-1">Apparence</span>
      {(Object.keys(LABELS) as Choice[]).map((c) => (
        <button key={c} type="button" aria-pressed={choice === c} onClick={() => pick(c)}
          className={`rounded-md px-2.5 py-1.5 ${choice === c ? "bg-white font-semibold text-ink ring-1 ring-line" : "hover:text-ink"}`}>
          {LABELS[c]}
        </button>
      ))}
    </div>
  );
}
