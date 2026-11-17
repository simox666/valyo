// Thèmes façon tableau périodique (direction « Carnet de labo ») : numéro, symbole, nom court.

const ELEMENTS: Record<string, { n: number; symbol: string; short: string }> = {
  ia: { n: 1, symbol: "Ia", short: "IA" },
  robotique: { n: 2, symbol: "Ro", short: "Robotique" },
  espace: { n: 3, symbol: "Es", short: "Espace" },
  sciences: { n: 4, symbol: "Sc", short: "Sciences" },
  tech: { n: 5, symbol: "Te", short: "Tech" },
  sante: { n: 6, symbol: "Sa", short: "Santé" },
  climat: { n: 7, symbol: "Cl", short: "Climat" },
  energie: { n: 8, symbol: "En", short: "Énergie" },
  physique: { n: 9, symbol: "Ph", short: "Physique" },
  biologie: { n: 10, symbol: "Bi", short: "Biologie" },
  cyber: { n: 11, symbol: "Cy", short: "Cyber" },
};

export function themeElement(slug: string, name?: string) {
  const e = ELEMENTS[slug];
  if (e) return e;
  const label = name ?? slug;
  return { n: 0, symbol: label.slice(0, 2).replace(/^./, (c) => c.toUpperCase()), short: label };
}
