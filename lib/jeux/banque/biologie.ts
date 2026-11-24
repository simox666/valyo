import { banque } from "./outils.ts";

const b = banque("biologie");
const { m, v } = b;

m("Quel organite est surnommé la « centrale énergétique » de la cellule ?", "La mitochondrie", ["Le ribosome", "Le noyau", "L'appareil de Golgi"], "Elle transforme les nutriments en énergie utilisable par la cellule.");
m("Qui a établi les lois de l'hérédité en croisant des petits pois ?", "Gregor Mendel", ["Charles Darwin", "Louis Pasteur", "Thomas Morgan"], "Ses travaux de 1865 sont restés ignorés jusqu'en 1900.");
m("Combien de bases différentes composent l'ADN ?", "Quatre", ["Deux", "Trois", "Vingt"], "Adénine, thymine, guanine et cytosine. Vingt, c'est le nombre d'acides aminés des protéines.");
m("Quelle base de l'ARN remplace la thymine de l'ADN ?", "L'uracile", ["L'adénine", "La guanine", "La cytosine"], "Les trois autres bases sont communes à l'ADN et à l'ARN.");
m("Quel est l'animal le plus lourd connu, toutes époques confondues ?", "La baleine bleue", ["Le diplodocus", "Le mammouth", "Le requin-baleine"], "Elle peut dépasser 150 tonnes, plus que les plus grands dinosaures connus.");
m("Quel pigment donne leur couleur verte aux plantes ?", "La chlorophylle", ["La mélanine", "Le carotène", "L'hémoglobine"], "Elle capte la lumière nécessaire à la photosynthèse.");
m("Qu'a instauré Carl von Linné au XVIIIᵉ siècle ?", "Le nom latin en deux mots des espèces", ["La théorie de l'évolution des espèces", "Le premier microscope à lentilles", "La théorie cellulaire du vivant"], "Homo sapiens, Canis lupus : le genre, puis l'espèce.");
m("Lequel de ces organismes a des cellules sans noyau ?", "Une bactérie", ["Une levure", "Une amibe", "Une algue verte"], "Son ADN flotte librement dans la cellule.");
m("Quel organite fabrique les protéines ?", "Le ribosome", ["Le lysosome", "La vacuole", "Le centriole"], "Il lit l'ARN messager et assemble les acides aminés un par un.");
m("À quel groupe les champignons appartiennent-ils ?", "À un règne à part", ["Aux plantes", "Aux animaux", "Aux bactéries"], "Ils sont même plus proches des animaux que des plantes.");
m("Qui a observé le premier des micro-organismes au microscope, au XVIIᵉ siècle ?", "Antoni van Leeuwenhoek", ["Robert Hooke", "Louis Pasteur", "Carl von Linné"], "Ce drapier hollandais polissait lui-même ses lentilles. Hooke, lui, a donné son nom à la « cellule ».");
m("En quoi la brebis Dolly, née en 1996, était-elle une première ?", "Un mammifère cloné à partir d'une cellule adulte", ["Un mammifère né par fécondation in vitro", "Un mammifère dont le génome a été entièrement séquencé", "Un mammifère porteur d'un gène humain"], "Elle a été obtenue à partir d'une cellule de glande mammaire.");
m("Quel mammifère pond des œufs ?", "L'ornithorynque", ["Le pangolin", "Le tatou", "La chauve-souris"], "Avec les échidnés, il forme le petit groupe des monotrèmes.");
m("Quel naturaliste est arrivé à l'idée de sélection naturelle en même temps que Darwin ?", "Alfred Russel Wallace", ["Jean-Baptiste Lamarck", "Thomas Huxley", "Georges Cuvier"], "Leurs travaux ont été présentés ensemble à Londres en 1858.");
m("Comment les abeilles indiquent-elles à leurs congénères où trouver des fleurs ?", "Par une danse", ["Par un chant", "Par un changement de couleur", "Par un battement d'antennes"], "L'angle et la durée de la danse donnent la direction et la distance. Karl von Frisch l'a décrypté.");
m("Qu'est-ce qu'une enzyme ?", "Une protéine qui accélère une réaction", ["Une hormone qui régule le sommeil et l'appétit", "Un sucre qui stocke de l'énergie", "Un gène qui code un anticorps"], "Sans enzymes, la digestion prendrait des années.");
m("Combien de pattes une araignée a-t-elle ?", "Huit", ["Six", "Dix", "Douze"], "Six, ce sont les insectes ; les araignées sont des arachnides.");
m("Qu'est-ce que le cœlacanthe, pêché vivant en 1938 ?", "Un poisson que l'on croyait éteint", ["Un oiseau des îles incapable de voler", "Un reptile marin géant", "Un insecte des cavernes"], "On ne le connaissait que par des fossiles vieux de plus de 65 millions d'années.");
m("Où se déroule la photosynthèse dans une cellule végétale ?", "Dans les chloroplastes", ["Dans les mitochondries", "Dans le noyau", "Dans la vacuole"], "Ce sont eux qui contiennent la chlorophylle.");
m("Quand notre espèce, Homo sapiens, est-elle apparue en Afrique ?", "Il y a environ 300 000 ans", ["Il y a environ 30 000 ans", "Il y a environ 3 millions d'années", "Il y a environ 30 millions d'années"], "Les plus anciens fossiles connus viennent du Maroc. 3 millions d'années, c'est l'époque de Lucy.");
m("Quel est l'animal terrestre le plus rapide ?", "Le guépard", ["Le lion", "Le lévrier", "L'autruche"], "Il dépasse les 100 km/h sur de courtes distances.");
m("Combien de gènes codant des protéines le génome humain contient-il ?", "Environ 20 000", ["Environ 2 000", "Environ 200 000", "Environ 2 millions"], "Bien moins qu'on ne l'imaginait avant le séquençage, et à peine plus qu'un petit ver.");

v("Les oiseaux sont des descendants de dinosaures.", true, "Ils sont issus d'un groupe de dinosaures à plumes, les théropodes.");
v("L'être humain descend du chimpanzé.", false, "Les deux espèces partagent un ancêtre commun, qui vivait il y a environ 7 millions d'années.");
v("Les bananes du commerce sont presque toutes des clones.", true, "La variété Cavendish se multiplie par rejets, sans graines, ce qui la rend vulnérable aux maladies.");
v("Les plantes respirent, de jour comme de nuit.", true, "Elles consomment de l'oxygène en permanence, en plus de la photosynthèse le jour.");
v("Un virus est une très petite cellule.", false, "Il n'a ni cellule ni métabolisme : il doit détourner une cellule pour se multiplier.");
v("Un ver de terre coupé en deux donne deux vers.", false, "Au mieux, la partie avant survit et cicatrise.");
v("Les requins existaient avant les arbres.", true, "Ils apparaissent il y a plus de 400 millions d'années, les premiers arbres un peu plus tard.");
v("Le poisson rouge a une mémoire de trois secondes.", false, "Il retient des apprentissages pendant des mois.");
v("L'ADN de deux êtres humains est identique à plus de 99 %.", true, "Environ 99,9 % ; les différences tiennent dans le millième restant.");
v("Les chameaux stockent de l'eau dans leurs bosses.", false, "Elles contiennent de la graisse, une réserve d'énergie.");

export default b;
