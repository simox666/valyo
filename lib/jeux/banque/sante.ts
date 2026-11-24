import { banque } from "./outils.ts";

const b = banque("sante");
const { m, v } = b;

m("Quel organe produit l'insuline ?", "Le pancréas", ["Le foie", "Les reins", "La rate"], "L'insuline fait entrer le sucre du sang dans les cellules.");
m("Quel est le plus grand organe du corps humain ?", "La peau", ["Le foie", "Les poumons", "L'intestin"], "Environ 2 m² chez un adulte.");
m("Quel groupe sanguin est dit « donneur universel » pour les globules rouges ?", "O négatif", ["AB positif", "A positif", "B négatif"], "Ses globules rouges ne portent ni antigène A, ni B, ni Rhésus.");
m("Qui a découvert les rayons X en 1895 ?", "Wilhelm Röntgen", ["Marie Curie", "Louis Pasteur", "Robert Koch"], "La première radiographie montre la main de son épouse. Il reçoit le premier Nobel de physique en 1901.");
m("Quelle vitamine la peau fabrique-t-elle sous l'effet du soleil ?", "La vitamine D", ["La vitamine C", "La vitamine A", "La vitamine B12"], "Elle aide à fixer le calcium sur les os.");
m("Le scorbut, maladie des marins d'autrefois, est dû à une carence en…", "Vitamine C", ["Vitamine D", "Fer", "Calcium"], "Les agrumes embarqués à bord ont fini par le faire disparaître.");
m("Qui a identifié le bacille de la tuberculose en 1882 ?", "Robert Koch", ["Louis Pasteur", "Alexandre Yersin", "Joseph Lister"], "On parle encore du « bacille de Koch ». Yersin, lui, a identifié celui de la peste.");
m("Combien d'os compte le squelette d'un adulte ?", "206", ["106", "306", "412"], "Plus de la moitié se trouvent dans les mains et les pieds.");
m("Qui a réalisé la première greffe de cœur humain, en 1967 ?", "Christiaan Barnard", ["Alexis Carrel", "Jean Bernard", "Denton Cooley"], "Au Cap, en Afrique du Sud. Le patient a survécu dix-huit jours.");
m("Quelle cellule transporte l'oxygène dans le sang ?", "Le globule rouge", ["Le globule blanc", "La plaquette", "Le neurone"], "Grâce à l'hémoglobine, qui lui donne sa couleur.");
m("Dans un vaccin à ARN messager, à quoi sert l'ARN ?", "À fournir aux cellules la recette d'une protéine virale", ["À modifier durablement l'ADN du noyau cellulaire", "À détruire directement le virus dans le sang", "À remplacer les anticorps que le corps ne fabrique plus"], "Le système immunitaire apprend à reconnaître cette protéine ; l'ARN, lui, est dégradé en quelques jours.");
m("Où se trouve le fémur ?", "Dans la cuisse", ["Dans le bras", "Dans le dos", "Dans le crâne"], "C'est l'os le plus long du corps.");
m("Quelle maladie est liée à un manque d'insuline ou à une résistance à celle-ci ?", "Le diabète", ["L'asthme", "L'anémie", "L'hypertension"], "Le sucre s'accumule alors dans le sang.");
m("Sur quoi repose l'imagerie par résonance magnétique (IRM) ?", "Un champ magnétique et des ondes radio", ["Un faisceau de rayons X", "Des ultrasons", "Un traceur radioactif injecté dans le sang du patient"], "Elle n'expose donc pas aux rayons X, contrairement au scanner.");
m("Quel médecin a montré en 1847 que se laver les mains sauvait la vie des femmes en couches ?", "Ignace Semmelweis", ["Louis Pasteur", "Florence Nightingale", "Claude Bernard"], "Ses confrères l'ont rejeté ; les microbes n'étaient pas encore connus.");
m("Qu'est-ce qu'un placebo ?", "Un traitement sans principe actif", ["Un médicament générique vendu sans ordonnance", "Un vaccin atténué", "Un antidouleur léger"], "Il sert de point de comparaison dans les essais cliniques.");
m("Quelle partie du cerveau coordonne l'équilibre et la précision des mouvements ?", "Le cervelet", ["L'hippocampe", "Le thalamus", "L'hypophyse"], "L'hippocampe, lui, joue un rôle clé dans la mémoire.");
m("Par quel animal le paludisme est-il transmis ?", "Un moustique", ["Une tique", "Une mouche", "Un rat"], "L'anophèle femelle transmet le parasite en piquant.");
m("Quelle est la température normale du corps humain ?", "Environ 37 °C", ["Environ 35 °C", "Environ 39 °C", "Environ 41 °C"], "Elle varie d'environ un degré au cours de la journée.");
m("Combien de litres de sang un adulte a-t-il ?", "Environ 5 litres", ["Environ 2 litres", "Environ 10 litres", "Environ 15 litres"], "Un don de sang en prélève un peu moins d'un demi-litre.");
m("Qui a introduit l'antisepsie en chirurgie dans les années 1860 ?", "Joseph Lister", ["Edward Jenner", "Alexander Fleming", "William Harvey"], "Il désinfectait plaies et instruments au phénol, en s'appuyant sur les travaux de Pasteur.");
m("Qui a décrit la circulation du sang en 1628 ?", "William Harvey", ["André Vésale", "Ambroise Paré", "Hippocrate"], "Il montre que le cœur est une pompe et que le sang circule en boucle.");

v("Le cerveau lui-même ne ressent pas la douleur.", true, "Il n'a pas de récepteurs de la douleur, ce qui permet d'opérer des patients éveillés.");
v("Faire craquer ses doigts provoque de l'arthrose.", false, "Aucune étude ne l'a montré ; le bruit vient de bulles de gaz dans l'articulation.");
v("Les vrais jumeaux ont les mêmes empreintes digitales.", false, "Elles se forment aussi selon les hasards de la vie dans l'utérus.");
v("L'estomac produit de l'acide chlorhydrique.", true, "Un mucus protège sa paroi de sa propre acidité.");
v("Un adulte a plus d'os qu'un nouveau-né.", false, "Le bébé en a près de 300 ; beaucoup se soudent en grandissant.");
v("On attrape un rhume à cause du froid lui-même.", false, "Il faut un virus. L'hiver favorise surtout la vie en intérieur, où il circule mieux.");
v("Le foie peut se régénérer après l'ablation d'une partie.", true, "C'est ce qui rend possible le don d'une partie du foie de son vivant.");
v("Les ongles et les cheveux continuent de pousser après la mort.", false, "La peau se rétracte en se desséchant, ce qui donne cette impression.");
v("Notre corps abrite à peu près autant de bactéries que de cellules humaines.", true, "Quelques dizaines de milliers de milliards de chaque, surtout dans l'intestin.");
v("La vaccination a fait disparaître la poliomyélite de la plupart des pays.", true, "Le virus sauvage ne circule plus que dans de très rares pays.");

export default b;
