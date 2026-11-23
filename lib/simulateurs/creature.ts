// Simulateur « La créature d'une autre planète » : à partir de la gravité, de la température,
// de la pression atmosphérique, de la lumière de l'étoile et de la part de mers, on déduit une silhouette plausible et on explique chaque trait.
// Tout est calculé, sans hasard : les mêmes réglages donnent toujours la même créature.
// C'est de la spéculation raisonnée (aucune vie extraterrestre n'est connue), pas une prédiction.

export type Planet = {
  /** Gravité de surface, en g terrestres. */
  g: number;
  /** Température moyenne de surface, en °C. */
  t: number;
  /** Pression atmosphérique au sol, en bars. */
  p: number;
  /** Lumière reçue de l'étoile, en multiples de celle que reçoit la Terre. */
  l: number;
  /** Part de la surface couverte de liquide (mers, lacs), en %. */
  w: number;
};

export const RANGES = {
  g: { min: 0.1, max: 3, step: 0.1 },
  t: { min: -180, max: 200, step: 5 },
  p: { min: 0, max: 5, step: 0.1 },
  l: { min: 0, max: 2, step: 0.1 },
  w: { min: 0, max: 100, step: 5 },
} as const;

export const EARTH: Planet = { g: 1, t: 15, p: 1, l: 1, w: 70 };

export const PRESETS: { name: string; planet: Planet }[] = [
  { name: "Terre", planet: EARTH },
  { name: "Mars", planet: { g: 0.4, t: -60, p: 0, l: 0.4, w: 0 } },
  { name: "Titan", planet: { g: 0.1, t: -180, p: 1.5, l: 0, w: 20 } },
  { name: "Super-Terre chaude", planet: { g: 2.2, t: 80, p: 3, l: 1.6, w: 10 } },
  { name: "Monde brumeux", planet: { g: 0.5, t: 30, p: 4.5, l: 0.3, w: 60 } },
  { name: "Monde-océan", planet: { g: 1.2, t: 10, p: 1.5, l: 0.8, w: 100 } },
];

export type Locomotion = "marche" | "vol" | "flotte" | "fouit" | "nage";
export type Cover = "fourrure" | "peau" | "ecailles" | "carapace";

export type Trait = { label: string; value: string; why: string };

export type Creature = {
  /** Nom savant inventé, ex. « Gravipes glacialis ». */
  name: string;
  /** Nom courant, ex. « Rampeur trapu des glaces ». */
  common: string;
  heightM: number;
  massKg: number;
  locomotion: Locomotion;
  cover: Cover;
  /** Proportions du dessin, toutes entre 0 et 1 (sauf les nombres entiers). */
  legs: number;
  legLength: number;
  legWidth: number;
  bodyW: number;
  bodyH: number;
  neck: number;
  tail: number;
  wings: number;
  sacs: number;
  eyes: number;
  nostrils: number;
  ears: number;
  coverDensity: number;
  /** Antennes (0 à 1) quand la vue ne sert à rien ; points lumineux ; pieds palmés ; bosse de réserve d'eau. */
  antennae: number;
  glow: boolean;
  webbed: boolean;
  hump: boolean;
  fill: string;
  traits: Trait[];
  /** Avertissement quand la vie en surface est très improbable. */
  caveat: string | null;
};

const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));
const snap = (x: number, r: { min: number; max: number; step: number }) => {
  const v = Number.isFinite(x) ? x : r.min;
  return Number((Math.round(clamp(v, r.min, r.max) / r.step) * r.step).toFixed(2));
};

/** Ramène des valeurs quelconques (adresse partagée, saisie) dans les bornes des curseurs. */
export function clampPlanet(raw: { g?: unknown; t?: unknown; p?: unknown; l?: unknown; w?: unknown }): Planet {
  const num = (v: unknown, fallback: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    g: snap(num(raw.g, EARTH.g), RANGES.g),
    t: snap(num(raw.t, EARTH.t), RANGES.t),
    p: snap(num(raw.p, EARTH.p), RANGES.p),
    l: snap(num(raw.l, EARTH.l), RANGES.l),
    w: snap(num(raw.w, EARTH.w), RANGES.w),
  };
}

const fr = (n: number, digits = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits });

