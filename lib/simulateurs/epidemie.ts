// Épidémie : modèle SIR (Sains → Infectés → Rétablis), le plus simple des modèles d'épidémiologie.

export type Outbreak = {
  /** Nombre de personnes contaminées par un malade dans une population entièrement sensible. */
  r0: number;
  /** Part de la population vaccinée (et protégée), de 0 à 0,95. */
  vaccinated: number;
  /** Réduction des contacts (isolement, gestes barrières), de 0 à 0,8. */
  isolation: number;
};

export const DISEASES = [
  { name: "Grippe saisonnière", r0: 1.3 },
  { name: "Covid-19 (souche initiale)", r0: 2.8 },
  { name: "Rougeole", r0: 15 },
] as const;

/** Durée pendant laquelle un malade est contagieux, en jours. */
export const INFECTIOUS_DAYS = 7;
const SEED = 0.001; // un malade pour mille habitants au départ

export function outbreak({ r0, vaccinated, isolation }: Outbreak) {
  const effective = r0 * (1 - isolation);
  const gamma = 1 / INFECTIOUS_DAYS;
  const beta = effective * gamma;
  let s = Math.max(0, 1 - vaccinated - SEED);
  let i = SEED;
  let r = 0;
  const dt = 0.1;
  const series: { day: number; s: number; i: number; r: number }[] = [{ day: 0, s, i, r }];
  let peak = i;
  let peakDay = 0;
  for (let step = 1; step <= 730 / dt; step++) {
    const infections = beta * s * i * dt;
    const recoveries = gamma * i * dt;
    s -= infections;
    i += infections - recoveries;
    r += recoveries;
    const day = step * dt;
    if (i > peak) { peak = i; peakDay = day; }
    if (step % 10 === 0) series.push({ day, s, i, r });
    if (i < 1e-5 && day > 14) break;
  }
  return {
    series,
    peak,
    peakDay: Math.round(peakDay),
    /** Part de toute la population infectée au total. */
    attack: r + i,
    /** Contaminations par malade au tout début, compte tenu des vaccinés et de l'isolement. */
    reproduction: effective * (1 - vaccinated),
    /** Couverture vaccinale qui empêche l'épidémie de démarrer (0 si elle ne démarre pas de toute façon). */
    herd: effective > 1 ? 1 - 1 / effective : 0,
    days: series[series.length - 1].day,
  };
}
