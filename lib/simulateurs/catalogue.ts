// Les simulateurs de Valyo : une seule liste pour la page d'accueil des simulateurs, la page Jeux et le plan du site.
export const SIMULATORS = [
  { slug: "creature", theme: "Espace · Biologie", title: "La créature d’une autre planète", pitch: "Gravité, température, atmosphère, lumière, mers : découvrez l’animal qui pourrait y vivre." },
  { slug: "orbite", theme: "Espace", title: "Mise en orbite", pitch: "Choisissez la vitesse de lancement : l’engin retombe, se met en orbite ou quitte la Terre." },
  { slug: "poids-age", theme: "Espace", title: "Votre poids et votre âge ailleurs", pitch: "Ce qu’afficherait la balance sur Mars, et l’âge que vous auriez sur Jupiter." },
  { slug: "fentes", theme: "Physique", title: "Les fentes de Young", pitch: "Envoyez des particules une à une : la figure d’interférence apparaît… sauf si on les observe." },
  { slug: "mix-electrique", theme: "Énergie", title: "Le mix électrique", pitch: "Composez la production d’un pays : CO₂ émis, et ce qui se passe un soir d’hiver sans vent." },
  { slug: "climat", theme: "Climat", title: "Le thermostat de la Terre", pitch: "CO₂, albédo, Soleil, aérosols : voyez la température d’équilibre de la planète bouger." },
  { slug: "epidemie", theme: "Santé", title: "Épidémie", pitch: "Contagiosité, vaccination, isolement : la vague monte, plafonne ou s’éteint." },
  { slug: "selection", theme: "Biologie", title: "Sélection naturelle", pitch: "Changez la couleur du décor : la population dérive, génération après génération." },
  { slug: "neurone", theme: "IA", title: "Entraîner un réseau de neurones", pitch: "Posez des points de deux couleurs : le réseau apprend à les séparer sous vos yeux." },
  { slug: "mot-de-passe", theme: "Cyber", title: "Casser un mot de passe", pitch: "Combien de temps tiendrait-il face à un attaquant ? Rien ne quitte votre appareil." },
  { slug: "bras", theme: "Robotique", title: "Le bras articulé", pitch: "Déplacez la cible : le bras calcule seul les angles de chaque articulation." },
] as const;

export type SimulatorSlug = (typeof SIMULATORS)[number]["slug"];
export const simulator = (slug: SimulatorSlug) => SIMULATORS.find((s) => s.slug === slug)!;
