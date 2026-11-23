import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { MixLab } from "./MixLab";

const sim = simulator("mix-electrique");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/mix-electrique" } };

export default function Page() {
  return (
    <SimShell slug="mix-electrique" intro="Répartissez la production d’électricité d’un pays entre six sources. Le simulateur calcule le CO₂ émis par kilowattheure, et vérifie si le pays tient un soir d’hiver sans vent, quand la demande est forte et que le solaire ne produit rien." note="Modèle volontairement très simplifié : émissions médianes sur le cycle de vie (GIEC, 2014), facteurs de charge typiques, pas de stockage, d’importations ni de coûts. Les résultats donnent des ordres de grandeur, pas une étude de réseau.">
      <MixLab />
    </SimShell>
  );
}
