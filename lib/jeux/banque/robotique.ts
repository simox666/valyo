import { banque } from "./outils.ts";

const b = banque("robotique");
const { m, v } = b;

m("Quel robot humanoïde Honda a-t-il présenté en 2000 ?", "ASIMO", ["Atlas", "Pepper", "NAO"], "ASIMO marchait, montait des escaliers et courait ; Honda a arrêté son développement en 2018.");
m("Quelle entreprise a conçu Spot, le robot quadrupède jaune ?", "Boston Dynamics", ["iRobot", "Tesla", "Sony"], "Spot inspecte des usines, des chantiers et des sites dangereux.");
m("Comment s'appelle le robot chirurgical le plus répandu dans les hôpitaux ?", "Da Vinci", ["Michel-Ange", "Galilée", "Pasteur"], "Le chirurgien le pilote depuis une console ; le robot ne décide de rien seul.");
m("Quel a été le premier rover à rouler sur Mars, en 1997 ?", "Sojourner", ["Spirit", "Curiosity", "Viking"], "Sojourner pesait à peine plus de 10 kg. Les sondes Viking, elles, étaient des atterrisseurs fixes.");
m("Qui a envoyé Lunokhod 1, premier rover télécommandé sur un autre astre, en 1970 ?", "L'Union soviétique", ["Les États-Unis", "La France", "Le Japon"], "Il a parcouru plus de 10 km sur la Lune en dix mois.");
m("Que mesure un lidar ?", "Des distances, par impulsions laser", ["Des températures, par infrarouge", "Des vitesses, par ondes radio", "Des pressions, par ultrasons"], "En chronométrant le retour de la lumière, il dresse une carte 3D de son environnement.");
m("Que désignent les « degrés de liberté » d'un bras robotique ?", "Le nombre de mouvements indépendants possibles", ["L'angle maximal de chaque articulation", "La charge maximale qu'il peut soulever à bout de bras", "Le nombre de capteurs qu'il embarque"], "Il en faut six pour placer un outil à n'importe quelle position et orientation.");
m("Qu'est-ce qu'un « cobot » ?", "Un robot conçu pour travailler près des humains", ["Un robot en forme de serpent pour inspecter les tuyaux", "Un robot piloté par un autre robot", "Un robot réservé aux fonds marins"], "Contraction de « robot collaboratif » : il s'arrête dès qu'il détecte un contact.");
m("Quelle entreprise fabrique le robot aspirateur Roomba ?", "iRobot", ["Dyson", "Boston Dynamics", "Honda"], "iRobot a été fondée par des chercheurs du MIT ; le Roomba est sorti en 2002.");
m("Que décrit la « vallée de l'étrange », formulée par Masahiro Mori en 1970 ?", "Le malaise devant un robot presque humain", ["La zone où un robot perd son signal", "La difficulté de marcher sur un sol mou", "Le creux des ventes après un lancement"], "Plus un robot nous ressemble sans être parfait, plus ses petits défauts dérangent.");
m("Ingenuity, qui a réalisé en 2021 le premier vol motorisé sur une autre planète, était…", "Un petit hélicoptère", ["Un ballon dirigeable", "Un planeur", "Une fusée miniature"], "Prévu pour 5 vols sur Mars, il en a réalisé 72.");
m("Qu'est-ce que le Canadarm ?", "Un bras robotique de la navette spatiale", ["Un rover lunaire conçu par l'agence spatiale canadienne", "Un robot de déneigement", "Un sous-marin autonome"], "Il a servi à déployer des satellites et à assembler la Station spatiale internationale.");
m("Quel pays compte le plus de robots industriels par salarié de l'industrie ?", "La Corée du Sud", ["Les États-Unis", "La France", "Le Brésil"], "Elle dépasse les 1 000 robots pour 10 000 salariés, portée par l'électronique et l'automobile.");
m("Dans un robot, qu'est-ce qu'un actionneur ?", "L'élément qui produit le mouvement", ["L'élément qui mesure l'environnement", "Le programme qui planifie le trajet", "La batterie qui alimente le robot"], "Moteurs électriques, vérins hydrauliques ou pneumatiques : ce sont les « muscles » du robot.");
m("Le robot Shakey, conçu à la fin des années 1960, a été le premier à…", "Planifier lui-même ses déplacements", ["Voler de manière autonome en intérieur", "Souder des carrosseries", "Jouer aux échecs"], "Il analysait une consigne, la découpait en étapes et contournait les obstacles.");
m("Atlas, de Boston Dynamics, est un robot…", "Humanoïde", ["Quadrupède", "Volant", "Sous-marin"], "Il est connu pour ses saltos et ses parcours d'obstacles.");
m("Quel pays a accordé symboliquement sa citoyenneté au robot Sophia en 2017 ?", "L'Arabie saoudite", ["Le Japon", "Les États-Unis", "La Corée du Sud"], "Un coup de communication : Sophia récite surtout des réponses préparées.");
m("Qui a construit le « Canard digérateur », célèbre automate de 1739 ?", "Jacques de Vaucanson", ["Blaise Pascal", "Léonard de Vinci", "Denis Papin"], "Le canard semblait manger et digérer ; la digestion était en réalité truquée.");
m("Quel objectif la compétition RoboCup s'est-elle fixé pour 2050 ?", "Battre les champions du monde de football", ["Gravir l'Everest sans assistance", "Traverser l'Atlantique à la nage sans escorte", "Gagner les 24 Heures du Mans"], "Une équipe de robots humanoïdes autonomes devrait l'emporter face aux vainqueurs de la Coupe du monde.");
m("À quoi sert la cinématique inverse ?", "Calculer les angles pour atteindre un point", ["Mesurer l'usure des moteurs du robot", "Faire reculer le robot en sécurité", "Inverser le sens de rotation des roues motrices"], "On donne la position voulue de la main ; le calcul en déduit l'angle de chaque articulation.");
m("En quelle année le rover Perseverance s'est-il posé sur Mars ?", "2021", ["2012", "2004", "1997"], "2012, c'est Curiosity ; 2004, Spirit et Opportunity ; 1997, Sojourner.");
m("Sur quel type d'astre le robot Philae s'est-il posé en 2014 ?", "Une comète", ["Une lune de Jupiter", "Un astéroïde", "Une planète naine"], "Largué par la sonde européenne Rosetta, il a rebondi avant de s'immobiliser sur la comète « Tchouri ».");

