import type { Metadata } from "next";
import { listActiveThemes } from "@/lib/data/themes";
import { themesWithGames } from "@/lib/jeux/questions";
import { GamesClient } from "./GamesClient";

export const metadata: Metadata = {
  title: "Jeux",
  description: "Défi du jour, quiz, vrai ou faux, ordres de grandeur et frises chronologiques sur les thèmes de Valyo.",
};

/** Jeux liés aux thèmes : accessibles à tous, sans compte ; rien n'est enregistré côté serveur. */
export default async function GamesPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const playable = themesWithGames();
  const themes = (await listActiveThemes())
    .filter((t) => playable.has(t.slug))
    .map((t) => ({ slug: t.slug, name: t.name }));
  const asked = (await searchParams).theme;
  const initialTheme = asked && themes.some((t) => t.slug === asked) ? asked : null;

  // Le jour du défi est celui de Paris, fixé ici : serveur et navigateur tirent les mêmes questions.
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const dayLabel = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" }).format(now);

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
      <GamesClient themes={themes} initialTheme={initialTheme} day={day} dayLabel={dayLabel} />
    </div>
  );
}
