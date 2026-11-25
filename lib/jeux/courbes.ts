// « Dessine la courbe » : le joueur trace l'évolution d'une grandeur, puis la vraie courbe apparaît.
// Chaque série donne quelques points, arrondis, tirés d'une source publique nommée ; le ou les premiers
// points sont montrés, les suivants sont à tracer. Des séries longues et stables, jamais le chiffre du mois.
// Tirage pur et à graine : le navigateur joue, le serveur rejoue et note.

import { seededRandom, shuffle } from "./tirage.ts";

export const COURBE_ROUND = 2;
/** Écart toléré entre le point tracé et le vrai, en centièmes de la hauteur du graphique. */
export const COURBE_TOLERANCE = 10;

export interface Curve {
  id: string;
  /** Slug du thème (table themes). */
  theme: string;
  title: string;
  /** Unité affichée sur l'axe et dans la correction. */
  unit: string;
  /** Bornes de l'axe vertical : assez larges pour ne pas souffler la réponse. */
  yMin: number;
  yMax: number;
  /** Les points [année, valeur], dans l'ordre. */
  points: [number, number][];
  /** Nombre de premiers points montrés au départ. */
  given: number;
  source: string;
  /** Ce qu'il faut retenir, affiché avec la vraie courbe. */
  explain: string;
}

