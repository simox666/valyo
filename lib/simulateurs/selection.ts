// Sélection naturelle : une population dont la couleur (0 = clair, 1 = foncé) se transmet avec de petites variations.
// Les individus qui tranchent sur le décor sont plus souvent mangés.

export type Selection = { /** Couleur du décor, 0 à 1. */ background: number; /** Pression des prédateurs, 0 à 1. */ pressure: number; /** Ampleur des mutations, 0 à 0,2. */ mutation: number };
export const POPULATION = 80;

const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function initialPopulation(random: () => number, size = POPULATION) {
  return Array.from({ length: size }, () => clamp(0.5 + (random() - 0.5) * 0.5));
}

export function nextGeneration(pop: number[], { background, pressure, mutation }: Selection, random: () => number) {
  const survivors = pop.filter((colour) => random() < Math.max(0.02, 1 - pressure * Math.abs(colour - background) * 1.6));
  // Si tout le monde a été mangé, le mieux camouflé repart seul.
  const parents = survivors.length ? survivors : [pop.reduce((best, c) => (Math.abs(c - background) < Math.abs(best - background) ? c : best), pop[0])];
  const next = Array.from({ length: pop.length }, () => clamp(parents[Math.floor(random() * parents.length)] + (random() - 0.5) * 2 * mutation));
  return { next, eaten: pop.length - survivors.length };
}

export const meanColour = (pop: number[]) => pop.reduce((sum, c) => sum + c, 0) / pop.length;
