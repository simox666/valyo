import { banque } from "./outils.ts";

const b = banque("physique");
const { m, v } = b;

m("Qui a découvert l'électron en 1897 ?", "J. J. Thomson", ["Ernest Rutherford", "Niels Bohr", "Max Planck"], "Il a montré que les rayons cathodiques étaient faits de particules bien plus légères que l'atome.");
m("Qui a mis en évidence le noyau atomique en 1911 ?", "Ernest Rutherford", ["J. J. Thomson", "James Chadwick", "Enrico Fermi"], "En bombardant une feuille d'or, il a vu quelques particules rebondir : l'atome a un cœur dense.");
m("Quelle particule du noyau n'a pas de charge électrique ?", "Le neutron", ["Le proton", "L'électron", "Le positon"], "Il a été découvert par James Chadwick en 1932.");
m("Comment s'appelle la particule de lumière ?", "Le photon", ["Le gluon", "Le neutrino", "Le muon"], "Il n'a pas de masse et va toujours à la vitesse de la lumière.");
m("Combien d'interactions fondamentales la physique connaît-elle ?", "Quatre", ["Deux", "Trois", "Sept"], "La gravitation, l'électromagnétisme, l'interaction forte et l'interaction faible.");
m("Qu'illustre l'expérience de pensée du chat de Schrödinger ?", "La superposition quantique", ["La relativité du temps", "La conservation de l'énergie", "La désintégration du proton"], "Schrödinger voulait montrer à quel point il est étrange d'appliquer la superposition à un objet du quotidien.");
m("Qui a énoncé le principe d'incertitude en 1927 ?", "Werner Heisenberg", ["Paul Dirac", "Erwin Schrödinger", "Louis de Broglie"], "On ne peut pas connaître à la fois, avec une précision parfaite, la position et la vitesse d'une particule.");
m("Quelle est l'unité de la résistance électrique ?", "L'ohm", ["Le volt", "Le farad", "Le tesla"], "Le volt mesure la tension, le farad la capacité et le tesla le champ magnétique.");
m("Quelle est l'accélération de la pesanteur à la surface de la Terre ?", "Environ 9,8 m/s²", ["Environ 1,6 m/s²", "Environ 3,7 m/s²", "Environ 24,8 m/s²"], "1,6 sur la Lune, 3,7 sur Mars et 24,8 sur Jupiter.");
m("Qu'est-ce que l'effet Doppler ?", "Le décalage de fréquence d'une source en mouvement", ["La déviation de la lumière par un prisme en verre", "Le freinage progressif d'un objet par l'air", "L'écho d'un son renvoyé par une paroi"], "C'est pourquoi la sirène d'une ambulance paraît plus aiguë quand elle approche, plus grave quand elle s'éloigne.");
m("Qui a établi que les planètes décrivent des ellipses autour du Soleil ?", "Johannes Kepler", ["Galilée", "Tycho Brahe", "Nicolas Copernic"], "Il s'est appuyé sur les mesures très précises de Tycho Brahe.");
m("Quelle grandeur ne peut qu'augmenter dans un système isolé, selon le deuxième principe de la thermodynamique ?", "L'entropie", ["L'énergie", "La pression", "La température"], "Elle mesure le désordre : la chaleur va spontanément du chaud vers le froid, jamais l'inverse.");
m("Qu'est-ce qu'un supraconducteur ?", "Un matériau sans aucune résistance électrique", ["Un métal qui conduit mieux que le cuivre", "Un isolant devenu conducteur à chaud", "Un câble refroidi en continu par une circulation d'eau"], "Cet état apparaît en dessous d'une température critique, souvent très basse.");
m("Quel instrument a détecté pour la première fois des ondes gravitationnelles, en 2015 ?", "LIGO", ["Le LHC", "Hubble", "Planck"], "Deux détecteurs américains ont capté la fusion de deux trous noirs survenue il y a plus d'un milliard d'années.");
m("Combien de quarks composent un proton ?", "Trois", ["Deux", "Quatre", "Six"], "Deux quarks « up » et un quark « down ».");
m("Qui a unifié l'électricité et le magnétisme dans un jeu d'équations, dans les années 1860 ?", "James Clerk Maxwell", ["Michael Faraday", "Heinrich Hertz", "André-Marie Ampère"], "Ses équations prédisaient les ondes électromagnétiques, que Hertz produira en 1887.");
m("Qu'est-ce que le LHC ?", "Un accélérateur de particules près de Genève", ["Un télescope spatial européen", "Un réacteur à fusion en Provence", "Un détecteur de neutrinos enfoui sous la glace polaire"], "Un anneau de 27 km du CERN, où des protons se percutent presque à la vitesse de la lumière.");
m("Qui a proposé en 1924 que la matière se comporte aussi comme une onde ?", "Louis de Broglie", ["Niels Bohr", "Max Born", "Wolfgang Pauli"], "L'idée, issue de sa thèse, lui a valu le prix Nobel en 1929.");
m("Quelle couleur de la lumière visible a la plus courte longueur d'onde ?", "Le violet", ["Le rouge", "Le vert", "Le jaune"], "Au-delà du violet commence l'ultraviolet.");
m("Dans le vide, on lâche en même temps une plume et un marteau. Que se passe-t-il ?", "Ils arrivent au sol en même temps", ["Le marteau arrive nettement avant", "La plume arrive un peu avant", "Aucun des deux ne tombe"], "L'astronaute David Scott l'a montré sur la Lune en 1971.");
m("À quelle idée la constante de Planck est-elle associée ?", "La quantification de l'énergie", ["La loi de la gravitation universelle", "La vitesse du son", "La dilatation des gaz"], "En 1900, Planck suppose que l'énergie s'échange par paquets, les « quanta ».");
m("Quel savant de l'Antiquité a décrit la poussée subie par un corps plongé dans un liquide ?", "Archimède", ["Pythagore", "Thalès", "Euclide"], "Un corps immergé reçoit une poussée égale au poids du liquide déplacé.");

v("Aucun objet ne peut dépasser la vitesse de la lumière dans le vide.", true, "C'est une limite fondamentale de la relativité.");
v("Dans le vide, un objet lourd tombe plus vite qu'un objet léger.", false, "Sans air, tous les corps tombent à la même vitesse.");
v("La lumière blanche est un mélange de toutes les couleurs.", true, "Un prisme ou des gouttes de pluie la décomposent en arc-en-ciel.");
v("Les électrons tournent autour du noyau comme des planètes sur des orbites précises.", false, "Cette image est dépassée : on décrit l'électron par un nuage de probabilité de présence.");
v("La glace flotte parce qu'elle est moins dense que l'eau liquide.", true, "Une exception rare : la plupart des substances sont plus denses à l'état solide.");
v("Le zéro absolu a déjà été atteint en laboratoire.", false, "On s'en approche à quelques milliardièmes de degré, sans pouvoir l'atteindre.");
v("Un aimant attire tous les métaux.", false, "Il attire surtout le fer, le nickel et le cobalt ; pas l'aluminium ni le cuivre.");
v("Les neutrinos traversent la Terre presque sans rien toucher.", true, "Des milliards nous traversent chaque seconde.");
v("Sans correction relativiste, un GPS perdrait vite sa précision.", true, "Les horloges des satellites avancent de quelques dizaines de microsecondes par jour par rapport à celles du sol.");
v("Le son va plus vite dans l'eau que dans l'air.", true, "Environ 1 500 m/s contre 340 m/s.");

export default b;
