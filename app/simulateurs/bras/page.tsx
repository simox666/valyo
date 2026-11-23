import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { ArmLab } from "./ArmLab";

const sim = simulator("bras");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/bras" } };

export default function Page() {
  return (
    <SimShell slug="bras" intro="Déplacez la cible avec le doigt ou la souris. Le bras ne sait qu’une chose : la longueur de ses segments. Il en déduit seul l’angle à donner à chaque articulation pour que sa pince atteigne la cible." note="Cinématique inverse par la méthode FABRIK, utilisée en robotique et en animation. Un vrai robot doit en plus respecter les butées de ses articulations et éviter les obstacles.">
      <ArmLab />
    </SimShell>
  );
}
