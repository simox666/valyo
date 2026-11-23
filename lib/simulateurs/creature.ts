// Simulateur « La créature d'une autre planète » : à partir de la gravité, de la température
// et de la pression atmosphérique, on déduit une silhouette plausible et on explique chaque trait.
// Tout est calculé, sans hasard : les mêmes réglages donnent toujours la même créature.
// C'est de la spéculation raisonnée (aucune vie extraterrestre n'est connue), pas une prédiction.

export type Planet = {
  /** Gravité de surface, en g terrestres. */
  g: number;
  /** Température moyenne de surface, en °C. */
  t: number;
  /** Pression atmosphérique au sol, en bars. */
  p: number;
};

export const RANGES = {
  g: { min: 0.1, max: 3, step: 0.1 },
  t: { min: -180, max: 200, step: 5 },
  p: { min: 0, max: 5, step: 0.1 },
} as const;

export const EARTH: Planet = { g: 1, t: 15, p: 1 };

export const PRESETS: { name: string; planet: Planet }[] = [
  { name: "Terre", planet: EARTH },
  { name: "Mars", planet: { g: 0.4, t: -60, p: 0 } },
  { name: "Titan", planet: { g: 0.1, t: -180, p: 1.5 } },
  { name: "Super-Terre chaude", planet: { g: 2.2, t: 80, p: 3 } },
  { name: "Monde brumeux", planet: { g: 0.5, t: 30, p: 4.5 } },
];