/** Repères parlants affichés sous chaque curseur. */
export function describeGravity(g: number) {
  if (g <= 0.2) return "comme sur la Lune ou Titan";
  if (g <= 0.5) return "comme sur Mars";
  if (g < 0.9) return "plus légère que sur Terre";
  if (g <= 1.1) return "comme sur Terre";
  if (g <= 2) return "une super-Terre";
  return "écrasante";
}
export function describeTemperature(t: number) {
  if (t <= -150) return "froid de Titan : le méthane y est liquide";
  if (t <= -40) return "froid martien";
  if (t < 0) return "glacial";
  if (t <= 35) return "tempéré";
  if (t <= 70) return "désert brûlant";
  if (t <= 110) return "proche de l’ébullition de l’eau";
  return "fournaise";
}
export function describePressure(p: number) {
  if (p < 0.05) return "presque le vide";
  if (p < 0.5) return "air très ténu, comme en haute montagne";
  if (p <= 1.3) return "comme sur Terre";
  if (p <= 3) return "air épais";
  return "air très dense, presque un brouillard qui porte";
}

export function describeLight(l: number) {
  if (l <= 0.05) return "nuit permanente, comme sur une planète sans étoile";
  if (l < 0.3) return "pénombre : étoile lointaine ou naine rouge";
  if (l < 0.8) return "lumière douce, comme sur Mars";
  if (l <= 1.2) return "comme sur Terre";
  return "lumière écrasante";
}
export function describeWater(w: number, t: number) {
  const what = t < -90 ? "de méthane liquide" : t < 0 ? "d’eau sous la glace" : "d’eau";
  if (w < 15) return "monde aride, presque sans mers";
  if (w < 75) return `des continents et des mers ${what}`;
  if (w < 90) return `surtout des mers ${what}, quelques îles`;
  return `monde-océan ${what}`;
}

