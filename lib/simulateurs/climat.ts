// Thermostat de la Terre : bilan d'énergie à l'équilibre, en une seule équation.
// On part du climat préindustriel (280 ppm de CO₂, environ 14 °C) et on additionne les « forçages »
// (W/m² en plus ou en moins), convertis en degrés par la sensibilité du climat.

export const PREINDUSTRIAL = { co2: 280, albedo: 0.3, sun: 0, aerosols: 0 };
export const TODAY = { co2: 425, albedo: 0.3, sun: 0, aerosols: 0 };
export type ClimateInput = typeof PREINDUSTRIAL;

const SOLAR = 1361; // W/m² reçus au sommet de l'atmosphère
const SIGMA = 5.670374e-8;
/** Réchauffement à l'équilibre pour un doublement du CO₂ : meilleure estimation du GIEC (2021), fourchette probable 2,5 à 4 °C. */
export const SENSITIVITY = 3;
const DOUBLING = 5.35 * Math.log(2); // W/m² pour un doublement du CO₂
export const BASE_TEMP = 14;

/** Température qu'aurait la Terre sans effet de serre, en °C (environ −18 °C). */
export const bareTemp = (albedo: number, sun = 0) => Math.pow((SOLAR * (1 + sun / 100) * (1 - albedo)) / (4 * SIGMA), 0.25) - 273.15;

export function climate(input: ClimateInput) {
  const parts = {
    co2: 5.35 * Math.log(input.co2 / PREINDUSTRIAL.co2),
    albedo: (-SOLAR * (input.albedo - PREINDUSTRIAL.albedo)) / 4,
    sun: (SOLAR * (input.sun / 100) * (1 - input.albedo)) / 4,
    aerosols: input.aerosols,
  };
  const forcing = parts.co2 + parts.albedo + parts.sun + parts.aerosols;
  const delta = (forcing * SENSITIVITY) / DOUBLING;
  return { parts, forcing, delta, temp: BASE_TEMP + delta };
}
