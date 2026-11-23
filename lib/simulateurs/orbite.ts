// Mise en orbite : le « canon de Newton ». On lâche un engin à une altitude donnée, à l'horizontale,
// avec une vitesse choisie. La trajectoire est une conique (mécanique à deux corps, sans frottement).

export const MU = 398600.4418; // paramètre gravitationnel de la Terre, km³/s²
export const R_EARTH = 6371; // km
/** Sous cette altitude, l'atmosphère freine l'engin : il finit par retomber. */
export const ATMOSPHERE = 100;

export const ALTITUDES = [
  { km: 200, label: "200 km" },
  { km: 400, label: "400 km · station spatiale" },
  { km: 2000, label: "2 000 km" },
  { km: 20200, label: "20 200 km · GPS" },
  { km: 35786, label: "35 786 km · géostationnaire" },
] as const;

export type Outcome = "retombe" | "orbite" | "evasion";
export type Flight = {
  outcome: Outcome;
  /** Vitesses de référence à cette altitude, km/s. */
  circular: number;
  escape: number;
  /** Altitudes du point le plus bas et du plus haut, km (null si l'engin s'échappe). */
  perigee: number;
  apogee: number | null;
  /** Durée d'un tour, en minutes (orbite seulement). */
  periodMin: number | null;
  /** Distance parcourue au sol avant de retomber, km. */
  groundKm: number | null;
  /** Trajectoire en km, Terre au centre, départ en haut. */
  path: [number, number][];
};

export const circularSpeed = (altitude: number) => Math.sqrt(MU / (R_EARTH + altitude));
export const escapeSpeed = (altitude: number) => Math.sqrt((2 * MU) / (R_EARTH + altitude));

export function fly(speed: number, altitude: number): Flight {
  const r0 = R_EARTH + altitude;
  const v = Math.max(0, speed);
  const circular = circularSpeed(altitude);
  const escape = escapeSpeed(altitude);
  // r(φ) = p / (1 + e·cos φ), φ étant l'angle parcouru depuis le départ ; e est signé :
  // positif si le départ est le point le plus bas, négatif s'il est le plus haut.
  const p = (r0 * v) ** 2 / MU;
  const e = (r0 * v * v) / MU - 1;
  const radius = (phi: number) => p / (1 + e * Math.cos(phi));
  const point = (r: number, phi: number): [number, number] => [r * Math.sin(phi), r * Math.cos(phi)];

  if (v < 0.01) {
    return { outcome: "retombe", circular, escape, perigee: -R_EARTH, apogee: altitude, periodMin: null, groundKm: 0, path: [[0, r0], [0, R_EARTH]] };
  }
  const path: [number, number][] = [];
  if (e >= 1) {
    const limit = r0 * 6;
    for (let deg = 0; deg < 180; deg += 1) {
      const phi = (deg * Math.PI) / 180;
      if (1 + e * Math.cos(phi) <= 0.001) break;
      const r = radius(phi);
      if (r > limit) break;
      path.push(point(r, phi));
    }
    return { outcome: "evasion", circular, escape, perigee: altitude, apogee: null, periodMin: null, groundKm: null, path };
  }
  const opposite = p / (1 - e);
  const low = Math.min(r0, opposite);
  const high = Math.max(r0, opposite);
  if (low < R_EARTH + ATMOSPHERE) {
    let ground = Math.PI;
    for (let deg = 0; deg <= 360; deg += 0.5) {
      const phi = (deg * Math.PI) / 180;
      const r = radius(phi);
      if (r <= R_EARTH) { ground = phi; path.push(point(R_EARTH, phi)); break; }
      path.push(point(r, phi));
    }
    return { outcome: "retombe", circular, escape, perigee: low - R_EARTH, apogee: high - R_EARTH, periodMin: null, groundKm: Math.round(ground * R_EARTH), path };
  }
  for (let deg = 0; deg <= 360; deg += 1) {
    const phi = (deg * Math.PI) / 180;
    path.push(point(radius(phi), phi));
  }
  const a = (low + high) / 2;
  return { outcome: "orbite", circular, escape, perigee: low - R_EARTH, apogee: high - R_EARTH, periodMin: (2 * Math.PI * Math.sqrt(a ** 3 / MU)) / 60, groundKm: null, path };
}
