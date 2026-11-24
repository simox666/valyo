import { banque } from "./outils.ts";

const b = banque("espace");
const { m, v } = b;

m("Quelle est la plus grande planète du Système solaire ?", "Jupiter", ["Saturne", "Neptune", "Uranus"], "Jupiter pourrait contenir plus de 1 300 fois la Terre.");
m("Quelle est l'étoile la plus proche du Soleil ?", "Proxima du Centaure", ["Sirius", "Bételgeuse", "Véga"], "Elle se trouve à environ 4,2 années-lumière.");
m("Combien de temps la lumière du Soleil met-elle pour atteindre la Terre ?", "Environ 8 minutes", ["Environ 8 secondes", "Environ 1 heure", "Environ 1 jour"], "Nous voyons donc le Soleil tel qu'il était 8 minutes plus tôt.");
m("Qui a été la première femme dans l'espace, en 1963 ?", "Valentina Terechkova", ["Sally Ride", "Claudie Haigneré", "Svetlana Savitskaïa"], "Elle a passé près de trois jours en orbite à bord de Vostok 6.");
m("Quelle est la planète la plus chaude du Système solaire ?", "Vénus", ["Mercure", "Mars", "Jupiter"], "Son épaisse atmosphère de CO₂ maintient la surface vers 460 °C, plus chaud que Mercure pourtant plus proche du Soleil.");
m("Quelle sonde a été la première à quitter l'héliosphère, en 2012 ?", "Voyager 1", ["Pioneer 10", "New Horizons", "Cassini"], "Lancée en 1977, c'est l'objet humain le plus éloigné de la Terre.");
m("Titan est la plus grande lune de quelle planète ?", "Saturne", ["Jupiter", "Neptune", "Uranus"], "Titan possède une atmosphère épaisse et des lacs de méthane liquide.");
m("Qu'est-ce qu'une année-lumière ?", "Une distance", ["Une durée", "Une vitesse", "Une luminosité"], "C'est la distance parcourue par la lumière en un an : environ 9 500 milliards de km.");
m("Comment s'appelle notre galaxie ?", "La Voie lactée", ["Andromède", "Le Grand Nuage de Magellan", "La galaxie du Triangle"], "Elle compte entre 100 et 400 milliards d'étoiles.");
m("Quel est l'âge de l'Univers ?", "Environ 13,8 milliards d'années", ["Environ 4,6 milliards d'années", "Environ 100 milliards d'années", "Environ 650 millions d'années"], "4,6 milliards d'années, c'est l'âge du Système solaire.");
m("En quelle année Pluton a-t-elle été reclassée en planète naine ?", "2006", ["1996", "2015", "1986"], "L'Union astronomique internationale a alors défini ce qu'est une planète.");
m("Qui a été le premier homme à marcher sur la Lune ?", "Neil Armstrong", ["Buzz Aldrin", "Michael Collins", "John Glenn"], "Le 21 juillet 1969. Aldrin l'a rejoint ; Collins est resté en orbite.");
m("Quelle fusée a emmené les astronautes du programme Apollo vers la Lune ?", "Saturn V", ["Ariane 5", "Soyouz", "Atlas"], "Haute de 110 mètres, elle n'a jamais connu d'échec en vol habité.");
m("D'où décollent les fusées Ariane ?", "De Kourou, en Guyane", ["De Toulouse, en France", "De Cap Canaveral, en Floride", "De Baïkonour, au Kazakhstan"], "Près de l'équateur, la rotation de la Terre donne un élan supplémentaire aux lanceurs.");
m("Quel astre la sonde New Horizons a-t-elle survolé en 2015 ?", "Pluton", ["Neptune", "Cérès", "Titan"], "Elle en a révélé les montagnes de glace et la grande plaine en forme de cœur.");
m("Dans quelle galaxie se trouve le trou noir dont la première image a été publiée en 2019 ?", "M87", ["Andromède", "La Voie lactée", "Le Sombrero"], "Celui du centre de la Voie lactée, Sagittarius A*, a été imagé en 2022.");
m("Combien de planètes compte le Système solaire ?", "Huit", ["Sept", "Neuf", "Dix"], "De Mercure à Neptune, depuis le reclassement de Pluton.");
m("À quelle altitude la Station spatiale internationale orbite-t-elle ?", "Environ 400 km", ["Environ 40 km", "Environ 4 000 km", "Environ 36 000 km"], "36 000 km, c'est l'orbite géostationnaire des satellites de télévision.");
m("Qu'est-ce qu'une exoplanète ?", "Une planète en orbite autour d'une autre étoile", ["Une planète éjectée de son orbite d'origine par un choc", "Une lune plus grosse que sa planète", "Une planète sans atmosphère ni surface"], "On en connaît plusieurs milliers.");
m("Pour quelle découverte Michel Mayor et Didier Queloz ont-ils reçu le prix Nobel 2019 ?", "La première exoplanète autour d'une étoile de type solaire", ["La première photographie directe d'un trou noir", "La première détection directe des ondes gravitationnelles sur Terre", "La première mesure de l'expansion de l'Univers"], "51 Pegasi b, repérée en 1995 à l'observatoire de Haute-Provence.");
m("À bord de quel engin la chienne Laïka a-t-elle été envoyée en orbite en 1957 ?", "Spoutnik 2", ["Spoutnik 1", "Vostok 1", "Luna 2"], "Elle a été le premier être vivant en orbite, un mois après Spoutnik 1.");
m("De quel gaz le Soleil est-il principalement composé ?", "L'hydrogène", ["L'hélium", "L'oxygène", "Le carbone"], "Environ trois quarts d'hydrogène, qu'il fusionne en hélium.");

v("Vénus tourne sur elle-même dans le sens inverse de la plupart des planètes.", true, "Le Soleil s'y lève à l'ouest.");
v("Les saisons s'expliquent par la distance entre la Terre et le Soleil.", false, "Elles viennent de l'inclinaison de l'axe de la Terre. Début janvier, la Terre est même au plus près du Soleil.");
v("La Grande Muraille de Chine se voit à l'œil nu depuis la Lune.", false, "Elle est bien trop étroite ; même depuis l'orbite basse, elle est très difficile à distinguer.");
v("Sur Vénus, un jour dure plus longtemps qu'une année.", true, "Elle met 243 jours terrestres à tourner sur elle-même, et 225 à faire le tour du Soleil.");
v("Saturne est la seule planète à posséder des anneaux.", false, "Jupiter, Uranus et Neptune en ont aussi, bien plus discrets.");
v("Le Soleil représente plus de 99 % de la masse du Système solaire.", true, "Environ 99,8 % ; Jupiter prend l'essentiel du reste.");
v("Dans le vide spatial, le son ne se propage pas.", true, "Le son a besoin d'un milieu matériel pour voyager.");
v("Une étoile filante est une étoile qui tombe.", false, "C'est une poussière qui brûle en entrant dans l'atmosphère.");
v("Le télescope James Webb observe surtout en infrarouge.", true, "Cela lui permet de voir à travers les nuages de poussière et d'observer des galaxies très lointaines.");
v("Mars doit sa couleur rouge à l'oxyde de fer.", true, "Autrement dit, à de la rouille présente dans son sol.");

export default b;
