// Mix électrique : un modèle très simplifié, pour sentir les ordres de grandeur.
// - co2 : émissions sur tout le cycle de vie, en g de CO₂ par kWh (valeurs médianes du GIEC, 2014).
// - load : facteur de charge typique (part de l'année où l'installation tourne à pleine puissance).
// - evening : part de la puissance installée disponible un soir d'hiver sans vent.
export const SOURCES = [
  { key: "nucleaire", name: "Nucléaire", co2: 12, load: 0.75, evening: 0.9, lowCarbon: true },
  { key: "eolien", name: "Éolien", co2: 11, load: 0.25, evening: 0.08, lowCarbon: true },
  { key: "solaire", name: "Solaire", co2: 45, load: 0.14, evening: 0, lowCarbon: true },
  { key: "hydraulique", name: "Hydraulique", co2: 24, load: 0.3, evening: 0.8, lowCarbon: true },
  { key: "gaz", name: "Gaz", co2: 490, load: 0.4, evening: 0.95, lowCarbon: false },
  { key: "charbon", name: "Charbon", co2: 820, load: 0.5, evening: 0.95, lowCarbon: false },
] as const;

export type SourceKey = (typeof SOURCES)[number]["key"];
export type Mix = Record<SourceKey, number>;

/** Un soir d'hiver, la demande dépasse nettement la moyenne de l'année. */
export const WINTER_PEAK = 1.4;

export const MIX_PRESETS: { name: string; mix: Mix }[] = [
  { name: "Très nucléaire", mix: { nucleaire: 65, eolien: 10, solaire: 5, hydraulique: 12, gaz: 7, charbon: 1 } },
  { name: "Tout renouvelable", mix: { nucleaire: 0, eolien: 50, solaire: 30, hydraulique: 20, gaz: 0, charbon: 0 } },
  { name: "Renouvelable + gaz", mix: { nucleaire: 0, eolien: 40, solaire: 20, hydraulique: 10, gaz: 30, charbon: 0 } },
  { name: "Très fossile", mix: { nucleaire: 5, eolien: 5, solaire: 3, hydraulique: 7, gaz: 30, charbon: 50 } },
];

export function evaluate(mix: Mix) {
  const total = SOURCES.reduce((sum, s) => sum + Math.max(0, mix[s.key]), 0);
  if (total <= 0) return { shares: SOURCES.map((s) => ({ ...s, share: 0 })), co2: 0, lowCarbon: 0, coverage: 0 };
  const shares = SOURCES.map((s) => ({ ...s, share: Math.max(0, mix[s.key]) / total }));
  const co2 = shares.reduce((sum, s) => sum + s.share * s.co2, 0);
  const lowCarbon = shares.reduce((sum, s) => sum + (s.lowCarbon ? s.share : 0), 0);
  // Puissance installée nécessaire pour fournir cette part de l'énergie de l'année, puis ce qu'il en reste ce soir-là.
  const available = shares.reduce((sum, s) => sum + (s.share / s.load) * s.evening, 0);
  return { shares, co2, lowCarbon, coverage: available / WINTER_PEAK };
}
