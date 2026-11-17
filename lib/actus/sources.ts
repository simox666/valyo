// Sources d'actus importées automatiquement : titre, court extrait, image fournie par le flux,
// et lien vers l'article d'origine. Principe d'agrégateur : on renvoie TOUJOURS vers la source,
// on n'en reproduit jamais l'article. L'image n'est affichée que si l'éditeur la publie
// lui-même (flux RSS ou balise og:image), créditée à la source.
// Uniquement des sites en accès libre : un article réservé aux abonnés est écarté (paywall.ts).

export const ACTU_THEMES = [
  "ia", "robotique", "espace", "sciences", "tech", "sante", "climat", "energie", "physique", "biologie", "cyber",
] as const;
export type ActuTheme = (typeof ACTU_THEMES)[number];

export interface ActuSource {
  id: string;
  name: string;
  url: string;
  /** Thème par défaut quand aucun mot-clé plus précis n'est reconnu. */
  fallback: ActuTheme;
  perRun: number;
  lang: "fr" | "en";
  /**
   * Licence libre autorisant la republication intégrale : l'article complet est alors repris
   * tel quel, avec l'auteur, la licence et le lien vers l'original (exception au principe
   * d'agrégateur ci-dessus).
   */
  license?: { name: string; url: string };
}

export const ACTU_SOURCES: ActuSource[] = [
  { id: "futura", name: "Futura Sciences", url: "https://www.futura-sciences.com/rss/actualites.xml", fallback: "sciences", perRun: 2, lang: "fr" },
  { id: "futura-sante", name: "Futura Santé", url: "https://www.futura-sciences.com/rss/sante/actualites.xml", fallback: "sante", perRun: 1, lang: "fr" },
  { id: "theconversation", name: "The Conversation", url: "https://theconversation.com/fr/articles.atom", fallback: "sciences", perRun: 2, lang: "fr",
    license: { name: "Creative Commons BY-ND 4.0", url: "https://creativecommons.org/licenses/by-nd/4.0/deed.fr" } },
  { id: "trustmyscience", name: "Trust My Science", url: "https://trustmyscience.com/feed/", fallback: "sciences", perRun: 2, lang: "fr" },
  { id: "cnrs", name: "CNRS Le Journal", url: "https://lejournal.cnrs.fr/rss", fallback: "sciences", perRun: 1, lang: "fr" },
  { id: "inserm", name: "Inserm", url: "https://presse.inserm.fr/feed/", fallback: "sante", perRun: 1, lang: "fr" },
  { id: "numerama", name: "Numerama", url: "https://www.numerama.com/feed/", fallback: "tech", perRun: 2, lang: "fr" },
  { id: "journaldugeek", name: "Journal du Geek", url: "https://www.journaldugeek.com/feed/", fallback: "tech", perRun: 1, lang: "fr" },
  { id: "pressecitron", name: "Presse-citron", url: "https://www.presse-citron.net/feed/", fallback: "tech", perRun: 1, lang: "fr" },
  { id: "frandroid", name: "Frandroid", url: "https://www.frandroid.com/feed", fallback: "tech", perRun: 1, lang: "fr" },
  { id: "sieclesdigital", name: "Siècle Digital", url: "https://siecledigital.fr/feed/", fallback: "tech", perRun: 1, lang: "fr" },
  { id: "actuia", name: "ActuIA", url: "https://www.actuia.com/feed/", fallback: "ia", perRun: 1, lang: "fr" },
  { id: "zataz", name: "ZATAZ", url: "https://www.zataz.com/feed/", fallback: "cyber", perRun: 1, lang: "fr" },
  { id: "revolution-energetique", name: "Révolution Énergétique", url: "https://www.revolution-energetique.com/feed/", fallback: "energie", perRun: 1, lang: "fr" },
  { id: "nasa", name: "NASA", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", fallback: "espace", perRun: 1, lang: "en" },
];

/** Au plus ce nombre de nouvelles par passage, toutes sources confondues : pas d'inondation du fil. */
export const MAX_PER_RUN = 18;

// Ordre = priorité : le thème le plus précis gagne.
const KEYWORDS: [ActuTheme, RegExp][] = [
  ["espace", /(\bespace\b|spatial|astronom|astrophys|planète|exoplanète|\bMars\b|\bLune\b|lunaire|satellite|fusée|galaxie|télescope|trou noir|comète|astéroïde|cosmique|\bNASA\b|\bESA\b|SpaceX|Starship)/i],
  ["cyber", /(cyber|piratage|pirates? informatiques?|hackers?|rançongiciel|ransomware|fuite (de données|géante)|données (personnelles|bancaires) .{0,30}(volées|exposées|dérobées)|vulnérabilité|faille de sécurité|malware|logiciel malveillant|phishing|hameçonnage|\bANSSI\b)/i],
  ["robotique", /(\brobots?\b|robotique|\bdrones?\b|humanoïde|exosquelette)/i],
  ["ia", /(intelligence artificielle|\bIA\b|IA générative|apprentissage (automatique|profond)|réseaux? de neurones|\bLLM\b|ChatGPT|OpenAI|Gemini|Mistral|Anthropic|Claude|machine learning|\bAI\b|agents? IA)/i],
  ["energie", /(énergie|énergétique|nucléaire|solaire|éolien|photovolta|hydrogène|électricité|fusion nucléaire|centrale|géotherm|pétrole|\bgaz\b|batteries? (du futur|sodium|lithium|solides?))/i],
  ["climat", /(climat|réchauffement|biodiversité|environnement|pollution|\bCO2\b|carbone|émissions|océan|glacier|sécheresse|canicule|incendie|déforestation|écolog|espèces? menacées|plastique)/i],
  ["sante", /(santé|médec|médical|maladie|cancer|vaccin|virus|bactéri|patient|hôpital|thérapie|essai clinique|alzheimer|parkinson|diabète|épidém|\bInserm\b|sommeil|obésité|antibio)/i],
  ["physique", /(physique|quantique|particule|\bCERN\b|photon|atome|laser|supraconduct|neutrino|boson|relativité|mathémati)/i],
  ["biologie", /(biologi|espèce|animal|animaux|évolution|fossile|dinosaure|\bADN\b|génome|\bgènes?\b|cellule|insecte|plantes?\b|paléonto)/i],
];

/** Contenus promotionnels ou hors sujet écartés (bons plans, séries, jeux…). */
const OFF_TOPIC = /(black friday|bon plan|bons plans|\bpromo|réduction|soldes|\bcode promo|prime video|netflix|disney\+|\bsérie\b|\bfilm\b|meilleures? offres?|\bprix\b.{0,20}(baisse|chute)|jeu vidéo|\bjeux?\b|\bPS5\b|xbox|nintendo|pokémon|\bGTA\b|loto|euromillions|horoscope)/i;

export function classify(source: ActuSource, text: string): ActuTheme | null {
  if (OFF_TOPIC.test(text)) return null;
  for (const [theme, re] of KEYWORDS) if (re.test(text)) return theme;
  return source.fallback;
}
