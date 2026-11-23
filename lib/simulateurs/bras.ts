// Bras articulé : cinématique inverse par la méthode FABRIK (on tire la chaîne vers la cible, puis on la
// ramène à sa base, et on recommence). Repère : base en (0, 0), y vers le haut.

export type Vec = { x: number; y: number };

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const towards = (from: Vec, to: Vec, length: number): Vec => {
  const d = dist(from, to) || 1e-9;
  return { x: from.x + ((to.x - from.x) / d) * length, y: from.y + ((to.y - from.y) / d) * length };
};

/** Pose de départ : bras dressé à la verticale. */
export function upright(lengths: number[]): Vec[] {
  const joints: Vec[] = [{ x: 0, y: 0 }];
  for (const l of lengths) joints.push({ x: 0.01 * joints.length, y: joints[joints.length - 1].y + l });
  return joints;
}

export function solve(lengths: number[], target: Vec, previous?: Vec[]) {
  const reach = lengths.reduce((sum, l) => sum + l, 0);
  const base: Vec = { x: 0, y: 0 };
  const n = lengths.length;
  let joints = previous && previous.length === n + 1 ? previous.map((j) => ({ ...j })) : upright(lengths);
  const reachable = dist(base, target) <= reach;
  if (!reachable) {
    // Hors de portée : le bras se tend tout droit vers la cible.
    joints = [base];
    for (const l of lengths) joints.push(towards(joints[joints.length - 1], target, l));
  } else {
    for (let iteration = 0; iteration < 40 && dist(joints[n], target) > 0.05; iteration++) {
      joints[n] = { ...target };
      for (let k = n - 1; k >= 0; k--) joints[k] = towards(joints[k + 1], joints[k], lengths[k]);
      joints[0] = { ...base };
      for (let k = 1; k <= n; k++) joints[k] = towards(joints[k - 1], joints[k], lengths[k - 1]);
    }
  }
  // Angle de chaque segment par rapport au précédent (le premier : par rapport à la verticale), en degrés.
  const angles: number[] = [];
  let before = Math.PI / 2;
  for (let k = 1; k <= n; k++) {
    const heading = Math.atan2(joints[k].y - joints[k - 1].y, joints[k].x - joints[k - 1].x);
    let turn = ((before - heading) * 180) / Math.PI;
    while (turn > 180) turn -= 360;
    while (turn < -180) turn += 360;
    angles.push(Math.round(turn));
    before = heading;
  }
  return { joints, angles, reachable, reach, error: dist(joints[n], target) };
}
