// Petit réseau de neurones : 2 entrées (x, y) → une couche cachée (tanh) → 1 sortie (sigmoïde).
// Sans neurone caché, c'est une simple frontière droite. Entraînement par descente de gradient.

export type Point = { x: number; y: number; label: 0 | 1 };
export type Net = { hidden: number; w1: number[]; b1: number[]; w2: number[]; b2: number };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function createNet(hidden: number, random: () => number): Net {
  const r = () => (random() - 0.5) * 2;
  return hidden === 0
    ? { hidden, w1: [], b1: [], w2: [r(), r()], b2: 0 }
    : { hidden, w1: Array.from({ length: hidden * 2 }, r), b1: Array.from({ length: hidden }, () => r() * 0.5), w2: Array.from({ length: hidden }, r), b2: 0 };
}

export function predict(net: Net, x: number, y: number) {
  if (net.hidden === 0) return sigmoid(net.w2[0] * x + net.w2[1] * y + net.b2);
  let z = net.b2;
  for (let h = 0; h < net.hidden; h++) z += net.w2[h] * Math.tanh(net.w1[2 * h] * x + net.w1[2 * h + 1] * y + net.b1[h]);
  return sigmoid(z);
}

/** Un pas d'apprentissage sur tous les points ; modifie le réseau et renvoie l'erreur moyenne. */
export function trainStep(net: Net, points: Point[], rate = 0.3) {
  if (!points.length) return 0;
  const n = points.length;
  let loss = 0;
  let gb2 = 0;
  const gw2 = new Array(net.w2.length).fill(0);
  const gw1 = new Array(net.w1.length).fill(0);
  const gb1 = new Array(net.b1.length).fill(0);
  for (const pt of points) {
    if (net.hidden === 0) {
      const out = sigmoid(net.w2[0] * pt.x + net.w2[1] * pt.y + net.b2);
      const d = out - pt.label;
      loss += -(pt.label ? Math.log(out + 1e-9) : Math.log(1 - out + 1e-9));
      gw2[0] += d * pt.x; gw2[1] += d * pt.y; gb2 += d;
      continue;
    }
    const a = new Array(net.hidden);
    let z = net.b2;
    for (let h = 0; h < net.hidden; h++) { a[h] = Math.tanh(net.w1[2 * h] * pt.x + net.w1[2 * h + 1] * pt.y + net.b1[h]); z += net.w2[h] * a[h]; }
    const out = sigmoid(z);
    const d = out - pt.label;
    loss += -(pt.label ? Math.log(out + 1e-9) : Math.log(1 - out + 1e-9));
    gb2 += d;
    for (let h = 0; h < net.hidden; h++) {
      gw2[h] += d * a[h];
      const back = d * net.w2[h] * (1 - a[h] * a[h]);
      gw1[2 * h] += back * pt.x; gw1[2 * h + 1] += back * pt.y; gb1[h] += back;
    }
  }
  for (let k = 0; k < net.w2.length; k++) net.w2[k] -= (rate * gw2[k]) / n;
  for (let k = 0; k < net.w1.length; k++) net.w1[k] -= (rate * gw1[k]) / n;
  for (let k = 0; k < net.b1.length; k++) net.b1[k] -= (rate * gb1[k]) / n;
  net.b2 -= (rate * gb2) / n;
  return loss / n;
}

export const accuracy = (net: Net, points: Point[]) =>
  points.length ? points.filter((p) => (predict(net, p.x, p.y) >= 0.5 ? 1 : 0) === p.label).length / points.length : 0;

/** Jeux de points d'exemple, dans le carré [−1, 1]². */
export function dataset(kind: "groupes" | "cercle" | "damier", random: () => number): Point[] {
  const pts: Point[] = [];
  for (let k = 0; k < 60; k++) {
    if (kind === "groupes") {
      const label = (k % 2) as 0 | 1;
      pts.push({ x: (label ? 0.5 : -0.5) + (random() - 0.5) * 0.7, y: (label ? 0.4 : -0.4) + (random() - 0.5) * 0.7, label });
    } else if (kind === "cercle") {
      const inner = k % 2 === 0;
      const radius = inner ? random() * 0.35 : 0.65 + random() * 0.3;
      const angle = random() * Math.PI * 2;
      pts.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle), label: inner ? 1 : 0 });
    } else {
      const x = (random() - 0.5) * 1.8;
      const y = (random() - 0.5) * 1.8;
      if (Math.abs(x) < 0.12 || Math.abs(y) < 0.12) continue;
      pts.push({ x, y, label: x * y > 0 ? 1 : 0 });
    }
  }
  return pts;
}
