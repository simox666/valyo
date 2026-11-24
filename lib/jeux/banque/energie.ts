import { banque } from "./outils.ts";

const b = banque("energie");
const { m, v } = b;

m("Quelle unité figure sur une facture d'électricité pour mesurer l'énergie consommée ?", "Le kilowattheure", ["Le kilowatt", "Le volt", "L'ampère"], "Le kilowatt mesure une puissance ; le kilowattheure, cette puissance utilisée pendant une heure.");
m("Quelle est la première source d'électricité en France ?", "Le nucléaire", ["L'hydraulique", "Le gaz", "L'éolien"], "Il fournit environ les deux tiers de la production.");
m("Quelle est la source d'énergie la plus consommée dans le monde ?", "Le pétrole", ["Le charbon", "Le nucléaire", "Le solaire"], "Environ un tiers de l'énergie mondiale, devant le charbon et le gaz.");
m("Que fait un panneau photovoltaïque ?", "Il convertit la lumière en électricité", ["Il convertit la chaleur en électricité", "Il concentre la lumière sur un fluide", "Il stocke la chaleur de la journée"], "À ne pas confondre avec le panneau solaire thermique, qui chauffe de l'eau.");
m("Quel est le matériau principal des cellules solaires ?", "Le silicium", ["Le cuivre", "Le lithium", "L'aluminium"], "On le tire du sable, puis on le purifie.");
m("Que cherche à maîtriser le projet international ITER, en Provence ?", "La fusion nucléaire", ["La fission du thorium", "Le stockage de l'hydrogène", "La géothermie profonde"], "Il s'agit de fusionner des noyaux d'hydrogène, comme le fait le Soleil.");
m("Qui a inventé la pile électrique en 1800 ?", "Alessandro Volta", ["Luigi Galvani", "André-Marie Ampère", "Michael Faraday"], "Un empilement de disques de zinc et de cuivre : d'où le mot « pile ».");
m("Qui a découvert en 1831 l'induction électromagnétique, principe des alternateurs ?", "Michael Faraday", ["Nikola Tesla", "Thomas Edison", "James Watt"], "Un aimant en mouvement près d'un fil y fait naître un courant.");
m("Dans la « guerre des courants » de la fin du XIXᵉ siècle, que défendait Nikola Tesla ?", "Le courant alternatif", ["Le courant continu", "L'éclairage au gaz", "La machine à vapeur"], "L'alternatif l'a emporté sur le continu d'Edison, car il se transporte mieux sur de longues distances.");
m("Selon la limite de Betz, quelle part maximale de l'énergie du vent une éolienne peut-elle capter ?", "Environ 59 %", ["Environ 25 %", "Environ 80 %", "Environ 99 %"], "Si elle captait tout, l'air s'arrêterait derrière elle et ne pourrait plus circuler.");
m("Comment une station de transfert d'énergie par pompage (STEP) stocke-t-elle l'électricité ?", "En pompant de l'eau vers un bassin en hauteur", ["En comprimant de l'air dans une caverne", "En chauffant du sel fondu dans une cuve", "En faisant tourner à grande vitesse un volant d'inertie"], "L'eau redescend par des turbines quand la demande augmente : c'est de loin le premier moyen de stockage au monde.");
m("Quel est le combustible des centrales nucléaires actuelles ?", "L'uranium", ["Le radium", "Le deutérium", "Le cobalt"], "Enrichi en uranium 235, l'isotope qui se fissionne facilement.");
m("Quel pays tire presque toute son électricité de l'hydraulique et de la géothermie ?", "L'Islande", ["Le Danemark", "L'Espagne", "Le Japon"], "Ses volcans et ses rivières glaciaires lui fournissent une électricité quasi entièrement renouvelable.");
m("Comment fonctionne une pompe à chaleur ?", "Elle déplace la chaleur au lieu de la produire", ["Elle brûle du gaz avec un rendement élevé", "Elle stocke la chaleur de l'été pour l'hiver", "Elle chauffe l'air par des résistances"], "Elle puise la chaleur de l'air extérieur ou du sol, ce qui lui fait restituer plusieurs fois l'électricité consommée.");
m("Quelle est la fréquence du réseau électrique en Europe ?", "50 Hz", ["60 Hz", "100 Hz", "230 Hz"], "60 Hz en Amérique du Nord. 230, ce sont les volts de nos prises.");
m("D'où vient, à l'origine, l'énergie d'un barrage hydroélectrique ?", "Du Soleil, moteur du cycle de l'eau", ["De la rotation de la Terre", "De la chaleur interne du globe terrestre", "De l'attraction de la Lune"], "Le Soleil évapore l'eau, qui retombe en pluie en altitude.");
m("Dans quelle région se trouve l'usine marémotrice de la Rance ?", "En Bretagne", ["En Normandie", "En Écosse", "En Norvège"], "Mise en service en 1966, elle exploite les marées de l'estuaire.");
m("Quelle machine James Watt a-t-il perfectionnée au XVIIIᵉ siècle ?", "La machine à vapeur", ["La dynamo", "Le moteur à explosion", "La turbine à gaz"], "Son nom a été donné à l'unité de puissance.");
m("Dans E = mc², que désigne la lettre c ?", "La vitesse de la lumière", ["La charge de l'électron", "La capacité thermique", "La constante de Coulomb"], "Comme c² est énorme, une très petite masse équivaut à beaucoup d'énergie.");
m("Charbon, pétrole et gaz sont des énergies dites…", "Fossiles", ["Fissiles", "Renouvelables", "Primitives"], "Elles viennent d'organismes enfouis depuis des millions d'années. « Fissile » qualifie l'uranium.");
m("Quel est le rendement typique d'un panneau solaire du commerce ?", "Environ 20 %", ["Environ 2 %", "Environ 60 %", "Environ 90 %"], "Un cinquième de la lumière reçue devient de l'électricité.");
m("Quel pays produit le plus d'électricité solaire ?", "La Chine", ["L'Allemagne", "L'Australie", "Le Maroc"], "Elle fabrique aussi la grande majorité des panneaux vendus dans le monde.");

v("Une ampoule LED consomme bien moins qu'une ampoule à incandescence pour la même lumière.", true, "Environ huit à dix fois moins.");
v("L'électricité se stocke facilement en grande quantité.", false, "C'est l'un des grands défis du réseau : la production doit suivre la consommation à chaque instant.");
v("Le pétrole provient surtout de restes de dinosaures.", false, "Il vient principalement de plancton et d'algues déposés au fond d'anciennes mers.");
v("La fusion nucléaire est la source d'énergie du Soleil.", true, "Il y fusionne de l'hydrogène en hélium.");
v("Un appareil en veille ne consomme rien.", false, "Peu chacun, mais l'ensemble des veilles d'un foyer finit par compter.");
v("Le panache blanc d'une centrale nucléaire est fait de CO₂.", false, "C'est de la vapeur d'eau sortie des tours de refroidissement.");
v("La géothermie exploite la chaleur du sous-sol.", true, "La température augmente d'environ 3 °C tous les 100 mètres de profondeur.");
v("Le vent est indirectement une forme d'énergie solaire.", true, "Il naît des différences de température que le Soleil crée dans l'atmosphère.");
v("Un kilowattheure correspond à mille watts utilisés pendant une heure.", true, "Par exemple un radiateur de 1 000 W allumé une heure.");
v("Le courant est transporté à très haute tension pour limiter les pertes.", true, "Plus la tension est élevée, plus l'intensité est faible, et moins les câbles chauffent.");

export default b;
