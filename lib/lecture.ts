// Lecture à voix haute (voix de synthèse du navigateur) : préparation du texte, sans dépendance au navigateur.

/** Devine si un texte est en français ou en anglais (certains articles importés sont en anglais). */
export function guessLang(text: string): "fr" | "en" {
  const words = ` ${text.toLowerCase().replace(/[^\p{L}’']+/gu, " ")} `;
  const count = (list: string[]) => list.reduce((n, w) => n + (words.split(` ${w} `).length - 1), 0);
  const fr = count(["le", "la", "les", "des", "est", "une", "et", "dans", "pour", "que", "qui", "du", "sur", "avec"]);
  const en = count(["the", "and", "of", "is", "to", "in", "for", "that", "with", "on", "from", "will", "are"]);
  return en > fr ? "en" : "fr";
}

const MAX = 220;

/**
 * Découpe un texte en courts passages, lus l'un après l'autre : certains navigateurs coupent
 * la lecture d'un passage trop long, et la pause reprend au début du passage en cours.
 */
export function speechChunks(text: string): string[] {
  const clean = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_#>`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]+["»”’)]*|[^.!?…]+$/g) ?? [clean];
  const chunks: string[] = [];
  for (const raw of sentences) {
    let sentence = raw.trim();
    if (!sentence) continue;
    while (sentence.length > MAX) {
      const slice = sentence.slice(0, MAX);
      const cut = Math.max(slice.lastIndexOf(", "), slice.lastIndexOf(" ; "), slice.lastIndexOf(" : "));
      const at = cut > 60 ? cut + 1 : slice.lastIndexOf(" ") > 0 ? slice.lastIndexOf(" ") : MAX;
      chunks.push(sentence.slice(0, at).trim());
      sentence = sentence.slice(at).trim();
    }
    // Les phrases très courtes sont collées à la précédente pour une diction plus naturelle.
    const last = chunks[chunks.length - 1];
    if (last && last.length + sentence.length + 1 <= MAX && sentence.length < 60) chunks[chunks.length - 1] = `${last} ${sentence}`;
    else if (sentence) chunks.push(sentence);
  }
  return chunks;
}

/** Texte lu pour une synthèse IA : les rubriques sont annoncées comme à l'écran. */
export function synthesisSpeech(content: { essentiel: string; points: string[]; contexte?: string | null; limites?: string | null }): string {
  const end = (s: string) => (/[.!?…]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
  return [
    end(content.essentiel),
    content.points.length ? `À retenir. ${content.points.map(end).join(" ")}` : "",
    content.contexte ? `Pourquoi c’est important. ${end(content.contexte)}` : "",
    content.limites ? `Ce qui reste à confirmer. ${end(content.limites)}` : "",
  ].filter(Boolean).join(" ");
}
