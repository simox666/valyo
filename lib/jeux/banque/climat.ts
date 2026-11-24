import { banque } from "./outils.ts";

const b = banque("climat");
const { m, v } = b;

m("Qu'est-ce que le GIEC ?", "Un groupe d'experts de l'ONU sur le climat", ["Une agence européenne de prévision météorologique", "Un traité sur la couche d'ozone", "Un fonds mondial pour les forêts"], "Créé en 1988, il ne mène pas de recherches : il fait la synthèse des études publiées.");
m("Que protège le protocole de Montréal, signé en 1987 ?", "La couche d'ozone", ["Les forêts tropicales", "Les baleines", "Les récifs coralliens"], "Il a interdit progressivement les gaz qui la détruisaient.");
m("De combien la planète s'est-elle réchauffée depuis l'ère préindustrielle ?", "D'un peu plus de 1 °C", ["D'environ 0,1 °C", "D'environ 5 °C", "D'environ 10 °C"], "5 °C, c'est à peu près l'écart qui nous sépare de la dernière glaciation.");
m("Sans effet de serre naturel, quelle serait la température moyenne de la Terre ?", "Environ −18 °C", ["Environ 15 °C", "Environ 0 °C", "Environ −100 °C"], "L'effet de serre naturel rend la Terre habitable ; le problème vient de son renforcement.");
m("La concentration de CO₂ dans l'air, d'environ 280 ppm avant l'ère industrielle, a dépassé quel niveau dans les années 2020 ?", "420 ppm", ["300 ppm", "800 ppm", "2 000 ppm"], "Soit une hausse de moitié, à un niveau inédit depuis des millions d'années.");
m("Qu'est-ce que l'albédo ?", "La part du rayonnement solaire renvoyée par une surface", ["La quantité de pluie tombée sur une région en une année entière", "La vitesse de fonte d'un glacier en été", "La teneur en sel de l'eau de mer"], "La neige renvoie l'essentiel de la lumière ; l'océan sombre l'absorbe. Moins de glace, c'est donc plus de chaleur.");
m("À quoi est due l'acidification des océans ?", "À l'absorption de CO₂ par l'eau de mer", ["Aux marées noires", "À la fonte des icebergs et des glaciers côtiers", "Au sel des routes"], "Dissous dans l'eau, le CO₂ forme un acide qui fragilise coquillages et coraux.");
m("Dans quel océan se produit le phénomène El Niño ?", "Le Pacifique", ["L'Atlantique", "L'océan Indien", "L'Arctique"], "Un réchauffement des eaux de surface qui dérègle la météo sur une grande partie du globe.");
m("Où se trouve la plus grande réserve de glace de la planète ?", "En Antarctique", ["Au Groenland", "Dans l'Himalaya", "En Arctique"], "Environ 90 % de la glace mondiale. La banquise arctique, elle, est une mince couche d'eau de mer gelée.");
m("Qu'est-ce que le pergélisol (permafrost) ?", "Un sol gelé en permanence", ["Une banquise dérivante", "Un glacier de montagne", "Une pluie verglaçante"], "Son dégel libère du CO₂ et du méthane jusque-là piégés.");
m("Combien de grandes extinctions de masse la Terre a-t-elle connues avant notre époque ?", "Cinq", ["Deux", "Neuf", "Douze"], "D'où l'expression « sixième extinction » pour désigner l'érosion actuelle du vivant.");
m("Quels gaz ont creusé le trou dans la couche d'ozone ?", "Les CFC", ["Le CO₂", "Le méthane", "L'argon"], "Les chlorofluorocarbures servaient dans les aérosols et les réfrigérateurs.");
m("Que mesure la « courbe de Keeling », commencée en 1958 ?", "Le CO₂ de l'air à Mauna Loa", ["La température de l'océan", "Le niveau moyen de la mer", "L'épaisseur de la banquise"], "Cet observatoire d'Hawaï est loin de toute pollution locale.");
m("Quel secteur émet le plus de gaz à effet de serre dans le monde ?", "La production d'électricité et de chaleur", ["Le transport aérien de passagers", "Les centres de données et le numérique", "Le traitement des déchets ménagers"], "Surtout à cause du charbon et du gaz brûlés dans les centrales.");
m("Quelle est la principale source de méthane liée à l'élevage ?", "La digestion des ruminants", ["Les tracteurs", "Le chauffage des étables", "Le transport du lait"], "Les vaches le rejettent surtout en éructant.");
m("Qu'est-ce qu'un puits de carbone ?", "Un milieu qui absorbe plus de CO₂ qu'il n'en rejette", ["Un forage qui extrait du charbon en profondeur", "Une usine qui brûle des déchets ménagers", "Un gisement de gaz naturel épuisé puis rebouché au ciment"], "Les forêts, les sols et les océans absorbent environ la moitié de nos émissions.");
m("Sur quelle durée définit-on habituellement un climat ?", "Environ 30 ans", ["Une semaine", "Une saison", "Un an"], "La météo décrit le temps qu'il fait ; le climat, les moyennes sur des décennies.");
m("Quelle est la plus grande forêt tropicale du monde ?", "L'Amazonie", ["La forêt du bassin du Congo", "La forêt de Bornéo", "La forêt de Nouvelle-Guinée"], "Elle s'étend sur neuf pays ; celle du bassin du Congo est la deuxième.");
m("Quand le dernier maximum glaciaire a-t-il eu lieu ?", "Il y a environ 20 000 ans", ["Il y a environ 2 000 ans", "Il y a environ 2 millions d'années", "Il y a environ 200 millions d'années"], "Le niveau des mers était alors plus bas d'environ 120 mètres.");
m("Quel pays émet aujourd'hui le plus de CO₂ chaque année ?", "La Chine", ["Les États-Unis", "L'Inde", "La Russie"], "Par habitant et en cumul historique, les États-Unis restent devant.");
m("Qu'est-ce qui provoque surtout le blanchissement des coraux ?", "Une eau trop chaude", ["Un manque de sel", "Une mer trop calme", "Un excès de plancton"], "Stressé, le corail expulse les algues qui le nourrissent et lui donnent sa couleur.");
m("Qu'est-ce que le Gulf Stream ?", "Un courant chaud de l'Atlantique Nord", ["Un vent sec venu du Sahara", "Une mousson d'Asie du Sud", "Un courant froid qui longe les côtes du Pacifique"], "Il transporte de la chaleur depuis le golfe du Mexique vers l'Europe.");

