// Banque de questions des jeux « Quiz des thèmes » et « Vrai ou faux ».
// Chaque entrée est rattachée à un thème (même slug qu'en base) : un thème sans
// questions n'apparaît simplement pas sur la page des jeux. Les faits choisis sont
// établis et stables (histoire, science de base), jamais liés à l'actualité récente.

export interface QuizQuestion {
  /** Slug du thème (table themes). */
  theme: string;
  question: string;
  /** Les propositions ; `answer` est l'index de la bonne réponse. */
  choices: string[];
  answer: number;
  /** Une phrase affichée après la réponse, pour apprendre quelque chose. */
  explain: string;
}

export interface TrueFalseStatement {
  theme: string;
  statement: string;
  isTrue: boolean;
  explain: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // Intelligence artificielle
  {
    theme: "ia",
    question: "Quel test, proposé en 1950, consiste à savoir si une machine peut se faire passer pour un humain dans une conversation ?",
    choices: ["Le test de Turing", "Le test de Lovelace", "Le paradoxe de Moravec", "Le test de Shannon"],
    answer: 0,
    explain: "Alan Turing l'a décrit en 1950 sous le nom de « jeu de l'imitation », dans son article Computing Machinery and Intelligence.",
  },
  {
    theme: "ia",
    question: "En 2016, le programme AlphaGo de DeepMind a battu Lee Sedol, champion de quel jeu ?",
    choices: ["Les échecs", "Le go", "Le shogi", "Le poker"],
    answer: 1,
    explain: "AlphaGo a gagné 4 parties sur 5 contre Lee Sedol, un cap que beaucoup pensaient encore lointain pour le jeu de go.",
  },
  {
    theme: "ia",
    question: "Que désigne l'« apprentissage profond » (deep learning) ?",
    choices: [
      "Des programmes écrits règle par règle par des experts",
      "Des réseaux de neurones artificiels à nombreuses couches entraînés sur des données",
      "Une base de données de connaissances rédigée à la main",
      "Un ordinateur quantique dédié à l'IA",
    ],
    answer: 1,
    explain: "Le « profond » renvoie au nombre de couches du réseau de neurones, qui apprend ses paramètres à partir d'exemples.",
  },
  // Robotique
  {
    theme: "robotique",
    question: "D'où vient le mot « robot » ?",
    choices: [
      "D'une pièce de théâtre tchèque de 1920",
      "D'un roman d'Isaac Asimov",
      "Du nom d'un ingénieur japonais",
      "D'un acronyme militaire américain",
    ],
    answer: 0,
    explain: "Karel Čapek l'emploie dans sa pièce R.U.R. (1920) ; « robota » signifie corvée en tchèque. Asimov, lui, a inventé « robotique ».",
  },
  {
    theme: "robotique",
    question: "Unimate, le premier robot industriel, a été installé en 1961 dans une usine de quel secteur ?",
    choices: ["Textile", "Automobile", "Agroalimentaire", "Aéronautique"],
    answer: 1,
    explain: "Il manipulait des pièces de fonderie chez General Motors, dans le New Jersey.",
  },
  {
    theme: "robotique",
    question: "Combien de « lois de la robotique » Isaac Asimov a-t-il formulées à l'origine ?",
    choices: ["Deux", "Trois", "Cinq", "Sept"],
    answer: 1,
    explain: "Trois lois, publiées en 1942 ; il ajoutera plus tard une « loi zéro » qui protège l'humanité dans son ensemble.",
  },
  // Espace
  {
    theme: "espace",
    question: "Qui a été le premier être humain dans l'espace, en 1961 ?",
    choices: ["Neil Armstrong", "Youri Gagarine", "Alan Shepard", "Valentina Terechkova"],
    answer: 1,
    explain: "Youri Gagarine a bouclé une orbite à bord de Vostok 1 le 12 avril 1961. Terechkova sera la première femme, en 1963.",
  },
  {
    theme: "espace",
    question: "Quelle est, en moyenne, la distance Terre–Lune ?",
    choices: ["38 000 km", "384 000 km", "3,8 millions de km", "150 millions de km"],
    answer: 1,
    explain: "Environ 384 400 km. Les 150 millions de km, c'est la distance Terre–Soleil, l'unité astronomique.",
  },
  {
    theme: "espace",
    question: "Quelle planète du Système solaire possède le plus grand volcan connu, Olympus Mons ?",
    choices: ["Vénus", "Mars", "Mercure", "Io (lune de Jupiter)"],
    answer: 1,
    explain: "Olympus Mons, sur Mars, culmine à plus de 21 km : près de deux fois et demie l'Everest.",
  },
  // Sciences
  {
    theme: "sciences",
    question: "Qui a reçu deux prix Nobel dans deux sciences différentes (physique et chimie) ?",
    choices: ["Albert Einstein", "Marie Curie", "Linus Pauling", "Louis Pasteur"],
    answer: 1,
    explain: "Marie Curie : physique en 1903 (radioactivité) et chimie en 1911 (radium et polonium). Pauling a eu chimie et paix.",
  },
  {
    theme: "sciences",
    question: "Quelle est la vitesse de la lumière dans le vide ?",
    choices: ["300 km/s", "3 000 km/s", "300 000 km/s", "3 millions de km/s"],
    answer: 2,
    explain: "299 792 km/s exactement : c'est elle qui définit le mètre depuis 1983.",
  },
  {
    theme: "sciences",
    question: "La structure en double hélice de l'ADN a été décrite en 1953 grâce, notamment, aux clichés de quelle scientifique ?",
    choices: ["Rosalind Franklin", "Barbara McClintock", "Ada Lovelace", "Dorothy Hodgkin"],
    answer: 0,
    explain: "Le cliché 51 de Rosalind Franklin a été décisif pour le modèle de Watson et Crick.",
  },
  // Tech & numérique
  {
    theme: "tech",
    question: "Qui est considérée comme l'autrice du premier programme informatique, au XIXᵉ siècle ?",
    choices: ["Grace Hopper", "Ada Lovelace", "Hedy Lamarr", "Margaret Hamilton"],
    answer: 1,
    explain: "Ada Lovelace a écrit en 1843 un algorithme pour la machine analytique de Charles Babbage.",
  },
  {
    theme: "tech",
    question: "Que décrit la « loi de Moore », énoncée en 1965 ?",
    choices: [
      "Le doublement régulier du nombre de transistors sur une puce",
      "La croissance du nombre d'internautes",
      "La baisse du prix des écrans",
      "La vitesse maximale d'un réseau",
    ],
    answer: 0,
    explain: "Gordon Moore observait un doublement environ tous les deux ans — une tendance, pas une loi physique.",
  },
  {
    theme: "tech",
    question: "Où le World Wide Web a-t-il été inventé par Tim Berners-Lee en 1989 ?",
    choices: ["À la NASA", "Au CERN, à Genève", "Au MIT", "Chez IBM"],
    answer: 1,
    explain: "Au CERN, pour aider les physiciens à partager leurs documents. Le Web n'est pas Internet : il circule dessus.",
  },
  // Santé & médecine
  {
    theme: "sante",
    question: "Quel médicament Alexander Fleming a-t-il découvert en 1928, à partir d'une moisissure ?",
    choices: ["L'aspirine", "La pénicilline", "L'insuline", "La cortisone"],
    answer: 1,
    explain: "Une boîte de culture contaminée par Penicillium a lancé l'ère des antibiotiques.",
  },
  {
    theme: "sante",
    question: "La première vaccination, mise au point par Edward Jenner en 1796, protégeait contre quelle maladie ?",
    choices: ["La rage", "La variole", "La tuberculose", "La polio"],
    answer: 1,
    explain: "Jenner utilisait la vaccine des vaches — d'où le mot « vaccin ». La variole est déclarée éradiquée en 1980.",
  },
  {
    theme: "sante",
    question: "Combien de chromosomes compte une cellule humaine ordinaire ?",
    choices: ["23", "42", "46", "92"],
    answer: 2,
    explain: "46 chromosomes, en 23 paires ; les gamètes n'en portent que 23.",
  },
  // Climat & environnement
  {
    theme: "climat",
    question: "Quel gaz est le principal responsable du réchauffement climatique d'origine humaine ?",
    choices: ["Le méthane", "Le dioxyde de carbone (CO₂)", "L'ozone", "Le protoxyde d'azote"],
    answer: 1,
    explain: "Le CO₂ issu des énergies fossiles domine ; le méthane réchauffe plus fort par molécule mais reste moins abondant.",
  },
  {
    theme: "climat",
    question: "L'accord de Paris sur le climat, adopté en 2015, vise à limiter le réchauffement bien en dessous de…",
    choices: ["1 °C", "2 °C", "3 °C", "4 °C"],
    answer: 1,
    explain: "Bien en dessous de 2 °C par rapport à l'ère préindustrielle, en visant 1,5 °C.",
  },
  {
    theme: "climat",
    question: "Quel écosystème est surnommé le « poumon bleu » de la planète pour l'oxygène qu'il produit ?",
    choices: ["La forêt amazonienne", "L'océan", "La toundra", "Les mangroves"],
    answer: 1,
    explain: "Le phytoplancton des océans produit au moins la moitié de l'oxygène que nous respirons.",
  },
  // Énergie
  {
    theme: "energie",
    question: "Dans une centrale nucléaire actuelle, l'électricité vient de…",
    choices: [
      "La fusion d'atomes d'hydrogène",
      "La fission d'atomes lourds comme l'uranium",
      "La combustion d'uranium",
      "Des panneaux solaires de secours",
    ],
    answer: 1,
    explain: "La fission chauffe de l'eau, la vapeur entraîne une turbine. La fusion, elle, reste au stade expérimental (ITER).",
  },
  {
    theme: "energie",
    question: "Quel chimiste a reçu le prix Nobel 2019 pour la batterie lithium-ion, avec Whittingham et Yoshino ?",
    choices: ["John B. Goodenough", "Elon Musk", "James Watt", "Nikola Tesla"],
    answer: 0,
    explain: "John B. Goodenough, 97 ans alors : le plus âgé des lauréats Nobel.",
  },
  {
    theme: "energie",
    question: "L'hydrogène dit « vert » est produit…",
    choices: [
      "À partir de gaz naturel",
      "Par électrolyse de l'eau avec de l'électricité renouvelable",
      "Dans des puits d'hydrogène naturel",
      "En raffinant du pétrole",
    ],
    answer: 1,
    explain: "L'électrolyse sépare l'eau en hydrogène et oxygène ; « vert » si l'électricité utilisée est bas carbone renouvelable.",
  },
  // Physique & quantique
  {
    theme: "physique",
    question: "Quelle particule, confirmée au CERN en 2012, donne leur masse aux autres particules ?",
    choices: ["Le neutrino", "Le boson de Higgs", "Le quark top", "Le graviton"],
    answer: 1,
    explain: "Prédit dès 1964, le boson de Higgs a valu le prix Nobel 2013 à François Englert et Peter Higgs.",
  },
  {
    theme: "physique",
    question: "Pour quelle découverte Albert Einstein a-t-il reçu le prix Nobel de physique ?",
    choices: ["La relativité générale", "L'effet photoélectrique", "Le mouvement brownien", "E = mc²"],
    answer: 1,
    explain: "Le Nobel 1921 récompense l'effet photoélectrique, pas la relativité — jugée alors trop controversée.",
  },
  {
    theme: "physique",
    question: "Dans un ordinateur quantique, l'unité d'information s'appelle…",
    choices: ["Un bit", "Un qubit", "Un quanton", "Un photon"],
    answer: 1,
    explain: "Le qubit peut être en superposition de 0 et de 1, ce qui ouvre des calculs impossibles aux bits classiques.",
  },
  // Biologie & vivant
  {
    theme: "biologie",
    question: "Quel naturaliste a publié « L'Origine des espèces » en 1859 ?",
    choices: ["Gregor Mendel", "Charles Darwin", "Jean-Baptiste Lamarck", "Alfred Wallace"],
    answer: 1,
    explain: "Darwin y expose la sélection naturelle ; Wallace était arrivé à des idées proches au même moment.",
  },
  {
    theme: "biologie",
    question: "L'outil CRISPR-Cas9, prix Nobel de chimie 2020, sert à…",
    choices: ["Observer les cellules en 3D", "Modifier précisément l'ADN", "Cloner des animaux", "Séquencer un génome"],
    answer: 1,
    explain: "Ces « ciseaux moléculaires » ont été mis au point par Emmanuelle Charpentier et Jennifer Doudna.",
  },
  {
    theme: "biologie",
    question: "Quel animal est connu pour survivre au vide spatial, à la dessiccation et aux radiations ?",
    choices: ["Le rat-taupe nu", "Le tardigrade", "L'axolotl", "La méduse Turritopsis"],
    answer: 1,
    explain: "Le tardigrade, moins d'un millimètre, entre en cryptobiose et résiste à des conditions extrêmes.",
  },
  // Cybersécurité
  {
    theme: "cyber",
    question: "Que fait un « rançongiciel » (ransomware) ?",
    choices: [
      "Il affiche de la publicité",
      "Il chiffre des fichiers et exige un paiement",
      "Il vole des mots de passe en silence",
      "Il ralentit volontairement un réseau",
    ],
    answer: 1,
    explain: "Il rend les données illisibles et réclame une rançon — que les autorités recommandent de ne pas payer.",
  },
  {
    theme: "cyber",
    question: "Le « hameçonnage » (phishing) consiste à…",
    choices: [
      "Saturer un site de requêtes",
      "Se faire passer pour un tiers de confiance pour voler des identifiants",
      "Exploiter une faille logicielle inconnue",
      "Intercepter le Wi-Fi public",
    ],
    answer: 1,
    explain: "Faux e-mails, faux sites, fausses urgences : la meilleure parade reste de vérifier l'adresse et de ne jamais cliquer dans l'urgence.",
  },
  {
    theme: "cyber",
    question: "Quelle machine de chiffrement allemande Alan Turing et Bletchley Park ont-ils contribué à percer ?",
    choices: ["Lorenz", "Enigma", "Purple", "Sigaba"],
    answer: 1,
    explain: "Casser Enigma a raccourci la Seconde Guerre mondiale et posé des bases de l'informatique moderne.",
  },
];