export type Locomotion = "marche" | "vol" | "flotte" | "fouit";
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
export function clampPlanet(raw: { g?: unknown; t?: unknown; p?: unknown }): Planet {
  const num = (v: unknown, fallback: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  return { g: snap(num(raw.g, EARTH.g), RANGES.g), t: snap(num(raw.t, EARTH.t), RANGES.t), p: snap(num(raw.p, EARTH.p), RANGES.p) };
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

export function creatureFor(input: Planet): Creature {
  const { g, t, p } = clampPlanet(input);
  const stock = clamp((g - RANGES.g.min) / (RANGES.g.max - RANGES.g.min));
  const airless = p < 0.05;
  // Portance : plus l'air est dense et la gravité faible, plus il est facile de quitter le sol.
  const lift = airless ? 0 : p / g;
  const scorching = t > 120;

  const locomotion: Locomotion = airless || (scorching && lift < 8) ? "fouit" : lift >= 8 ? "flotte" : lift >= 2.5 ? "vol" : "marche";

  const cover: Cover = t < -20 ? "fourrure" : t <= 45 ? "peau" : t <= 110 ? "ecailles" : "carapace";
  const coverDensity = cover === "fourrure" ? clamp((-20 - t) / 100, 0.3, 1) : cover === "peau" ? 0.3 : cover === "ecailles" ? clamp((t - 45) / 65, 0.4, 1) : 1;
  const fill = t < -90 ? "#7F8FB0" : t < -20 ? "#DCE5EC" : t <= 45 ? "#BECBA4" : t <= 110 ? "#DDAA72" : "#9A5A48";

  const legs = locomotion === "flotte" ? 0 : locomotion === "vol" ? 2 : locomotion === "fouit" ? 6 : g < 0.5 ? 2 : g < 1.2 ? 4 : g < 2 ? 6 : 8;
  const legLength = locomotion === "fouit" ? 0.12 : locomotion === "vol" ? 0.2 : 0.75 - 0.55 * stock;
  const legWidth = 0.15 + 0.6 * stock;
  const cold = clamp(-t / 150);
  const bodyW = locomotion === "fouit" ? 0.9 : 0.55 + 0.35 * stock;
  const bodyH = clamp(0.5 - 0.2 * stock + 0.08 * cold, 0.25, 0.6);
  const neck = locomotion === "marche" ? 0.7 * (1 - stock) : locomotion === "vol" ? 0.25 : 0.1;
  const tail = locomotion === "marche" ? 1 - stock : locomotion === "vol" ? 0.5 : 0;
  // Plus l'air porte, plus l'aile peut être petite.
  const wings = locomotion === "vol" ? clamp(1.15 - lift / 8, 0.35, 1) : 0;
  const sacs = locomotion === "flotte" ? (lift >= 20 ? 2 : 3) : 0;
  const eyes = airless ? 0.15 : clamp(0.3 + (p / RANGES.p.max) * 0.6);
  const nostrils = airless ? 0 : clamp(1 - p / 0.6);
  const ears = cover === "carapace" ? 0 : clamp((t - 30) / 90);

  // Taille : la gravité limite ce qu'un squelette peut porter ; le froid favorise les grands corps
  // (ils perdent moins de chaleur), la chaleur les petits.
  let height = 1.7 / Math.pow(g, 0.7);
  if (t < 0) height *= 1 + Math.min(0.4, -t / 300);
  if (t > 40) height *= 1 - Math.min(0.3, (t - 40) / 300);
  if (locomotion === "vol" || locomotion === "fouit") height *= 0.5;
  if (locomotion === "flotte") height *= 1.5;
  const heightM = Number(clamp(height, 0.2, 9).toFixed(height < 1 ? 2 : 1));
  const density = locomotion === "flotte" ? 0.05 : locomotion === "vol" ? 0.35 : 0.6 + 0.9 * stock;
  // Un corps bas et large pèse bien plus que sa seule hauteur ne le laisse penser.
  const girth = locomotion === "marche" || locomotion === "fouit" ? clamp(bodyW / bodyH / 1.3, 0.8, 2.5) : 1;
  const mass = 65 * Math.pow(heightM / 1.7, 3) * density * girth;
  const massKg = mass < 10 ? Number(mass.toFixed(1)) : Math.round(mass);

  const genus =
    locomotion === "vol" ? "Aeropteryx" : locomotion === "flotte" ? "Pneumonatans" : locomotion === "fouit" ? "Subterranis"
    : g >= 2 ? "Gravipes" : g >= 1.2 ? "Robustipes" : g >= 0.5 ? "Ambulator" : "Longicrus";
  const species = t < -90 ? "methanicus" : t < -20 ? "glacialis" : t <= 45 ? "temperatus" : t <= 110 ? "ardens" : "ignifer";
  const base =
    locomotion === "vol" ? "Planeur" : locomotion === "flotte" ? "Flotteur à sacs" : locomotion === "fouit" ? "Fouisseur"
    : g >= 2 ? "Rampeur trapu" : g >= 1.2 ? "Marcheur massif" : g >= 0.5 ? "Coureur" : "Échassier géant";
  const climate = t < -90 ? "des mers de méthane" : t < -20 ? "des glaces" : t <= 45 ? "des plaines tempérées" : t <= 110 ? "des déserts brûlants" : "des fournaises";

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
        : locomotion === "flotte"
          ? { label: "Silhouette", value: "petit corps suspendu, tentacules pendants", why: `Inutile de se tenir debout quand on ne touche jamais le sol : les membres deviennent des tentacules pour attraper la nourriture en passant.` }
          : { label: "Silhouette", value: "corps aplati, six pattes courtes à griffes", why: `Une vie sous la surface demande de creuser et de se faufiler : un corps plat et des griffes puissantes.` },
  );
  traits.push(
    locomotion === "vol"
      ? { label: "Déplacement", value: wings > 0.7 ? "vol, grandes ailes membraneuses" : "vol, ailes courtes", why: `L’air à ${fr(p)} bar est assez dense, pour une gravité de ${fr(g)} g, pour porter un animal : ${wings > 0.7 ? "il faut encore une grande surface d’aile" : "de petites ailes suffisent"}.` }
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
    airless
      ? { label: "Yeux", value: "minuscules, protégés", why: `Sous terre, la vue sert peu : d’autres sens (vibrations, chimie) prennent le relais.` }
      : eyes > 0.6
        ? { label: "Yeux", value: "très grands", why: `Une atmosphère épaisse filtre la lumière : de grands yeux captent le peu qui atteint le sol.` }
        : { label: "Yeux", value: "de taille moyenne", why: `La lumière traverse bien une atmosphère de cette épaisseur.` },
  );
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
    common: `${base} ${climate}`,
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
    fill,
    traits,
    caveat,
  };
}
