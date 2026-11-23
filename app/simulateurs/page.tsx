import type { Metadata } from "next";
import Link from "next/link";
import { SIMULATORS } from "@/lib/simulateurs/catalogue.ts";

export const metadata: Metadata = {
  title: "Simulateurs — manipuler pour comprendre",
  description: "Onze simulateurs gratuits pour comprendre en manipulant : mise en orbite, épidémie, climat, fentes de Young, réseau de neurones, créature d’une autre planète…",
  alternates: { canonical: "/simulateurs" },
};

export default function SimulatorsPage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="label-mono text-accent">Pour comprendre en manipulant</p>
        <h1 className="mt-1 text-2xl font-bold">Simulateurs</h1>
        <p className="mt-1 text-soft">Bougez un curseur, regardez ce qui change. Chaque simulateur explique ce qu’il calcule et ce qu’il laisse de côté.</p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SIMULATORS.map((s) => (
          <li key={s.slug}>
            <Link href={`/simulateurs/${s.slug}`} className="card flex h-full flex-col p-5 hover:ring-accent">
              <span className="label-mono text-accent">{s.theme}</span>
              <span className="mt-1 font-display text-lg font-bold leading-snug">{s.title}</span>
              <span className="mt-1 flex-1 text-sm text-soft">{s.pitch}</span>
              <span aria-hidden className="mt-3 text-sm font-semibold text-accent">Essayer →</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-soft"><Link href="/jeux" className="font-semibold text-accent hover:underline">← Les jeux et le classement</Link></p>
    </div>
  );
}
