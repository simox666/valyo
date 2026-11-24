import { banque } from "./outils.ts";

const b = banque("tech");
const { m, v } = b;

m("Que désigne le sigle CPU ?", "L'unité centrale de traitement", ["La carte de puissance unifiée", "Le circuit de protection universel", "Le compteur de processus utilisateur"], "Central Processing Unit : le processeur, qui exécute les instructions des programmes.");
m("Qui a créé le noyau Linux en 1991 ?", "Linus Torvalds", ["Richard Stallman", "Bill Gates", "Dennis Ritchie"], "Il était alors étudiant à Helsinki. Stallman avait lancé le projet GNU, que Linux a complété.");
m("Combien de bits y a-t-il dans un octet ?", "8", ["4", "10", "16"], "Un octet peut donc prendre 256 valeurs différentes.");
m("Que signifie le « S » de HTTPS ?", "Secure (sécurisé)", ["Server (serveur)", "Speed (rapide)", "Shared (partagé)"], "Les échanges entre le navigateur et le site sont chiffrés.");
m("Qui a fondé Google en 1998 ?", "Larry Page et Sergey Brin", ["Bill Gates et Paul Allen", "Steve Jobs et Steve Wozniak", "Jerry Yang et David Filo"], "Deux doctorants de Stanford. Yang et Filo, eux, ont fondé Yahoo!.");
m("Quel langage de programmation Guido van Rossum a-t-il créé ?", "Python", ["Java", "Ruby", "PHP"], "Sorti en 1991, il doit son nom aux Monty Python.");
m("Que signifie « open source » pour un logiciel ?", "Son code source est publié et réutilisable", ["Il est gratuit pour tous ses utilisateurs", "Il fonctionne sans connexion Internet", "Il n'appartient à aucune entreprise"], "Chacun peut lire le code, le modifier et le redistribuer selon les termes de la licence.");
m("Que disait le premier SMS de l'histoire, envoyé en 1992 ?", "« Merry Christmas »", ["« Hello World »", "« Test »", "« Bonjour »"], "Il a été envoyé le 3 décembre depuis un ordinateur vers un téléphone.");
m("Quel composant a remplacé le tube à vide dans les ordinateurs ?", "Le transistor", ["La diode laser", "Le condensateur", "Le relais"], "Inventé en 1947, il est plus petit, plus fiable et consomme bien moins.");
m("Qu'appelle-t-on le « cloud » ?", "Des serveurs distants loués à la demande", ["Un réseau de satellites en orbite basse", "Une mémoire intégrée au téléphone", "Un type de connexion sans fil"], "Vos fichiers « dans le nuage » sont sur des disques bien réels, dans des centres de données.");
m("Qui a dirigé l'équipe du logiciel de bord des missions Apollo ?", "Margaret Hamilton", ["Grace Hopper", "Katherine Johnson", "Hedy Lamarr"], "On lui doit aussi d'avoir popularisé l'expression « génie logiciel ».");
m("Comment une fibre optique transporte-t-elle les données ?", "Par des impulsions de lumière", ["Par des courants électriques", "Par des ondes radio", "Par des ondes sonores"], "La lumière reste piégée dans le cœur de verre par réflexion.");
m("Comment s'écrit le nombre 5 en binaire ?", "101", ["110", "111", "100"], "4 + 0 + 1. 110 vaut 6, 111 vaut 7 et 100 vaut 4.");
m("Quel langage sert à structurer le contenu d'une page web ?", "HTML", ["SQL", "C++", "Bash"], "HTML décrit les titres, paragraphes, liens et images ; CSS s'occupe de l'apparence.");
m("D'où vient le nom « Bluetooth » ?", "D'un roi viking du Xᵉ siècle", ["D'un ingénieur suédois", "D'un poisson des abysses", "D'un pigment de puce électronique"], "Harald « à la dent bleue » avait unifié le Danemark, comme la norme unifie les appareils.");
m("En quelle année Wikipédia a-t-elle été lancée ?", "2001", ["1995", "2005", "2009"], "La version française a suivi quelques mois après l'anglaise.");
m("Le mot « algorithme » vient du nom de…", "Al-Khwarizmi, mathématicien persan", ["Alan Turing, mathématicien anglais", "Archimède, savant grec", "Euclide, géomètre grec"], "Ce savant du IXᵉ siècle a aussi donné le mot « algèbre », d'après le titre d'un de ses livres.");
m("Combien de satellites un récepteur GPS doit-il capter au minimum pour une position en 3D ?", "Quatre", ["Un", "Deux", "Douze"], "Trois pour la position, un quatrième pour corriger l'horloge du récepteur.");
m("Quel navigateur a popularisé le Web auprès du grand public en 1993 ?", "Mosaic", ["Internet Explorer", "Firefox", "Chrome"], "Mosaic affichait les images dans le texte ; ses créateurs ont ensuite fondé Netscape.");
m("Dans quel pays le QR code a-t-il été inventé, en 1994 ?", "Au Japon", ["Aux États-Unis", "En Allemagne", "En Corée du Sud"], "Il servait à suivre les pièces dans les usines automobiles.");
m("Dans un ordinateur, qu'est-ce que la RAM ?", "La mémoire vive, vidée à l'extinction", ["Le disque de stockage permanent", "Le processeur dédié à l'affichage des images", "Le bloc d'alimentation électrique"], "Elle contient ce sur quoi l'ordinateur travaille à l'instant.");
m("Quel format d'image compresse les photos en acceptant une légère perte de qualité ?", "JPEG", ["PNG", "BMP", "SVG"], "PNG compresse sans perte ; SVG décrit des dessins vectoriels.");

v("Le premier disque dur, en 1956, pesait environ une tonne pour quelques mégaoctets.", true, "Le RAMAC d'IBM stockait environ 5 Mo sur cinquante plateaux.");
v("Le symbole @ a été inventé pour le courrier électronique.", false, "Il existait depuis des siècles ; Ray Tomlinson l'a choisi en 1971 parce qu'il était peu utilisé.");
v("L'ordinateur de bord d'Apollo 11 était moins puissant qu'un téléphone actuel.", true, "Des millions de fois moins : quelques dizaines de kilooctets de mémoire.");
v("Le Wi-Fi fonctionne grâce à des ondes radio.", true, "Sur des fréquences de 2,4, 5 ou 6 GHz.");
v("Un fichier vidé de la corbeille est aussitôt effacé physiquement du disque.", false, "Seule sa référence est supprimée ; les données restent jusqu'à ce qu'elles soient écrasées.");
v("Le tout premier site web est encore consultable aujourd'hui.", true, "Le CERN l'a remis en ligne à son adresse d'origine, info.cern.ch.");
v("Des câbles sous-marins transportent l'essentiel du trafic Internet entre les continents.", true, "Bien plus que les satellites : plus de 95 % des échanges intercontinentaux.");
v("Le clavier AZERTY a été conçu pour les ordinateurs.", false, "Il vient des machines à écrire du XIXᵉ siècle.");
v("Un gigaoctet vaut environ mille mégaoctets.", true, "1 000 Mo selon le Système international ; 1 024 Mo selon l'ancien usage informatique.");
v("Java et JavaScript sont deux versions du même langage.", false, "Ils n'ont que le nom en commun, choisi à l'époque pour des raisons commerciales.");

export default b;
