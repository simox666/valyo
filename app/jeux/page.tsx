import type { Metadata } from "next";
import { listActiveThemes } from "@/lib/data/themes";
import { themesWithGames } from "@/lib/jeux/questions";
import { GamesClient } from "./GamesClient";

export const metadata: Metadata = {
  title: "Jeux",
  description: "Quiz et vrai ou faux sur les thèmes de Valyo : IA, espace, sciences, climat…",
};

/** Jeux liés aux thèmes : accessibles à tous, sans compte ; rien n'est enregistré. */
export default async function GamesPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const playable = themesWithGames();
  const themes = (await listActiveThemes())
    .filter((t) => playable.has(t.slug))
    .map((t) => ({ slug: t.slug, name: t.name }));
  const asked = (await searchParams).theme;
  const initialTheme = asked && themes.some((t) => t.slug === asked) ? asked : null;

  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <header>
        <p className="label-mono text-accent">Pour s’amuser</p>
        <h1 className="mt-1 text-2xl font-bold">Jeux</h1>
        <p className="mt-1 text-soft">
          Testez vos connaissances sur les thèmes de Valyo. Chaque réponse vient avec une
          explication — de quoi briller ensuite dans les salons.
        </p>
      </header>
      <GamesClient themes={themes} initialTheme={initialTheme} />
    </div>
  );
}
