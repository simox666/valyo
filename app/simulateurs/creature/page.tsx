import type { Metadata } from "next";
import Link from "next/link";
import { clampPlanet } from "@/lib/simulateurs/creature.ts";
import { CreatureLab } from "./CreatureLab";

export const metadata: Metadata = {
  title: "Simulateur : la créature d’une autre planète",
  description: "Réglez la gravité, la température, l’atmosphère, la lumière et les mers d’une planète : Valyo dessine la créature qui pourrait y vivre et explique chaque trait.",
  // Les réglages vivent dans l'adresse (?g=&t=&p=&l=&w=) : une seule adresse canonique.
  alternates: { canonical: "/simulateurs/creature" },
};

export default async function CreaturePage({ searchParams }: { searchParams: Promise<{ g?: string; t?: string; p?: string; l?: string; w?: string }> }) {
  const initial = clampPlanet(await searchParams);
  return (
    <div className="space-y-5">
      <header>
        <p className="label-mono text-accent">Simulateur</p>
        <h1 className="mt-1 text-2xl font-bold">La créature d’une autre planète</h1>
        <p className="mt-1 text-soft">
          Réglez la gravité, la température, l’atmosphère, la lumière et les mers : découvrez l’animal qui pourrait y vivre, et pourquoi il aurait cette allure.
        </p>
      </header>
      <CreatureLab initial={initial} />
      <p className="text-xs leading-relaxed text-muted">
        Spéculation raisonnée : aucune vie extraterrestre n’est connue à ce jour. Les règles appliquées viennent de la biologie terrestre
        (poids et squelette, perte de chaleur, portance de l’air) et sont volontairement simplifiées.{" "}
        <Link href="/jeux" className="font-semibold text-accent hover:underline">Retour aux jeux</Link>
      </p>
    </div>
  );
}