export const TRUE_FALSE_STATEMENTS: TrueFalseStatement[] = [
  { theme: "ia", statement: "Le terme « intelligence artificielle » a été inventé lors de la conférence de Dartmouth, en 1956.", isTrue: true, explain: "John McCarthy l'emploie pour l'atelier fondateur de l'été 1956." },
  { theme: "ia", statement: "Deep Blue, l'ordinateur qui a battu Garry Kasparov aux échecs en 1997, apprenait tout seul par réseaux de neurones.", isTrue: false, explain: "Deep Blue reposait sur la force de calcul et des règles programmées, pas sur l'apprentissage automatique." },
  { theme: "robotique", statement: "Le mot « robotique » a été popularisé par l'écrivain Isaac Asimov.", isTrue: true, explain: "Il l'emploie dès 1941 dans ses nouvelles, avant que le mot n'entre dans la langue courante." },
  { theme: "robotique", statement: "Les rovers martiens sont pilotés en direct depuis la Terre, avec un volant et des pédales.", isTrue: false, explain: "Le signal met de 4 à 24 minutes à atteindre Mars : on envoie des plans de déplacement, le rover les exécute seul." },
  { theme: "espace", statement: "Douze personnes, toutes américaines, ont marché sur la Lune.", isTrue: true, explain: "De 1969 à 1972, lors des missions Apollo 11 à 17 (sauf Apollo 13)." },
  { theme: "espace", statement: "Il y a un côté de la Lune plongé dans une nuit éternelle.", isTrue: false, explain: "La face cachée n'est cachée que pour nous : elle reçoit autant de soleil que l'autre." },
  { theme: "sciences", statement: "Un éclair est environ cinq fois plus chaud que la surface du Soleil.", isTrue: true, explain: "Près de 30 000 °C dans le canal de foudre, contre 5 500 °C à la surface du Soleil." },
  { theme: "sciences", statement: "Nous n'utilisons que 10 % de notre cerveau.", isTrue: false, explain: "C'est un mythe : l'imagerie montre que presque toutes les zones servent, même pendant le sommeil." },
  { theme: "tech", statement: "Le premier « bug » informatique documenté était un vrai insecte, un papillon de nuit coincé dans un relais.", isTrue: true, explain: "En 1947, l'équipe de Grace Hopper l'a scotché dans le journal de bord du Harvard Mark II." },
  { theme: "tech", statement: "Internet et le World Wide Web désignent la même chose.", isTrue: false, explain: "Internet est le réseau ; le Web (1989) n'est qu'un des services qui y circulent, comme l'e-mail." },
  { theme: "sante", statement: "Les antibiotiques sont efficaces contre les virus comme la grippe.", isTrue: false, explain: "Ils n'agissent que sur les bactéries ; les prendre inutilement nourrit l'antibiorésistance." },
  { theme: "sante", statement: "Le cœur humain bat environ 100 000 fois par jour.", isTrue: true, explain: "À 70 battements par minute, cela fait plus de 2,5 milliards de battements en une vie." },
  { theme: "climat", statement: "Le niveau moyen des océans monte, mesures satellites à l'appui.", isTrue: true, explain: "Dilatation de l'eau qui chauffe et fonte des glaces continentales en sont les causes principales." },
  { theme: "climat", statement: "La fonte de la banquise arctique fait directement monter le niveau de la mer.", isTrue: false, explain: "La banquise flotte déjà : c'est la fonte des glaciers et calottes posés sur la terre qui fait monter l'eau." },
  { theme: "energie", statement: "En une heure, la Terre reçoit du Soleil plus d'énergie que l'humanité n'en consomme en un an.", isTrue: true, explain: "Tout l'enjeu est de capter, convertir et stocker cette énergie diffuse." },
  { theme: "energie", statement: "Une éolienne produit de l'électricité même sans vent, grâce à son inertie.", isTrue: false, explain: "Sans vent suffisant, le rotor s'arrête : l'inertie ne produit rien de significatif." },
  { theme: "physique", statement: "Dans la Station spatiale internationale, les astronautes flottent parce que la gravité y est nulle.", isTrue: false, explain: "À 400 km d'altitude, la gravité vaut encore 90 % de celle du sol : ils flottent parce qu'ils sont en chute libre permanente." },
  { theme: "physique", statement: "Le temps passe un peu plus vite au sommet d'une montagne qu'au niveau de la mer.", isTrue: true, explain: "Effet de la relativité générale, mesuré par des horloges atomiques — et corrigé en permanence par le GPS." },
  { theme: "biologie", statement: "Les pieuvres ont trois cœurs et un sang bleu.", isTrue: true, explain: "Deux cœurs pour les branchies, un pour le corps ; l'hémocyanine à base de cuivre colore leur sang en bleu." },
  { theme: "biologie", statement: "L'être humain partage environ 50 % de ses gènes avec le chimpanzé.", isTrue: false, explain: "C'est bien plus : autour de 98-99 % de similarité sur les séquences codantes." },
  { theme: "cyber", statement: "« 123456 » reste l'un des mots de passe les plus utilisés au monde.", isTrue: true, explain: "Les fuites de données le confirment année après année : un gestionnaire de mots de passe vaut mieux." },
  { theme: "cyber", statement: "Le mode de navigation privée rend invisible sur Internet.", isTrue: false, explain: "Il efface l'historique local, mais le fournisseur d'accès et les sites voient toujours la connexion." },
];

/** Les slugs de thèmes qui ont au moins une question, dans l'ordre d'apparition. */
export function themesWithGames(): Set<string> {
  const slugs = new Set<string>();
  for (const q of QUIZ_QUESTIONS) slugs.add(q.theme);
  for (const s of TRUE_FALSE_STATEMENTS) slugs.add(s.theme);
  return slugs;
}
