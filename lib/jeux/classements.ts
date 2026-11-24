// Séries ordonnées des jeux « La frise » (dates) et « Plus ou moins » (grandeurs).
// Chaque série est rattachée à un thème (même slug qu'en base) et ses éléments sont
// rangés du plus ancien au plus récent, ou du plus petit au plus grand : `n` sert au
// classement (et au test de cohérence), `display` est ce qu'on montre au joueur.
// Comme pour les questions : des faits établis et stables, jamais d'actualité récente.

export interface RankedItem {
  label: string;
  /** Valeur numérique de classement (année, ou grandeur dans une unité commune à la série). */
  n: number;
  /** Valeur affichée après la réponse. */
  display: string;
}

export interface RankedSet {
  /** Slug du thème (table themes). */
  theme: string;
  kind: "dates" | "grandeurs";
  title: string;
  /** Pour les grandeurs : la question du duel, dont la bonne réponse est l'élément le plus grand. */
  question: string;
  /** Vrai pour une échelle sans zéro naturel (températures) : « trois fois plus chaud » n'aurait pas de sens. */
  noRatio?: boolean;
  items: RankedItem[];
}

const year = (label: string, n: number): RankedItem => ({ label, n, display: String(n) });

export const RANKED_SETS: RankedSet[] = [
  // ——— Frises chronologiques ———
  {
    theme: "espace", kind: "dates", title: "La conquête spatiale", question: "",
    items: [
      year("Spoutnik 1, premier satellite artificiel", 1957),
      year("Youri Gagarine, premier humain dans l'espace", 1961),
      year("Premiers pas sur la Lune (Apollo 11)", 1969),
      year("Lancement de la sonde Voyager 1", 1977),
      year("Mise en orbite du télescope Hubble", 1990),
      year("Premier module de la Station spatiale internationale", 1998),
      year("Le rover Curiosity se pose sur Mars", 2012),
      year("Lancement du télescope James Webb", 2021),
    ],
  },
  {
    theme: "ia", kind: "dates", title: "Les grandes dates de l'IA", question: "",
    items: [
      year("Alan Turing publie « Computing Machinery and Intelligence »", 1950),
      year("Conférence de Dartmouth, naissance du terme « intelligence artificielle »", 1956),
      year("Deep Blue bat Garry Kasparov aux échecs", 1997),
      year("AlphaGo bat Lee Sedol au jeu de go", 2016),
      year("Article « Attention Is All You Need » (architecture Transformer)", 2017),
      year("Lancement public de ChatGPT", 2022),
    ],
  },
  {
    theme: "tech", kind: "dates", title: "L'informatique en marche", question: "",
    items: [
      year("Présentation de l'ENIAC", 1946),
      year("Invention du transistor aux Bell Labs", 1947),
      year("Premier message échangé sur ARPANET", 1969),
      year("Intel 4004, premier microprocesseur commercial", 1971),
      year("Sortie du Macintosh d'Apple", 1984),
      year("Tim Berners-Lee propose le World Wide Web", 1989),
      year("Sortie du premier iPhone", 2007),
    ],
  },
  {
    theme: "sciences", kind: "dates", title: "Les idées qui ont changé la science", question: "",
    items: [
      year("Newton publie les Principia", 1687),
      year("Lavoisier publie son Traité élémentaire de chimie", 1789),
      year("Mendeleïev propose son tableau périodique", 1869),
      year("Becquerel découvre la radioactivité", 1896),
      year("Wegener présente la dérive des continents", 1912),
      year("Hubble établit l'expansion de l'Univers", 1929),
    ],
  },
  {
    theme: "physique", kind: "dates", title: "Un siècle de physique", question: "",
    items: [
      year("Röntgen découvre les rayons X", 1895),
      year("Thomson découvre l'électron", 1897),
      year("Einstein publie la relativité restreinte", 1905),
      year("Einstein achève la relativité générale", 1915),
      year("Découverte du boson de Higgs annoncée au CERN", 2012),
      year("Première détection directe d'ondes gravitationnelles", 2015),
    ],
  },
  {
    theme: "sante", kind: "dates", title: "Les tournants de la médecine", question: "",
    items: [
      year("Jenner met au point la vaccination contre la variole", 1796),
      year("Pasteur administre le premier vaccin contre la rage", 1885),
      year("Fleming découvre la pénicilline", 1928),
      year("Première greffe de cœur humain", 1967),
      year("L'OMS déclare la variole éradiquée", 1980),
      year("Séquençage du génome humain achevé", 2003),
    ],
  },
  {
    theme: "biologie", kind: "dates", title: "Comprendre le vivant", question: "",
    items: [
      year("Darwin publie L'Origine des espèces", 1859),
      year("Mendel présente ses lois de l'hérédité", 1865),
      year("Découverte de la structure en double hélice de l'ADN", 1953),
      year("Naissance de la brebis clonée Dolly", 1996),
      year("Publication de l'outil d'édition génétique CRISPR-Cas9", 2012),
    ],
  },
  {
    theme: "climat", kind: "dates", title: "La prise de conscience climatique", question: "",
    items: [
      year("Arrhenius calcule l'effet du CO₂ sur la température", 1896),
      year("Début des mesures continues de CO₂ à Mauna Loa", 1958),
      year("Création du GIEC", 1988),
      year("Sommet de la Terre de Rio", 1992),
      year("Adoption du protocole de Kyoto", 1997),
      year("Adoption de l'accord de Paris", 2015),
    ],
  },
  {
    theme: "energie", kind: "dates", title: "Deux siècles d'énergie", question: "",
    items: [
      year("Volta présente la première pile électrique", 1800),
      year("Edison ouvre la centrale électrique de Pearl Street", 1882),
      year("Première réaction nucléaire en chaîne contrôlée", 1942),
      year("Première cellule photovoltaïque au silicium", 1954),
      year("Accident de Tchernobyl", 1986),
      year("Accident de Fukushima", 2011),
    ],
  },
  {
    theme: "robotique", kind: "dates", title: "L'histoire des robots", question: "",
    items: [
      year("Karel Čapek invente le mot « robot » dans R.U.R.", 1920),
      year("Asimov formule les trois lois de la robotique", 1942),
      year("Unimate, premier robot industriel en usine", 1961),
      year("Sojourner, premier rover sur Mars", 1997),
      year("Honda présente le robot humanoïde ASIMO", 2000),
      year("Sortie de l'aspirateur robot Roomba", 2002),
    ],
  },
  {
    theme: "cyber", kind: "dates", title: "Cryptographie et cyberattaques", question: "",
    items: [
      year("Diffie et Hellman publient l'échange de clés", 1976),
      year("Invention du chiffrement RSA", 1977),
      year("Le ver Morris paralyse une partie d'Internet", 1988),
      year("Le virus ILOVEYOU se propage par e-mail", 2000),
      year("Découverte du ver Stuxnet", 2010),
      year("Le rançongiciel WannaCry frappe dans le monde entier", 2017),
    ],
  },

  // ——— Grandeurs : du plus petit au plus grand ———
  {
    theme: "espace", kind: "grandeurs", title: "Diamètres du Système solaire", question: "Lequel a le plus grand diamètre ?",
    items: [
      { label: "La Lune", n: 3474, display: "3 474 km" },
      { label: "Mercure", n: 4879, display: "4 879 km" },
      { label: "Mars", n: 6779, display: "6 779 km" },
      { label: "Vénus", n: 12104, display: "12 104 km" },
      { label: "La Terre", n: 12742, display: "12 742 km" },
      { label: "Neptune", n: 49244, display: "49 244 km" },
      { label: "Saturne", n: 116460, display: "116 460 km" },
      { label: "Jupiter", n: 139820, display: "139 820 km" },
    ],
  },
  {
    theme: "physique", kind: "grandeurs", title: "Vitesses", question: "Lequel va le plus vite ?",
    items: [
      { label: "Un guépard en pleine course", n: 100, display: "environ 100 km/h" },
      { label: "Un TGV en service", n: 320, display: "320 km/h" },
      { label: "Un avion de ligne", n: 900, display: "environ 900 km/h" },
      { label: "Le son dans l'air", n: 1235, display: "environ 1 235 km/h" },
      { label: "La Station spatiale internationale", n: 28000, display: "environ 28 000 km/h" },
      { label: "La Terre autour du Soleil", n: 107000, display: "environ 107 000 km/h" },
      { label: "La lumière dans le vide", n: 1080000000, display: "environ 1,08 milliard de km/h" },
    ],
  },
  {
    theme: "energie", kind: "grandeurs", title: "Puissances", question: "Lequel a la plus grande puissance ?",
    items: [
      { label: "Une ampoule LED", n: 10, display: "environ 10 W" },
      { label: "Une bouilloire électrique", n: 2000, display: "environ 2 000 W" },
      { label: "Une éolienne terrestre", n: 3e6, display: "environ 3 MW" },
      { label: "Une rame de TGV", n: 9e6, display: "environ 9 MW" },
      { label: "Un réacteur nucléaire", n: 1e9, display: "environ 1 000 MW" },
      { label: "Le barrage des Trois-Gorges", n: 22.5e9, display: "22 500 MW" },
    ],
  },
  {
    theme: "biologie", kind: "grandeurs", title: "Tailles du vivant", question: "Lequel est le plus grand ?",
    items: [
      { label: "Un virus de la grippe", n: 0.1, display: "environ 0,1 micromètre" },
      { label: "Une bactérie E. coli", n: 2, display: "environ 2 micromètres" },
      { label: "Un globule rouge", n: 7, display: "environ 7 micromètres" },
      { label: "Un ovule humain", n: 120, display: "environ 0,12 mm" },
      { label: "Un acarien", n: 300, display: "environ 0,3 mm" },
      { label: "Une fourmi", n: 5000, display: "environ 5 mm" },
    ],
  },
  {
    theme: "sante", kind: "grandeurs", title: "Le corps humain en nombres", question: "Dans le corps d'un adulte, lesquels sont les plus nombreux ?",
    items: [
      { label: "Les dents", n: 32, display: "32" },
      { label: "Les os", n: 206, display: "206" },
      { label: "Les muscles", n: 600, display: "plus de 600" },
      { label: "Les neurones", n: 86e9, display: "environ 86 milliards" },
      { label: "Les globules rouges", n: 25e12, display: "environ 25 000 milliards" },
    ],
  },
  {
    theme: "tech", kind: "grandeurs", title: "Capacités de stockage", question: "Lequel stocke le plus de données ?",
    items: [
      { label: "Une disquette 3,5 pouces", n: 1.44, display: "1,44 Mo" },
      { label: "Un CD", n: 700, display: "700 Mo" },
      { label: "Un DVD simple couche", n: 4700, display: "4,7 Go" },
      { label: "Un Blu-ray simple couche", n: 25000, display: "25 Go" },
    ],
  },
  {
    theme: "climat", kind: "grandeurs", title: "Composition de l'air", question: "Lequel est le plus abondant dans l'atmosphère ?",
    items: [
      { label: "Le méthane", n: 0.0002, display: "environ 0,0002 %" },
      { label: "Le dioxyde de carbone", n: 0.04, display: "environ 0,04 %" },
      { label: "L'argon", n: 0.93, display: "0,93 %" },
      { label: "L'oxygène", n: 21, display: "21 %" },
      { label: "L'azote", n: 78, display: "78 %" },
    ],
  },
  {
    theme: "sciences", kind: "grandeurs", title: "Températures", question: "Lequel est le plus chaud ?", noRatio: true,
    items: [
      { label: "L'azote liquide", n: -196, display: "−196 °C" },
      { label: "La glace qui fond", n: 0, display: "0 °C" },
      { label: "Le corps humain", n: 37, display: "37 °C" },
      { label: "L'eau qui bout", n: 100, display: "100 °C" },
      { label: "La lave d'un volcan", n: 1000, display: "environ 1 000 °C" },
      { label: "La surface du Soleil", n: 5500, display: "environ 5 500 °C" },
      { label: "Le cœur du Soleil", n: 15e6, display: "environ 15 millions de °C" },
    ],
  },
  {
    theme: "cyber", kind: "grandeurs", title: "Nombre de combinaisons", question: "Lequel offre le plus de combinaisons possibles ?",
    items: [
      { label: "Un code PIN à 4 chiffres", n: 1e4, display: "10 000" },
      { label: "Un code à 6 chiffres", n: 1e6, display: "1 million" },
      { label: "Un mot de passe de 8 lettres minuscules", n: 26 ** 8, display: "environ 209 milliards" },
      { label: "Une clé AES de 128 bits", n: 2 ** 128, display: "environ 3,4 × 10³⁸" },
    ],
  },
  {
    theme: "espace", kind: "grandeurs", title: "Distances au Soleil", question: "Laquelle est la plus éloignée du Soleil ?",
    items: [
      { label: "Mercure", n: 58, display: "58 millions de km" },
      { label: "Vénus", n: 108, display: "108 millions de km" },
      { label: "La Terre", n: 150, display: "150 millions de km" },
      { label: "Mars", n: 228, display: "228 millions de km" },
      { label: "Jupiter", n: 778, display: "778 millions de km" },
      { label: "Saturne", n: 1430, display: "1,43 milliard de km" },
      { label: "Uranus", n: 2870, display: "2,87 milliards de km" },
      { label: "Neptune", n: 4500, display: "4,5 milliards de km" },
    ],
  },
  {
    theme: "robotique", kind: "grandeurs", title: "Masses des rovers", question: "Quel rover est le plus lourd ?",
    items: [
      { label: "Sojourner (Mars, 1997)", n: 11.5, display: "11,5 kg" },
      { label: "Spirit (Mars, 2004)", n: 185, display: "185 kg" },
      { label: "Lunokhod 1 (Lune, 1970)", n: 756, display: "756 kg" },
      { label: "Curiosity (Mars, 2012)", n: 899, display: "899 kg" },
      { label: "Perseverance (Mars, 2021)", n: 1025, display: "1 025 kg" },
    ],
  },
  {
    theme: "sciences", kind: "grandeurs", title: "Points de fusion", question: "Lequel fond à la température la plus élevée ?", noRatio: true,
    items: [
      { label: "La glace", n: 0, display: "0 °C" },
      { label: "L'étain", n: 232, display: "232 °C" },
      { label: "Le plomb", n: 327, display: "327 °C" },
      { label: "L'aluminium", n: 660, display: "660 °C" },
      { label: "L'or", n: 1064, display: "1 064 °C" },
      { label: "Le fer", n: 1538, display: "1 538 °C" },
      { label: "Le tungstène", n: 3422, display: "3 422 °C" },
    ],
  },
  {
    theme: "physique", kind: "grandeurs", title: "Densités", question: "Lequel est le plus dense ?",
    items: [
      { label: "La glace", n: 0.92, display: "0,92 g/cm³" },
      { label: "L'eau liquide", n: 1, display: "1 g/cm³" },
      { label: "L'aluminium", n: 2.7, display: "2,7 g/cm³" },
      { label: "Le fer", n: 7.9, display: "7,9 g/cm³" },
      { label: "Le plomb", n: 11.3, display: "11,3 g/cm³" },
      { label: "L'or", n: 19.3, display: "19,3 g/cm³" },
      { label: "L'osmium", n: 22.6, display: "22,6 g/cm³" },
    ],
  },
  {
    theme: "biologie", kind: "grandeurs", title: "Longévités", question: "Lequel vit le plus longtemps ?",
    items: [
      { label: "Une souris", n: 2, display: "environ 2 ans" },
      { label: "Un chien", n: 13, display: "environ 13 ans" },
      { label: "Un cheval", n: 30, display: "environ 30 ans" },
      { label: "Un éléphant", n: 65, display: "environ 65 ans" },
      { label: "Une tortue géante", n: 150, display: "plus de 150 ans" },
      { label: "Un requin du Groenland", n: 270, display: "au moins 270 ans" },
    ],
  },
  {
    theme: "energie", kind: "grandeurs", title: "Énergie par kilogramme", question: "Lequel contient le plus d'énergie par kilogramme ?",
    items: [
      { label: "Une batterie lithium-ion", n: 0.25, display: "environ 0,25 kWh/kg" },
      { label: "Le bois sec", n: 4.5, display: "environ 4,5 kWh/kg" },
      { label: "Le charbon", n: 8, display: "environ 8 kWh/kg" },
      { label: "L'essence", n: 12, display: "environ 12 kWh/kg" },
      { label: "Le gaz naturel", n: 14, display: "environ 14 kWh/kg" },
      { label: "L'hydrogène", n: 33, display: "environ 33 kWh/kg" },
    ],
  },
  {
    theme: "climat", kind: "grandeurs", title: "Pouvoir de réchauffement", question: "À quantité égale, lequel réchauffe le plus le climat sur un siècle ?", noRatio: true,
    items: [
      { label: "Le dioxyde de carbone", n: 1, display: "référence : 1" },
      { label: "Le méthane", n: 28, display: "environ 28 fois le CO₂" },
      { label: "Le protoxyde d'azote", n: 273, display: "environ 270 fois le CO₂" },
      { label: "L'hexafluorure de soufre (SF₆)", n: 23500, display: "plus de 20 000 fois le CO₂" },
    ],
  },
  {
    theme: "tech", kind: "grandeurs", title: "Transistors par puce", question: "Quelle puce contient le plus de transistors ?",
    items: [
      { label: "Intel 4004 (1971)", n: 2300, display: "2 300" },
      { label: "Intel 8086 (1978)", n: 29000, display: "29 000" },
      { label: "Intel 486 (1989)", n: 1.2e6, display: "1,2 million" },
      { label: "Pentium 4 (2000)", n: 42e6, display: "42 millions" },
      { label: "Apple M1 (2020)", n: 16e9, display: "16 milliards" },
    ],
  },
  {
    theme: "ia", kind: "grandeurs", title: "Taille des réseaux de neurones", question: "Lequel compte le plus de paramètres ?",
    items: [
      { label: "LeNet-5 (1998)", n: 6e4, display: "environ 60 000" },
      { label: "AlexNet (2012)", n: 6e7, display: "environ 60 millions" },
      { label: "GPT-2 (2019)", n: 1.5e9, display: "environ 1,5 milliard" },
      { label: "GPT-3 (2020)", n: 175e9, display: "environ 175 milliards" },
    ],
  },
];

export const DATE_SETS = RANKED_SETS.filter((s) => s.kind === "dates");
export const SIZE_SETS = RANKED_SETS.filter((s) => s.kind === "grandeurs");
