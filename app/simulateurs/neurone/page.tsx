import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { NeuronLab } from "./NeuronLab";

const sim = simulator("neurone");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/neurone" } };

export default function Page() {
  return (
    <SimShell slug="neurone" intro="Touchez la zone pour poser des points bleus ou orange. Le réseau ajuste ses réglages en continu pour colorer la zone comme vos points. Sans neurone caché, il ne sait tracer qu’une droite ; ajoutez-en pour des formes plus complexes." note="Réseau à une couche cachée, entraîné par descente de gradient dans votre navigateur. Les modèles d’IA actuels reposent sur le même principe, avec des milliards de réglages au lieu de quelques dizaines.">
      <NeuronLab />
    </SimShell>
  );
}
