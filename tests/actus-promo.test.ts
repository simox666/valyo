// Les réclames déguisées en articles n'entrent pas dans le fil ; les vraies nouvelles, si.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTU_SOURCES, classify, isPromotional } from "../lib/actus/sources.ts";

test("réclames écartées : prix dans le titre, produit à acheter, rubrique commerciale", () => {
  const promos: [string, string, string?][] = [
    ["Après le billet d’avion, pensez à l’eSIM : 50 Go en Thaïlande pour 12,95 €", "Pour rester connecté pendant un séjour en Thaïlande, eTravelSim propose un forfait eSIM de 50 Go valable 10 jours à 12,95 €."],
    ["Ce casque audio passe à 49 euros seulement", ""],
    ["Test Shark AquaReach Premium : un aspirateur-laveur sans fil polyvalent qui aspire et lave séparément", "En France, Shark le vend en trois versions."],
    ["On a testé la nouvelle montre connectée de la marque", ""],
    ["Ryanair change l'attribution des sièges avant le décollage", "La compagnie modifie ses règles."],
    ["Ce VPN protège toute la famille", "Une offre valable ce week-end."],
    ["Test d'une enceinte connectée", "Contenu sponsorisé par la marque."],
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
    ["Un test sanguin détecte la maladie d'Alzheimer dix ans plus tôt", "Résultats d'un essai clinique."],
    ["Une start-up française lève 40 millions d'euros pour ses batteries", ""],
    ["La banquise arctique a perdu 13 % de sa surface par décennie", "Les mesures satellitaires le confirment."],
    ["Un vaccin contre le paludisme réduit de 75 % les cas graves", "Essai clinique sur 4 800 enfants.", "https://www.exemple.fr/sante/actualites/vaccin-paludisme/"],
    ["Pourquoi les prix de l'électricité solaire s'effondrent", "Le coût des panneaux a été divisé par dix."],
    ["Quercy : des fossiles témoins d’un bouleversement climatique", "Reportage en partenariat avec Le Monde.", "https://lejournal.cnrs.fr/videos/quercy-des-fossiles"],
    ["L'IA moins chère peut-elle appauvrir tout le monde ?", "Un service qui se vend sous son coût dans les forfaits."],
  ];
  for (const [title, summary, link] of news) assert.equal(isPromotional(title, summary, link), false, title);
});

test("sources généralistes : un article hors thème n'entre pas, un article de science ou de tech si", () => {
  const conv = ACTU_SOURCES.find((x) => x.id === "theconversation")!;
  const numerama = ACTU_SOURCES.find((x) => x.id === "numerama")!;
  const futura = ACTU_SOURCES.find((x) => x.id === "futura")!;
  const c = (source: typeof conv, title: string, summary = "") => classify(source, `${title} ${summary}`, title);

  assert.equal(c(conv, "Le nouveau quitte ou double de Pedro Sanchez : les élections générales espagnoles anticipées au 29 novembre 2026", "Le socialiste Pedro Sanchez, qui dirige l’Espagne depuis 2018, a avancé les élections."), null);
  assert.equal(c(conv, "Pourquoi les loyers flambent dans les grandes villes", "Analyse d'un marché sous tension."), null, "ni thème reconnu, ni thème par défaut");
  assert.equal(c(conv, "Rendez-vous le 12 mars pour la réforme", "Le calendrier se précise."), null, "le mois de mars n'est pas la planète");
  assert.equal(c(conv, "Élections : comment l'intelligence artificielle fabrique de fausses vidéos"), null, "titre politique : écarté, même avec un mot-clé");
  assert.equal(c(numerama, "Cette voiture thermique change de calandre", "Le constructeur dévoile son restylage."), null);

  assert.equal(c(conv, "Ce que le télescope James Webb nous apprend sur les premières galaxies"), "espace");
  assert.equal(c(conv, "Des chercheurs décrivent une molécule inédite", "Travaux publiés cette semaine."), "sciences");
  assert.equal(c(numerama, "Le prochain iPhone abandonnerait le port USB"), "tech");
  assert.equal(c(numerama, "Un rover photographie un cratère sur Mars"), "espace");
  assert.equal(c(conv, "Five reasons why we should still make things with our hands"), null, "titre en anglais");
  assert.equal(c(numerama, "Argent : un plafond de paiement en espèces arrive en France"), null, "des espèces, pas une espèce animale");
  assert.equal(c(conv, "Amour véritable ou passion obsessionnelle ?", "Une réflexion sur l'énergie du désir."), null, "seul le titre compte pour une source généraliste");
  assert.equal(c(numerama, "Routes inondées : comment El Niño fait déborder la Californie"), "climat");
  // Une source spécialisée garde son thème par défaut.
  assert.equal(c(futura, "Ce phénomène étonnant observé au fond d'un lac"), "sciences");
});

test("une réduction de la mortalité ou la remise d'un prix ne sont pas des promotions", () => {
  const inserm = ACTU_SOURCES.find((x) => x.id === "inserm")!;
  assert.equal(classify(inserm, "Alerte canicule : un dispositif associé à une réduction de la mortalité"), "climat", "gardé (le mot « canicule » le range en climat)");
  assert.equal(classify(inserm, "Prix Inserm 2026 : la remise des prix aura lieu en décembre"), "sante");
  assert.equal(classify(inserm, "Ce tensiomètre profite de 30 % de réduction"), null);
});
