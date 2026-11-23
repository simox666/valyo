// Poids et âge sur les autres astres du Système solaire.
// Gravité de surface en m/s² (à l'équateur, au niveau des nuages pour les géantes) ; durée de l'année en années terrestres.
export const G_EARTH = 9.81;
export const BODIES = [
  { name: "Mercure", gravity: 3.7, year: 0.241 },
  { name: "Vénus", gravity: 8.87, year: 0.615 },
  { name: "Lune", gravity: 1.62, year: null },
  { name: "Mars", gravity: 3.72, year: 1.881 },
  { name: "Jupiter", gravity: 24.79, year: 11.86 },
  { name: "Saturne", gravity: 10.44, year: 29.46 },
  { name: "Uranus", gravity: 8.87, year: 84.01 },
  { name: "Neptune", gravity: 11.15, year: 164.8 },
  { name: "Pluton", gravity: 0.62, year: 248 },
] as const;

/** Hauteur d'un petit saut sur Terre, en mètres : sert de repère pour les autres astres. */
export const JUMP_EARTH = 0.4;

export function elsewhere(weightKg: number, ageYears: number) {
  return BODIES.map((b) => ({
    name: b.name,
    /** Ce qu'afficherait un pèse-personne terrestre posé là-bas, en kg. */
    scale: (weightKg * b.gravity) / G_EARTH,
    /** Âge en années locales (null pour la Lune, qui tourne autour de la Terre). */
    age: b.year ? ageYears / b.year : null,
    /** Hauteur du même saut, en mètres. */
    jump: (JUMP_EARTH * G_EARTH) / b.gravity,
  }));
}