v("Le trou dans la couche d'ozone est la cause principale du réchauffement climatique.", false, "Ce sont deux problèmes distincts : le réchauffement vient surtout du CO₂ des énergies fossiles.");
v("Les océans ont absorbé plus de 90 % de l'excès de chaleur dû au réchauffement.", true, "C'est pourquoi leur température est un indicateur plus stable que celle de l'air.");
v("Le CO₂ représente environ 20 % de l'air.", false, "Seulement 0,04 % ; c'est l'oxygène qui en représente 21 %.");
v("La vapeur d'eau est un gaz à effet de serre.", true, "C'est même le plus abondant ; elle amplifie le réchauffement causé par le CO₂.");
v("Un hiver très froid quelque part prouve que le climat ne se réchauffe pas.", false, "Le climat se juge sur des moyennes mondiales et sur des décennies.");
v("Les glaciers des Alpes ont perdu une grande partie de leur volume depuis 1850.", true, "Plus de la moitié, et le recul s'accélère.");
v("Le méthane reste plus longtemps dans l'atmosphère que le CO₂.", false, "Environ douze ans, contre des siècles pour une partie du CO₂ ; mais il réchauffe bien plus à quantité égale.");
v("Un arbre stocke du carbone en grandissant.", true, "Il le tire du CO₂ de l'air ; le bois sec est fait pour moitié de carbone.");
v("La couche d'ozone est en train de se reconstituer.", true, "Grâce à l'interdiction des CFC, un retour à la normale est attendu vers le milieu du siècle.");
v("La mer monte en partie parce que l'eau se dilate en se réchauffant.", true, "La dilatation et la fonte des glaces terrestres y contribuent toutes les deux.");

export default b;
