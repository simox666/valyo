import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { SelectionLab } from "./SelectionLab";

const sim = simulator("selection");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/selection" } };

export default function Page() {
  return (
    <SimShell slug="selection" intro="Des animaux plus ou moins foncés vivent sur un décor. Ceux qui se voient trop sont mangés avant de se reproduire ; les petits ressemblent à leurs parents, à une légère variation près. Changez le décor et faites défiler les générations." note="Modèle minimal de sélection sur un seul caractère, inspiré de la phalène du bouleau, devenue sombre dans l’Angleterre industrielle noircie par la suie. Le hasard y joue un rôle, comme dans la nature.">
      <SelectionLab />
    </SimShell>
  );
}
