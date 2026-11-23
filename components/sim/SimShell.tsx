import Link from "next/link";
import type { ReactNode } from "react";
import { simulator, type SimulatorSlug } from "@/lib/simulateurs/catalogue.ts";

/** Cadre commun d'une page de simulateur : titre, phrase d'introduction, le simulateur, puis ses limites. */
export function SimShell({ slug, intro, note, children }: { slug: SimulatorSlug; intro: string; note: string; children: ReactNode }) {
  const sim = simulator(slug);
  return (
    <div className="space-y-5">
      <header>
        <p className="label-mono text-accent">Simulateur · {sim.theme}</p>
        <h1 className="mt-1 text-2xl font-bold">{sim.title}</h1>
        <p className="mt-1 text-soft">{intro}</p>
      </header>
      {children}
      <p className="text-xs leading-relaxed text-muted">
        {note} <Link href="/simulateurs" className="font-semibold text-accent hover:underline">Tous les simulateurs</Link>
      </p>
    </div>
  );
}
