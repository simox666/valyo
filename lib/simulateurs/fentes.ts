// Fentes de Young : où une particule a-t-elle des chances d'arriver sur l'écran ?
// u est la position sur l'écran, de −1 (bord gauche) à +1 (bord droit).

export type SlitMode = "deux" | "une" | "observe";
export type Slits = { mode: SlitMode; /** Écart entre les fentes, en largeurs de fente (2 à 8). */ separation: number };

const sinc = (x: number) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x);
/** L'enveloppe de diffraction s'annule en u = ±0,5. */
const BETA = 2 * Math.PI;

/** Probabilité relative d'arrivée (entre 0 et 1). */
export function intensity(u: number, slits: Slits) {
  const envelope = sinc(BETA * u) ** 2;
  // Deux fentes ouvertes sans observation : les deux chemins interfèrent (franges).
  // Une fente, ou deux fentes « observées » : on sait par où la particule est passée, plus de franges.
  return slits.mode === "deux" ? envelope * Math.cos(BETA * u * slits.separation) ** 2 : envelope;
}

/** Tire une position d'arrivée selon cette loi (méthode du rejet). */
export function sample(random: () => number, slits: Slits) {
  for (let i = 0; i < 1000; i++) {
    const u = random() * 2 - 1;
    if (random() < intensity(u, slits)) return u;
  }
  return 0;
}
