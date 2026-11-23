// Lecture à voix haute : découpage du texte, langue devinée, texte lu pour une synthèse.
import assert from "node:assert/strict";
import { test } from "node:test";
import { guessLang, speechChunks, synthesisSpeech } from "../lib/lecture.ts";

test("lecture : la langue est devinée d'après les mots courants", () => {
  assert.equal(guessLang("La sonde est entrée en orbite autour de Mercure, après un long voyage dans le Système solaire."), "fr");
  assert.equal(guessLang("NASA and SpaceX are targeting Sunday for the next launch to the International Space Station."), "en");
  assert.equal(guessLang(""), "fr");
});

test("lecture : passages courts, dans l'ordre, sans rien perdre ni lire les adresses", () => {
  const text = "Première phrase. Deuxième phrase, un peu plus longue que la première ! Et une question ? Voir https://exemple.test/page pour la suite. " + "Un mot ".repeat(120) + "fin.";
  const chunks = speechChunks(text);
  assert.ok(chunks.length >= 4);
  assert.ok(chunks.every((c) => c.length > 0 && c.length <= 220), `passage trop long : ${Math.max(...chunks.map((c) => c.length))}`);
  assert.ok(!chunks.join(" ").includes("http"));
  const words = (s: string) => s.replace(/https?:\/\/\S+/g, " ").split(/\s+/).filter(Boolean);
  assert.deepEqual(words(chunks.join(" ")), words(text));
  assert.deepEqual(speechChunks("   "), []);
  assert.deepEqual(speechChunks("Sans ponctuation finale"), ["Sans ponctuation finale"]);
});

test("lecture : la synthèse annonce ses rubriques et termine chaque point", () => {
  const spoken = synthesisSpeech({ essentiel: "L’essentiel", points: ["Premier point", "Second point."], contexte: "Le contexte", limites: null });
  assert.equal(spoken, "L’essentiel. À retenir. Premier point. Second point. Pourquoi c’est important. Le contexte.");
  assert.equal(synthesisSpeech({ essentiel: "Seul.", points: [] }), "Seul.");
});
