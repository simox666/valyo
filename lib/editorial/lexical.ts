// Outils lexicaux simples, partagés par le contrôle serveur des preuves et par
// le fournisseur de test. Ce ne sont PAS une vérification sémantique : ils
// servent de garde-fou minimal (une preuve sans rapport avec l'affirmation est
// refusée) en complément du vérificateur indépendant et de la recette humaine D4.

const STOPWORDS = new Set(
  "avec dans pour par plus sans sous sur entre leurs leur cette cette ces celle celui ceux elle elles nous vous ils mais donc aussi comme tout toute tous toutes être avoir sont était étaient fait faire peut peuvent depuis selon après avant encore très dont quand alors ainsi chez vers notre votre that this with from have been were will would their there which about into".split(
    " ",
  ),
);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ");
}

/** Mots porteurs de sens (5 lettres ou plus, hors mots outils), sans accents. */
export function significantWords(text: string): string[] {
  return [...new Set(normalizeText(text).match(/[a-z]{5,}/g) ?? [])].filter((w) => !STOPWORDS.has(w));
}

/** Nombres et quantités : chiffres, « million », « milliard ». */
export function quantities(text: string): string[] {
  const n = normalizeText(text);
  return [...new Set([...(n.match(/\d+(?:[.,]\d+)?/g) ?? []), ...(n.match(/\b(millions?|milliards?)\b/g) ?? [])])];
}

/** Part des mots porteurs de sens de `statement` présents dans `source`. */
export function overlap(statement: string, source: string): number {
  const words = significantWords(statement);
  if (words.length === 0) return 1;
  const pool = new Set(significantWords(source));
  return words.filter((w) => pool.has(w)).length / words.length;
}

export function missingQuantities(statement: string, source: string): string[] {
  const pool = normalizeText(source);
  return quantities(statement).filter((q) => !pool.includes(q));
}

export function sentences(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) ?? []).map((s) => s.trim()).filter((s) => s.length >= 10);
}

export const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
