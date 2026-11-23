import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { EpidemicLab } from "./EpidemicLab";

const sim = simulator("epidemie");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/epidemie" } };

export default function Page() {
  return (
    <SimShell slug="epidemie" intro="Une maladie arrive dans une population. Sa contagiosité, la part de personnes vaccinées et la réduction des contacts décident de la suite : une grande vague, une petite, ou rien du tout." note="Modèle SIR : population homogène, immunité définitive après guérison, vaccin totalement protecteur, malade contagieux 7 jours. Les valeurs de contagiosité (R0) proposées sont des ordres de grandeur couramment cités. Ce n’est pas un outil de prévision.">
      <EpidemicLab />
    </SimShell>
  );
}
