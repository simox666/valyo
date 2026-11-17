"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeTile } from "./ThemeTile";

// Progression visible partout : un encart dans le menu de gauche (série, prochain palier) et un
// toast quand un palier est atteint. Les paliers viennent de /api/progres (lib/social/progress.ts).

type Unlock = { key: string; kind: "element" | "niveau" | "badge"; symbol: string; title: string; detail: string; slug?: string };
export type ProgressData = {
  streak: { current: number; best: number; activeThisWeek: boolean };
  goal: { label: string; detail: string } | null;
  elements: number;
  totalElements: number;
  unseen: Unlock[];
};

const MIN_INTERVAL = 15000;

/** Recharge la progression à chaque changement de page (au plus toutes les 15 s) et au retour sur l'onglet. */
export function useProgress(enabled: boolean, pathname: string) {
  const [data, setData] = useState<ProgressData | null>(null);
  const last = useRef(0);
  const load = useCallback(async (force = false) => {
    if (!enabled || document.visibilityState !== "visible") return;
    if (!force && Date.now() - last.current < MIN_INTERVAL) return;
    last.current = Date.now();
    try {
      const response = await fetch("/api/progres", { cache: "no-store" });
      if (response.ok) setData(await response.json());
    } catch { /* La progression est un bonus : une panne ne gêne jamais la page. */ }
  }, [enabled]);
  useEffect(() => { void load(); }, [load, pathname]);
  useEffect(() => {
    const refresh = () => void load();
    const forced = () => { setTimeout(() => void load(true), 400); };
    window.addEventListener("focus", refresh);
    window.addEventListener("valyo:progress", forced);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("valyo:progress", forced); };
  }, [load]);
  return data;
}

const weeks = (n: number) => `${n} semaine${n > 1 ? "s" : ""}`;

export function ProgressMini({ data, handle }: { data: ProgressData | null; handle: string | null }) {
  if (!data || !handle) return null;
  const { streak, goal } = data;
  return (
    <Link href={`/m/${handle}#progression`} className="mt-4 block rounded-lg bg-white px-3 py-2.5 ring-1 ring-line hover:ring-accent" aria-label="Ma progression">
      <span className="flex items-baseline justify-between gap-2">
        <span className="label-mono">Série</span>
        <span className={`font-display text-lg font-bold leading-none ${streak.current ? "text-accent" : "text-muted"}`}>
          {streak.current}<span className="ml-0.5 text-xs font-medium">sem.</span>
        </span>
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-muted">
        {streak.current === 0 ? "Participez cette semaine pour lancer votre série." : streak.activeThisWeek ? `Semaine validée ✓${streak.best > streak.current ? ` · record ${weeks(streak.best)}` : ""}` : "À prolonger avant dimanche soir"}
      </span>
      {goal && (
        <span className="mt-2 block border-t border-line pt-2">
          <span className="label-mono">Prochain palier</span>
          <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-ink">{goal.label}</span>
          <span className="block text-[11px] text-muted">{goal.detail}</span>
        </span>
      )}
      <span className="mt-2 block text-[11px] text-soft">{data.elements}/{data.totalElements} éléments découverts →</span>
    </Link>
  );
}

export function ProgressToast({ data }: { data: ProgressData | null }) {
  const [queue, setQueue] = useState<Unlock[]>([]);
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const fresh = (data?.unseen ?? []).filter((u) => !shown.current.has(u.key));
    if (!fresh.length) return;
    fresh.forEach((u) => shown.current.add(u.key));
    setQueue((q) => [...q, ...fresh]);
    void fetch("/api/progres", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seen: fresh.map((u) => u.key) }) }).catch(() => {});
  }, [data]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), 7000);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-[84px] z-40 mx-auto max-w-sm animate-[toast-in_.35s_ease-out] lg:inset-x-auto lg:bottom-6 lg:right-6">
      <div className="flex items-start gap-3 rounded-xl bg-ink p-3.5 pr-9 text-white shadow-xl">
        {current.slug ? (
          <ThemeTile slug={current.slug} size="lg" active />
        ) : (
          <span aria-hidden className="flex h-14 w-14 shrink-0 flex-col justify-between rounded bg-accent p-[5px]">
            <span className="font-mono text-[9px] leading-none">★</span>
            <span className="font-display text-xl font-bold leading-none">{current.symbol}</span>
          </span>
        )}
        <span className="min-w-0">
          <span className="label-mono block text-[#F5B48C]">{current.kind === "badge" ? "Découverte débloquée" : current.kind === "element" ? "Élément découvert" : "Niveau atteint"}</span>
          <span className="mt-0.5 block font-display text-[17px] font-bold leading-snug">{current.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-white/75">{current.detail}</span>
        </span>
        <button type="button" onClick={() => setQueue((q) => q.slice(1))} aria-label="Fermer" className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded text-white/60 hover:text-white">✕</button>
      </div>
    </div>
  );
}