export const CURVES: Curve[] = [
  {
    id: "co2", theme: "climat", title: "Le CO₂ dans l'atmosphère", unit: "ppm", yMin: 280, yMax: 440, given: 1,
    points: [[1960, 317], [1970, 326], [1980, 339], [1990, 354], [2000, 369], [2010, 390], [2020, 414]],
    source: "NOAA et Scripps, observatoire de Mauna Loa (moyennes annuelles)",
    explain: "La hausse s'accélère : +9 ppm dans les années 1960, +24 dans les années 2010. Avant l'ère industrielle, on était à environ 280 ppm.",
  },
  {
    id: "population", theme: "sciences", title: "La population mondiale", unit: "milliards", yMin: 0, yMax: 10, given: 1,
    points: [[1950, 2.5], [1960, 3.0], [1970, 3.7], [1980, 4.4], [1990, 5.3], [2000, 6.1], [2010, 7.0], [2020, 7.8]],
    source: "Nations unies, World Population Prospects",
    explain: "Elle a plus que triplé en soixante-dix ans. Le rythme, lui, ralentit depuis les années 1970.",
  },
  {
    id: "esperance", theme: "sante", title: "L'espérance de vie dans le monde", unit: "ans", yMin: 30, yMax: 90, given: 1,
    points: [[1950, 46], [1960, 48], [1970, 56], [1980, 61], [1990, 64], [2000, 67], [2010, 70], [2019, 73]],
    source: "Nations unies, World Population Prospects",
    explain: "Vingt-sept ans gagnés en soixante-dix ans, d'abord grâce au recul de la mortalité des jeunes enfants.",
  },
  {
    id: "temperature", theme: "climat", title: "L'écart de température mondiale", unit: "°C", yMin: -0.5, yMax: 1.5, given: 2,
    points: [[1960, -0.03], [1970, 0.03], [1980, 0.26], [1990, 0.45], [2000, 0.39], [2010, 0.72], [2020, 1.01]],
    source: "NASA GISS, écart à la moyenne 1951-1980 (valeurs annuelles)",
    explain: "D'une année à l'autre la courbe zigzague (2000 a été plus fraîche que 1990), mais la tendance est nette : environ un degré de plus en cinquante ans.",
  },
  {
    id: "internautes", theme: "tech", title: "La part de l'humanité connectée à Internet", unit: "%", yMin: 0, yMax: 100, given: 1,
    points: [[2000, 7], [2005, 16], [2010, 29], [2015, 41], [2020, 60], [2023, 67]],
    source: "Union internationale des télécommunications (estimations arrondies)",
    explain: "Il a fallu vingt ans pour passer de moins d'un humain sur dix à deux sur trois. Un tiers de l'humanité reste hors ligne.",
  },
  {
    id: "mortalite", theme: "sante", title: "La mortalité des enfants de moins de 5 ans dans le monde", unit: "pour 1 000 naissances", yMin: 0, yMax: 120, given: 1,
    points: [[1990, 93], [1995, 87], [2000, 76], [2005, 63], [2010, 52], [2015, 43], [2020, 38]],
    source: "Nations unies, groupe inter-agences pour l'estimation de la mortalité infantile (UN IGME)",
    explain: "Divisée par plus de deux en trente ans : vaccins, moustiquaires, eau potable et réhydratation orale ont compté plus que les techniques de pointe.",
  },
  {
    id: "exoplanetes", theme: "espace", title: "Le nombre d'exoplanètes confirmées (cumul)", unit: "planètes", yMin: 0, yMax: 6000, given: 2,
    points: [[1995, 1], [2000, 50], [2005, 180], [2010, 520], [2015, 1950], [2020, 4350], [2023, 5550]],
    source: "NASA Exoplanet Archive (ordres de grandeur en fin d'année)",
    explain: "La première autour d'une étoile semblable au Soleil date de 1995. Le télescope spatial Kepler, lancé en 2009, a fait exploser le compteur.",
  },
  {
    id: "nucleaire", theme: "energie", title: "La part du nucléaire dans l'électricité produite en France", unit: "%", yMin: 0, yMax: 100, given: 1,
    points: [[1975, 10], [1980, 24], [1985, 65], [1990, 75], [2000, 76], [2010, 75], [2020, 67]],
    source: "RTE et Agence internationale de l'énergie (valeurs arrondies)",
    explain: "L'essentiel du parc a été mis en service en une quinzaine d'années, après le choc pétrolier de 1973.",
  },
  {
    id: "banquise", theme: "climat", title: "L'étendue de la banquise arctique en septembre", unit: "millions de km²", yMin: 0, yMax: 10, given: 1,
    points: [[1980, 7.7], [1990, 6.1], [2000, 6.3], [2010, 4.9], [2020, 4.0]],
    source: "NSIDC, moyenne du mois de septembre",
    explain: "Septembre est le mois du minimum annuel. Le record bas date de 2012 : 3,6 millions de km².",
  },
  {
    id: "lancements", theme: "espace", title: "Le nombre de lancements orbitaux par an dans le monde", unit: "lancements", yMin: 0, yMax: 250, given: 1,
    points: [[2000, 85], [2005, 55], [2010, 74], [2015, 87], [2020, 114], [2023, 223]],
    source: "décomptes annuels des tentatives de lancement orbital (Jonathan McDowell)",
    explain: "Après un creux au milieu des années 2000, les lanceurs réutilisables et les constellations de satellites ont fait doubler le rythme en trois ans.",
  },
  {
    id: "mobiles", theme: "tech", title: "Le nombre d'abonnements mobiles dans le monde", unit: "milliards", yMin: 0, yMax: 10, given: 1,
    points: [[2000, 0.7], [2005, 2.2], [2010, 5.3], [2015, 7.2], [2020, 8.3]],
    source: "Union internationale des télécommunications (valeurs arrondies)",
    explain: "Il y a aujourd'hui plus d'abonnements mobiles que d'habitants sur Terre : beaucoup de personnes en ont plusieurs.",
  },
  {
    id: "mer", theme: "climat", title: "La hausse du niveau moyen des mers depuis 1993", unit: "cm", yMin: -2, yMax: 14, given: 1,
    points: [[1993, 0], [2003, 3], [2013, 6.5], [2023, 10]],
    source: "altimétrie par satellite (NASA, CNES), valeurs arrondies",
    explain: "Environ dix centimètres en trente ans, et le rythme augmente : l'eau se dilate en se réchauffant, les glaciers et les calottes fondent.",
  },
  {
    id: "eolien-solaire", theme: "energie", title: "La part de l'éolien et du solaire dans l'électricité mondiale", unit: "%", yMin: 0, yMax: 20, given: 1,
    points: [[2000, 0.2], [2005, 0.6], [2010, 1.7], [2015, 4.6], [2020, 9.4], [2023, 13.4]],
    source: "Ember, Global Electricity Review",
    explain: "Presque rien en 2000, plus d'un huitième de l'électricité mondiale en 2023 : la part double à peu près tous les cinq ans.",
  },
];

/** Hauteur d'une valeur sur le graphique, de 0 (bas de l'axe) à 100 (haut). */
export function height(curve: Curve, value: number): number {
  return Math.round(((value - curve.yMin) / (curve.yMax - curve.yMin)) * 1000) / 10;
}

/** La valeur que représente une hauteur de 0 à 100. */
export function valueAt(curve: Curve, pos: number): number {
  return curve.yMin + (pos / 100) * (curve.yMax - curve.yMin);
}

/** Nombre de points à tracer pour une courbe. */
export const toDraw = (curve: Curve) => curve.points.length - curve.given;

export function courbeGame(seed: string): Curve[] {
  return shuffle(CURVES, seededRandom(`courbe-${seed}`)).slice(0, COURBE_ROUND);
}

/** Une case par point tracé : `picks[c][i]` est la hauteur proposée (0 à 100) pour le i-ième point à tracer de la courbe c. */
export function markCourbes(curves: readonly Curve[], picks: readonly (readonly number[])[]): boolean[] {
  return curves.flatMap((curve, c) =>
    curve.points.slice(curve.given).map(([, value], i) => Math.abs((picks[c]?.[i] ?? -999) - height(curve, value)) <= COURBE_TOLERANCE),
  );
}