v("Le rover Opportunity, prévu pour 90 jours, a fonctionné plus de 14 ans sur Mars.", true, "Arrivé en 2004, il n'a cessé d'émettre qu'en 2018, après une tempête de poussière.");
v("La plupart des robots industriels ont une forme humaine.", false, "Ce sont surtout des bras articulés fixés au sol.");
v("Un signal radio met plusieurs minutes pour aller de la Terre à Mars.", true, "Entre 3 et 22 minutes selon la position des planètes.");
v("Léonard de Vinci a dessiné un chevalier mécanique vers 1495.", true, "Ses carnets décrivent une armure animée par des câbles et des poulies.");
v("Un drone de loisir se stabilise grâce à des gyroscopes et des accéléromètres.", true, "Ces capteurs mesurent ses mouvements des centaines de fois par seconde.");
v("Les sondes Voyager sont pilotées par des astronautes à bord.", false, "Elles sont entièrement automatiques, et lancées depuis 1977.");
v("Des robots ont été envoyés dans la centrale de Fukushima là où les humains ne pouvaient pas aller.", true, "Ils ont exploré les réacteurs accidentés ; beaucoup ont été détruits par les radiations.");
v("Un robot aspirateur a besoin d'Internet pour nettoyer.", false, "Il se repère avec ses propres capteurs ; la connexion sert à l'application.");
v("Le mot « androïde » désigne un robot à l'apparence humaine.", true, "Du grec « andros », l'homme.");
v("Les premiers robots soudeurs sont arrivés dans l'industrie automobile après l'an 2000.", false, "Dès les années 1960 : Unimate travaillait chez General Motors en 1961.");

export default b;