/** Mélange une couleur avec du blanc (k > 0) ou du noir (k < 0). */
function shade(hex: string, k: number) {
  const target = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  return "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - a) + target * a).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function creatureFor(input: Planet): Creature {
  const { g, t, p, l, w } = clampPlanet(input);
  const stock = clamp((g - RANGES.g.min) / (RANGES.g.max - RANGES.g.min));
  const airless = p < 0.05;
  // Portance : plus l'air est dense et la gravité faible, plus il est facile de quitter le sol.
  const lift = airless ? 0 : p / g;
  const scorching = t > 120;

  // Au-delà de 110 °C les mers s'évaporent : elles ne comptent plus.
  const seas = t > 110 ? 0 : w;
  const ocean = !airless && seas >= 90;
  const locomotion: Locomotion =
    airless || (scorching && lift < 8) ? "fouit" : ocean ? "nage" : lift >= 8 ? "flotte" : lift >= 2.5 ? "vol" : "marche";
  const webbed = locomotion === "marche" && seas >= 75;
  const hump = locomotion === "marche" && !airless && seas < 15;
  // Lumière qui atteint vraiment l'animal : une atmosphère épaisse ou l'eau en filtrent une partie.
  const dark = l <= 0.05;
  const lightAtBody = l * (airless ? 1 : clamp(1 - p / 8, 0.35, 1)) * (locomotion === "nage" ? 0.5 : 1);
  const glow = !airless && l < 0.3;

  const cover: Cover = t < -20 ? "fourrure" : t <= 45 ? "peau" : t <= 110 ? "ecailles" : "carapace";
  const coverDensity = cover === "fourrure" ? clamp((-20 - t) / 100, 0.3, 1) : cover === "peau" ? 0.3 : cover === "ecailles" ? clamp((t - 45) / 65, 0.4, 1) : 1;
  const baseFill = t < -90 ? "#7F8FB0" : t < -20 ? "#DCE5EC" : t <= 45 ? (locomotion === "nage" ? "#9CC3CF" : "#BECBA4") : t <= 110 ? "#DDAA72" : "#9A5A48";
  // Beaucoup de lumière : pigments sombres qui protègent ; presque pas : inutile de se colorer.
  const fill = l > 1.4 ? shade(baseFill, -0.3) : l < 0.3 ? shade(baseFill, 0.45) : baseFill;

  const legs = locomotion === "flotte" || locomotion === "nage" ? 0 : locomotion === "vol" ? 2 : locomotion === "fouit" ? 6 : g < 0.5 ? 2 : g < 1.2 ? 4 : g < 2 ? 6 : 8;
  const legLength = locomotion === "fouit" ? 0.12 : locomotion === "vol" ? 0.2 : 0.75 - 0.55 * stock;
  const legWidth = 0.15 + 0.6 * stock;
  const cold = clamp(-t / 150);
  const bodyW = locomotion === "fouit" || locomotion === "nage" ? 0.9 : 0.55 + 0.35 * stock;
  const bodyH = clamp(0.5 - 0.2 * stock + 0.08 * cold, 0.25, 0.6);
  const neck = locomotion === "marche" ? 0.7 * (1 - stock) : locomotion === "vol" ? 0.25 : 0.1;
  const tail = locomotion === "marche" ? 1 - stock : locomotion === "vol" ? 0.5 : locomotion === "nage" ? 1 : 0;
  // Plus l'air porte, plus l'aile peut être petite.
  const wings = locomotion === "vol" ? clamp(1.15 - lift / 8, 0.35, 1) : 0;
  const sacs = locomotion === "flotte" ? (lift >= 20 ? 2 : 3) : 0;
  const eyes = dark ? 0 : airless ? 0.15 : clamp(0.95 - 0.6 * lightAtBody, 0.12, 1);
  const antennae = dark ? 1 : 0;
  const nostrils = airless ? 0 : clamp(1 - p / 0.6);
  const ears = cover === "carapace" ? 0 : clamp((t - 30) / 90);

  // Taille : la gravité limite ce qu'un squelette peut porter ; le froid favorise les grands corps
  // (ils perdent moins de chaleur), la chaleur les petits.
  let height = 1.7 / Math.pow(g, 0.7);
  if (t < 0) height *= 1 + Math.min(0.4, -t / 300);
  if (t > 40) height *= 1 - Math.min(0.3, (t - 40) / 300);
  if (locomotion === "vol" || locomotion === "fouit") height *= 0.5;
  if (locomotion === "flotte") height *= 1.5;
  // Dans l'eau, la poussée d'Archimède porte le corps : la gravité limite beaucoup moins la taille.
  if (locomotion === "nage") height = (1.7 / Math.pow(g, 0.2)) * 1.8 * (t < 0 ? 1.3 : 1);
  const heightM = Number(clamp(height, 0.2, 9).toFixed(height < 1 ? 2 : 1));
  const density = locomotion === "flotte" ? 0.05 : locomotion === "vol" ? 0.35 : locomotion === "nage" ? 2.2 : 0.6 + 0.9 * stock;
  // Un corps bas et large pèse bien plus que sa seule hauteur ne le laisse penser.
  const girth = locomotion === "marche" || locomotion === "fouit" ? clamp(bodyW / bodyH / 1.3, 0.8, 2.5) : 1;
  const mass = 65 * Math.pow(heightM / 1.7, 3) * density * girth;
  const massKg = mass < 10 ? Number(mass.toFixed(1)) : Math.round(mass);

  const genus =
    locomotion === "vol" ? "Aeropteryx" : locomotion === "flotte" ? "Pneumonatans" : locomotion === "fouit" ? "Subterranis" : locomotion === "nage" ? "Thalassonatans"
    : g >= 2 ? "Gravipes" : g >= 1.2 ? "Robustipes" : g >= 0.5 ? "Ambulator" : "Longicrus";
  const species = t < -90 ? "methanicus" : t < -20 ? "glacialis" : t <= 45 ? "temperatus" : t <= 110 ? "ardens" : "ignifer";
  const base =
    locomotion === "vol" ? "Planeur" : locomotion === "flotte" ? "Flotteur à sacs" : locomotion === "fouit" ? "Fouisseur" : locomotion === "nage" ? "Nageur"
    : g >= 2 ? "Rampeur trapu" : g >= 1.2 ? "Marcheur massif" : g >= 0.5 ? "Coureur" : "Échassier géant";
  const climate =
    locomotion === "nage"
      ? t < -90 ? "des mers de méthane" : t < 0 ? "des océans sous la glace" : t <= 45 ? "des océans tempérés" : "des mers chaudes"
      : t < -90 ? "des mers de méthane" : t < -20 ? "des glaces" : t <= 45 ? (webbed ? "des archipels" : hump ? "des steppes arides" : "des plaines tempérées") : t <= 110 ? "des déserts brûlants" : "des fournaises";

  const traits: Trait[] = [];
  traits.push(
    locomotion === "marche"
      ? g >= 1.2
        ? { label: "Silhouette", value: `corps bas et large, ${legs} pattes épaisses`, why: `Sous ${fr(g)} g, chaque kilo pèse ${fr(g)} fois plus : il faut répartir le poids sur davantage d’appuis et rester près du sol pour ne pas se briser en tombant.` }
        : g >= 0.5
          ? { label: "Silhouette", value: `corps équilibré, ${legs} pattes`, why: `Une gravité proche de celle de la Terre autorise des proportions familières : quatre appuis suffisent pour courir sans s’effondrer.` }
          : { label: "Silhouette", value: `corps élancé, ${legs} longues pattes fines`, why: `Avec ${fr(g)} g, le squelette porte très peu : on peut grandir en hauteur, sur des membres fins, et se déplacer par grands bonds.` }
      : locomotion === "vol"
        ? { label: "Silhouette", value: "corps léger, deux pattes courtes pour se poser", why: `Tout ce qui pèse coûte de l’énergie en vol : le corps est réduit, les pattes ne servent qu’à l’atterrissage.` }
        : locomotion === "nage"
          ? { label: "Silhouette", value: "corps fuselé, nageoires, queue en éventail", why: `Dans l’eau, la poussée d’Archimède porte le corps : la gravité (${fr(g)} g) compte peu, ce qui permet de devenir grand. Seule la forme compte, pour fendre le liquide.` }
        : locomotion === "flotte"
          ? { label: "Silhouette", value: "petit corps suspendu, tentacules pendants", why: `Inutile de se tenir debout quand on ne touche jamais le sol : les membres deviennent des tentacules pour attraper la nourriture en passant.` }
          : { label: "Silhouette", value: "corps aplati, six pattes courtes à griffes", why: `Une vie sous la surface demande de creuser et de se faufiler : un corps plat et des griffes puissantes.` },
  );
  traits.push(
    locomotion === "vol"
      ? { label: "Déplacement", value: wings > 0.7 ? "vol, grandes ailes membraneuses" : "vol, ailes courtes", why: `L’air à ${fr(p)} bar est assez dense, pour une gravité de ${fr(g)} g, pour porter un animal : ${wings > 0.7 ? "il faut encore une grande surface d’aile" : "de petites ailes suffisent"}.` }
      : locomotion === "nage"
        ? { label: "Déplacement", value: t < 0 && t >= -90 ? "nage sous la banquise" : "nage", why: t < 0 && t >= -90 ? `La surface est gelée, mais un océan peut rester liquide sous la glace, comme on le soupçonne sur Europe, une lune de Jupiter.` : `Avec ${w} % de la surface sous les mers, la vie n’a presque nulle part où poser le pied.` }
      : locomotion === "flotte"
        ? { label: "Déplacement", value: `flotte grâce à ${sacs} sacs de gaz léger`, why: `Un air très dense (${fr(p)} bar) et une gravité faible (${fr(g)} g) : un sac rempli d’un gaz plus léger que l’air suffit à tenir en l’air, comme un dirigeable.` }
        : locomotion === "fouit"
          ? airless
            ? { label: "Déplacement", value: "vit sous la surface", why: `Sans atmosphère, rien ne protège des radiations ni des écarts de température : la vie se réfugie dans le sol, là où il peut rester de l’eau ou de la glace.` }
            : { label: "Déplacement", value: "vit sous terre, sort la nuit", why: `À ${t} °C en surface, le sol est le seul abri : quelques mètres de roche suffisent à garder une température supportable.` }
          : { label: "Déplacement", value: g < 0.5 ? "marche et grands bonds" : "marche", why: `L’air (${fr(p)} bar) ne porte pas assez pour compenser ${fr(g)} g : voler coûterait trop d’énergie, la vie reste au sol.` },
  );
  if (!airless) {
    traits.push(
      p < 0.5
        ? { label: "Respiration", value: "larges narines et poitrine volumineuse", why: `Dans un air ténu, chaque inspiration apporte peu de gaz utile : il faut brasser un grand volume.` }
        : p > 2
          ? { label: "Respiration", value: "petites fentes respiratoires", why: `Un air dense apporte beaucoup de gaz à chaque inspiration : de petites ouvertures suffisent et limitent la perte d’eau.` }
          : { label: "Respiration", value: "narines ordinaires", why: `La pression est proche de celle de la Terre : aucune adaptation particulière n’est nécessaire.` },
    );
  }
  traits.push(
    cover === "fourrure"
      ? { label: "Revêtement", value: t < -90 ? "épaisse fourrure sombre sur une couche de graisse" : "fourrure claire et dense", why: t < -90 ? `À ${t} °C, il faut à la fois s’isoler et capter le peu de lumière disponible : un pelage sombre absorbe mieux la chaleur.` : `Le pelage emprisonne de l’air et garde la chaleur du corps ; un corps ramassé en perd moins.` }
      : cover === "peau"
        ? { label: "Revêtement", value: "peau nue ou poil ras", why: `Entre −20 et 45 °C, pas besoin d’isolation lourde ni de protection contre la chaleur.` }
        : cover === "ecailles"
          ? { label: "Revêtement", value: "écailles et grandes crêtes sur la tête", why: `Les écailles limitent l’évaporation ; les crêtes, parcourues de vaisseaux, évacuent la chaleur comme les oreilles d’un fennec.` }
          : { label: "Revêtement", value: "carapace épaisse et réfléchissante", why: `Au-delà de 110 °C, il faut renvoyer la chaleur et sceller le corps pour ne pas se dessécher.` },
  );
  traits.push(
    dark
      ? { label: "Sens", value: "aveugle, longues antennes", why: `Sans lumière, des yeux ne servent à rien : le toucher, les vibrations et l’odorat prennent le relais, comme chez les animaux des grottes.` }
      : airless
        ? { label: "Yeux", value: "minuscules, protégés", why: `Sous terre, la vue sert peu : d’autres sens (vibrations, chimie) prennent le relais.` }
        : eyes > 0.6
          ? { label: "Yeux", value: "très grands", why: `Peu de lumière atteint l’animal (étoile faible${p > 2 ? ", atmosphère épaisse" : ""}${locomotion === "nage" ? ", eau qui l’absorbe" : ""}) : de grands yeux en captent le plus possible.` }
          : eyes < 0.3
            ? { label: "Yeux", value: "petits, enfoncés sous une arcade", why: `Sous une lumière ${fr(l)} fois plus forte que sur Terre, il faut protéger la rétine plutôt que capter davantage.` }
            : { label: "Yeux", value: "de taille moyenne", why: `La lumière qui atteint le sol est comparable à celle de la Terre.` },
  );
  if (glow) traits.push({ label: "Signaux", value: "points lumineux le long du corps", why: `Dans l’obscurité, produire sa propre lumière sert à se reconnaître ou à attirer des proies, comme dans les abysses terrestres.` });
  else if (l > 1.4) traits.push({ label: "Couleur", value: "pigments sombres", why: `Une lumière intense abîme les cellules : des pigments foncés l’absorbent avant qu’elle ne fasse des dégâts.` });
  if (webbed) traits.push({ label: "Pattes", value: "pieds palmés", why: `Avec ${w} % de mers, il faut passer d’une île à l’autre : la palmure sert autant à nager qu’à marcher sur la vase.` });
  if (hump) traits.push({ label: "Réserves", value: "bosse de graisse sur le dos", why: `L’eau est rare : la graisse stockée en fournit en étant brûlée, comme chez le dromadaire.` });
  if (t > 110 && w > 0) traits.push({ label: "Mers", value: "évaporées", why: `À ${t} °C, aucune mer ne tient en surface : le réglage des mers ne change rien ici.` });
  traits.push(
    t < -90
      ? { label: "Métabolisme", value: "très lent, à base de méthane liquide", why: `L’eau est de la roche à cette température ; un autre liquide, comme le méthane sur Titan, devrait jouer son rôle. Les réactions y seraient très lentes.` }
      : t < 0
        ? { label: "Métabolisme", value: "sang chargé d’antigel", why: `Sous 0 °C, l’eau du corps gèlerait : des sels ou des sucres abaissent son point de congélation, comme chez certains poissons polaires.` }
        : t <= 45
          ? { label: "Métabolisme", value: "à base d’eau liquide", why: `C’est la plage où l’eau reste liquide et où la chimie du vivant terrestre fonctionne le mieux.` }
          : t <= 110
            ? { label: "Métabolisme", value: "protéines résistantes à la chaleur, vie nocturne", why: `Certaines bactéries terrestres vivent au-delà de 100 °C ; un grand animal éviterait en plus les heures les plus chaudes.` }
            : { label: "Métabolisme", value: "actif seulement à l’abri", why: `Aucune chimie du vivant connue ne tient à ${t} °C : il faut rester là où il fait plus frais.` },
  );

  const caveat = airless
    ? "Sans atmosphère, une vie complexe en surface est très improbable : cette créature vit sous le sol."
    : t > 150 || t < -150
      ? "À cette température, la vie telle qu’on la connaît est impossible : il faudrait une tout autre chimie."
      : null;

  return {
    name: `${genus} ${species}`,
    common: `${base}${dark ? " aveugle" : ""} ${climate}`,
    heightM,
    massKg,
    locomotion,
    cover,
    legs,
    legLength,
    legWidth,
    bodyW,
    bodyH,
    neck,
    tail,
    wings,
    sacs,
    eyes,
    nostrils,
    ears,
    coverDensity,
    antennae,
    glow,
    webbed,
    hump,
    fill,
    traits,
    caveat,
  };
}
