import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { OrbitLab } from "./OrbitLab";

const sim = simulator("orbite");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/orbite" } };

export default function Page() {
  return (
    <SimShell slug="orbite" intro="Un engin est lâché à l’horizontale, au-dessus de l’atmosphère. Tout dépend de sa vitesse : trop lent il retombe, assez rapide il tourne sans fin, plus rapide encore il part pour toujours." note="Modèle à deux corps, sans frottement de l’air ni poussée après le départ : c’est l’expérience de pensée du « canon de Newton ». Sous 100 km d’altitude, on considère que l’atmosphère fait retomber l’engin.">
      <OrbitLab />
    </SimShell>
  );
}
