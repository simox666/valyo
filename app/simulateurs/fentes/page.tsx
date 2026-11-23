import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { SlitsLab } from "./SlitsLab";

const sim = simulator("fentes");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/fentes" } };

export default function Page() {
  return (
    <SimShell slug="fentes" intro="Des particules sont envoyées une par une vers une plaque percée de deux fentes. Chacune arrive en un point précis de l’écran, mais leur accumulation dessine des franges, comme une onde. Si l’on regarde par quelle fente chacune passe, les franges disparaissent." note="Répartition théorique (diffraction par une fente, multipliée par l’interférence entre les deux). Les positions sont tirées au hasard selon cette loi, comme dans l’expérience réelle faite avec des électrons.">
      <SlitsLab />
    </SimShell>
  );
}
