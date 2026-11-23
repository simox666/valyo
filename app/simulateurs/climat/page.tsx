import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { ClimateLab } from "./ClimateLab";

const sim = simulator("climat");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/climat" } };

export default function Page() {
  return (
    <SimShell slug="climat" intro="La température de la Terre résulte d’un équilibre entre l’énergie reçue du Soleil et celle qu’elle renvoie vers l’espace. Changez l’un des réglages : le simulateur donne la température une fois le nouvel équilibre atteint." note="Bilan d’énergie global à une équation, avec une sensibilité de 3 °C par doublement du CO₂ (meilleure estimation du GIEC, fourchette probable 2,5 à 4 °C). L’équilibre met des siècles à s’établir : pour le CO₂ d’aujourd’hui, le réchauffement mesuré (environ 1,2 °C sur la dernière décennie) est encore inférieur à la valeur d’équilibre. Les autres gaz à effet de serre ne sont pas comptés.">
      <ClimateLab />
    </SimShell>
  );
}
