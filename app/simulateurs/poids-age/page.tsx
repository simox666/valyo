import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { WeightAgeLab } from "./WeightAgeLab";

const sim = simulator("poids-age");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/poids-age" } };

export default function Page() {
  return (
    <SimShell slug="poids-age" intro="Votre masse ne change pas d’un astre à l’autre, mais la force qui vous tire vers le sol, si. Et une année, c’est un tour autour du Soleil : elle dure 88 jours sur Mercure, 165 ans sur Neptune." note="Gravité de surface à l’équateur (au sommet des nuages pour les planètes géantes, qui n’ont pas de sol). La balance affichée est un pèse-personne terrestre qu’on aurait emporté.">
      <WeightAgeLab />
    </SimShell>
  );
}
