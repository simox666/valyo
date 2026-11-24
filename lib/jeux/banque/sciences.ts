import { banque } from "./outils.ts";

const b = banque("sciences");
const { m, v } = b;

m("Quel est le symbole chimique de l'or ?", "Au", ["Or", "Ag", "Go"], "Du latin « aurum ». Ag, c'est l'argent.");
m("Quel est l'élément le plus abondant de l'Univers ?", "L'hydrogène", ["L'oxygène", "Le carbone", "Le fer"], "Il représente environ les trois quarts de la matière ordinaire.");
m("Quel est le pH d'une solution neutre, comme l'eau pure à 25 °C ?", "7", ["0", "1", "14"], "En dessous de 7 la solution est acide, au-dessus elle est basique.");
m("Qui a formulé la loi de la gravitation universelle ?", "Isaac Newton", ["Galilée", "Johannes Kepler", "Albert Einstein"], "Publiée en 1687 dans les Principia ; Einstein la généralisera en 1915.");
m("Quelle est la valeur approchée du nombre π ?", "3,14", ["2,72", "1,62", "1,41"], "2,72 est le nombre e, 1,62 le nombre d'or et 1,41 la racine carrée de 2.");
m("Quel gaz est le plus abondant dans l'air que nous respirons ?", "L'azote", ["L'oxygène", "Le dioxyde de carbone", "L'argon"], "Environ 78 % d'azote pour 21 % d'oxygène.");
m("De quel élément le diamant est-il constitué ?", "Le carbone", ["Le silicium", "Le calcium", "Le bore"], "Comme le graphite des crayons : seul l'arrangement des atomes change.");
m("Quelle échelle a longtemps servi à exprimer la magnitude des séismes ?", "L'échelle de Richter", ["L'échelle de Beaufort", "L'échelle de Kelvin", "L'échelle de Mohs"], "Beaufort mesure le vent, Mohs la dureté des minéraux.");
m("Que classe l'échelle de Mohs ?", "La dureté des minéraux", ["La force du vent", "L'acidité des sols", "L'éclat des étoiles"], "Elle va de 1 pour le talc à 10 pour le diamant.");
m("Combien d'éléments le tableau périodique compte-t-il aujourd'hui ?", "118", ["92", "103", "150"], "92 est le numéro de l'uranium, le plus lourd des éléments abondants dans la nature.");
m("Qui a publié en 1543 un modèle plaçant le Soleil au centre ?", "Nicolas Copernic", ["Ptolémée", "Tycho Brahe", "Aristote"], "Son livre est paru l'année de sa mort.");
m("Quelle est l'unité de force du Système international ?", "Le newton", ["Le joule", "Le watt", "Le pascal"], "Le joule mesure l'énergie, le watt la puissance et le pascal la pression.");
m("À quelle température correspond le zéro absolu ?", "−273,15 °C", ["−100 °C", "−459,67 °C", "−1 000 °C"], "C'est 0 kelvin. −459,67, c'est la même température exprimée en degrés Fahrenheit.");
m("Comment s'appelle le supercontinent qui réunissait presque toutes les terres il y a environ 300 millions d'années ?", "La Pangée", ["Le Gondwana", "La Laurasie", "L'Eurasie"], "La Pangée s'est ensuite scindée en deux blocs, la Laurasie au nord et le Gondwana au sud.");
m("Que produit la photosynthèse ?", "De l'oxygène et des sucres", ["Du CO₂ et de l'eau", "De l'azote et des sels", "Du méthane et de la chaleur"], "La plante utilise la lumière, l'eau et le CO₂.");
m("Lequel de ces nombres est premier ?", "97", ["91", "87", "93"], "91 = 7 × 13, 87 = 3 × 29 et 93 = 3 × 31.");
m("Pour quoi Dmitri Mendeleïev est-il célèbre ?", "Le tableau périodique des éléments", ["La découverte de l'oxygène", "La théorie des germes", "L'invention de la première pile électrique"], "En 1869, il a même laissé des cases vides pour des éléments encore inconnus.");
m("Qui a découvert la radioactivité naturelle en 1896 ?", "Henri Becquerel", ["Marie Curie", "Ernest Rutherford", "Wilhelm Röntgen"], "Marie Curie lui a donné son nom et a partagé le Nobel 1903 avec lui et Pierre Curie.");
m("Il y a combien de temps les dinosaures non aviens ont-ils disparu ?", "Environ 66 millions d'années", ["Environ 6 millions d'années", "Environ 660 millions d'années", "Environ 10 000 ans"], "Après la chute d'un astéroïde au Yucatán. Les oiseaux, eux, sont leurs descendants.");
m("Quel est l'âge de la Terre ?", "Environ 4,5 milliards d'années", ["Environ 13,8 milliards d'années", "Environ 450 millions d'années", "Environ 45 millions d'années"], "On le sait grâce à la datation de météorites et des plus vieilles roches.");
m("Dans lequel de ces milieux le son se propage-t-il le plus vite ?", "L'acier", ["L'eau", "L'air", "Le vide"], "Environ 5 000 m/s dans l'acier, contre 340 m/s dans l'air. Dans le vide, il ne se propage pas.");
m("Quel métal est liquide à température ambiante ?", "Le mercure", ["Le plomb", "L'étain", "Le zinc"], "Il fond à −39 °C, ce qui lui a valu sa place dans les anciens thermomètres.");

v("L'eau bout à une température plus basse en altitude.", true, "La pression de l'air y est plus faible : vers 85 °C au sommet du mont Blanc.");
v("Le verre est un liquide qui coule très lentement.", false, "C'est un solide amorphe. Les vieux vitraux plus épais en bas le sont à cause de leur fabrication.");
v("La foudre ne tombe jamais deux fois au même endroit.", false, "Elle frappe volontiers les points hauts : l'Empire State Building est touché une vingtaine de fois par an.");
v("Un atome est constitué en grande partie de vide.", true, "Le noyau est environ 100 000 fois plus petit que l'atome.");
v("Un diamant peut brûler.", true, "C'est du carbone pur : chauffé fortement en présence d'oxygène, il se transforme en CO₂.");
v("Zéro est un nombre pair.", true, "Il est divisible par 2 : 0 = 2 × 0.");
v("Il y a plus d'arbres sur Terre que d'étoiles dans la Voie lactée.", true, "Environ 3 000 milliards d'arbres, contre 100 à 400 milliards d'étoiles.");
v("La langue possède des zones séparées pour le sucré, le salé, l'amer et l'acide.", false, "Toutes les saveurs sont perçues sur l'ensemble de la langue ; la « carte » vient d'une erreur de traduction.");
v("L'or pur rouille au contact de l'air humide.", false, "L'or ne s'oxyde pas, d'où son usage en bijouterie et en électronique.");
v("Les chauves-souris sont aveugles.", false, "Elles voient ; beaucoup s'aident en plus de l'écholocation.");

export default b;
