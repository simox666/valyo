import type { Metadata } from "next";
import { SimShell } from "@/components/sim/SimShell";
import { simulator } from "@/lib/simulateurs/catalogue.ts";
import { PasswordLab } from "./PasswordLab";

const sim = simulator("mot-de-passe");
export const metadata: Metadata = { title: `Simulateur : ${sim.title}`, description: sim.pitch, alternates: { canonical: "/simulateurs/mot-de-passe" } };

export default function Page() {
  return (
    <SimShell slug="mot-de-passe" intro="Tapez un mot de passe inventé pour l’occasion : le simulateur compte les combinaisons possibles et estime le temps qu’il faudrait pour le trouver en les essayant toutes." note="Le calcul se fait entièrement sur votre appareil : rien n’est envoyé ni enregistré. Par prudence, n’entrez pas un mot de passe que vous utilisez. Les durées supposent une attaque par force brute ; un mot de passe courant ou construit sur un motif classique tombe bien plus vite, et la vitesse réelle dépend de la façon dont le site protège ses mots de passe.">
      <PasswordLab />
    </SimShell>
  );
}
