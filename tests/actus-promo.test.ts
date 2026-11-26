// Les réclames déguisées en articles n'entrent pas dans le fil ; les vraies nouvelles, si.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPromotional } from "../lib/actus/sources.ts";

test("réclames écartées : prix dans le titre, produit à acheter, rubrique commerciale", () => {
  const promos: [string, string, string?][] = [
    ["Après le billet d’avion, pensez à l’eSIM : 50 Go en Thaïlande pour 12,95 €", "Pour rester connecté pendant un séjour en Thaïlande, eTravelSim propose un forfait eSIM de 50 Go valable 10 jours à 12,95 €."],
    ["Ce casque audio passe à 49 euros seulement", ""],
    ["Ryanair change l'attribution des sièges avant le décollage", "La compagnie aérienne modifie ses règles."],
    ["Ce VPN protège toute la famille", "Une offre valable ce week-end."],
    ["Cet aspirateur robot à -40 % est l'affaire du jour", ""],
    ["Quel télescope choisir pour débuter ?", "Notre sélection de trois modèles."],
    ["Un robot tondeuse silencieux", "Test complet.", "https://www.exemple.fr/bons-plans/robot-tondeuse-silencieux/"],
  ];
  for (const [title, summary, link] of promos) assert.equal(isPromotional(title, summary, link), true, title);
});

test("vraies nouvelles gardées, même avec un montant ou un pourcentage dans le texte", () => {
  const news: [string, string, string?][] = [
    ["Le télescope James Webb observe une galaxie née 300 millions d'années après le Big Bang", "Une équipe internationale publie ses résultats."],
    ["ITER : un budget revu à 25 milliards d'euros", "Le chantier prend du retard."],
    ["Une start-up française lève 40 millions d'euros pour ses batteries", ""],
    ["La banquise arctique a perdu 13 % de sa surface par décennie", "Les mesures satellitaires le confirment."],
    ["Un vaccin contre le paludisme réduit de 75 % les cas graves", "Essai clinique sur 4 800 enfants.", "https://www.exemple.fr/sante/actualites/vaccin-paludisme/"],
    ["Pourquoi les prix de l'électricité solaire s'effondrent", "Le coût des panneaux a été divisé par dix."],
  ];
  for (const [title, summary, link] of news) assert.equal(isPromotional(title, summary, link), false, title);
});
