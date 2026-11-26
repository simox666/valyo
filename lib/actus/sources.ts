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
  /**
   * Source généraliste (politique, société, culture, automobile… à côté des sciences et de la tech) :
   * un article n'entre que si son texte relève clairement d'un thème de Valyo. Pas de thème par défaut,
   * et un titre de politique ou de société est écarté.
   */
  generalist?: boolean;
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
  { id: "theconversation", name: "The Conversation", url: "https://theconversation.com/fr/articles.atom", fallback: "sciences", perRun: 2, lang: "fr", generalist: true,
    license: { name: "Creative Commons BY-ND 4.0", url: "https://creativecommons.org/licenses/by-nd/4.0/deed.fr" } },
  { id: "trustmyscience", name: "Trust My Science", url: "https://trustmyscience.com/feed/", fallback: "sciences", perRun: 2, lang: "fr" },
  { id: "cnrs", name: "CNRS Le Journal", url: "https://lejournal.cnrs.fr/rss", fallback: "sciences", perRun: 1, lang: "fr" },
  { id: "inserm", name: "Inserm", url: "https://presse.inserm.fr/feed/", fallback: "sante", perRun: 1, lang: "fr" },
  { id: "numerama", name: "Numerama", url: "https://www.numerama.com/feed/", fallback: "tech", perRun: 2, lang: "fr", generalist: true },
  { id: "journaldugeek", name: "Journal du Geek", url: "https://www.journaldugeek.com/feed/", fallback: "tech", perRun: 1, lang: "fr", generalist: true },
  { id: "pressecitron", name: "Presse-citron", url: "https://www.presse-citron.net/feed/", fallback: "tech", perRun: 1, lang: "fr", generalist: true },
  { id: "frandroid", name: "Frandroid", url: "https://www.frandroid.com/feed", fallback: "tech", perRun: 1, lang: "fr", generalist: true },
  { id: "sieclesdigital", name: "Siècle Digital", url: "https://siecledigital.fr/feed/", fallback: "tech", perRun: 1, lang: "fr", generalist: true },
  { id: "actuia", name: "ActuIA", url: "https://www.actuia.com/feed/", fallback: "ia", perRun: 1, lang: "fr" },
  { id: "zataz", name: "ZATAZ", url: "https://www.zataz.com/feed/", fallback: "cyber", perRun: 1, lang: "fr" },
  { id: "revolution-energetique", name: "Révolution Énergétique", url: "https://www.revolution-energetique.com/feed/", fallback: "energie", perRun: 1, lang: "fr" },
  { id: "nasa", name: "NASA", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", fallback: "espace", perRun: 1, lang: "en" },
];

/** Au plus ce nombre de nouvelles par passage, toutes sources confondues : pas d'inondation du fil. */
export const MAX_PER_RUN = 18;

// Ordre = priorité : le thème le plus précis gagne.
const KEYWORDS: [ActuTheme, RegExp][] = [
  ["espace", /(dans l['’]espace|vers l['’]espace|conquête de l['’]espace|spatial|\bsondes?\b|astronom|astrophys|planète|exoplanète|planète Mars|(sur|vers|autour de) Mars\b|martien|\bLune\b|lunaire|satellite|fusée|galaxie|télescope|trou noir|comète|astéroïde|cosmique|\bNASA\b|\bESA\b|SpaceX|Starship)/i],
  ["cyber", /(cyber|piratage|pirates? informatiques?|hackers?|rançongiciel|ransomware|fuite (de données|géante)|données (personnelles|bancaires) .{0,30}(volées|exposées|dérobées)|vulnérabilité|faille de sécurité|malware|logiciel malveillant|phishing|hameçonnage|\bANSSI\b)/i],
  ["robotique", /(\brobots?\b|robotique|\bdrones?\b|humanoïde|exosquelette)/i],
  ["ia", /(intelligence artificielle|\bIA\b|IA générative|apprentissage (automatique|profond)|réseaux? de neurones|\bLLM\b|ChatGPT|OpenAI|Gemini|Mistral|Anthropic|Claude|machine learning|\bAI\b|agents? IA)/i],
  ["energie", /(énergie|énergétique|nucléaire|solaire|éolien|photovolta|hydrogène|électricité|fusion nucléaire|centrale|géotherm|pétrole|\bgaz\b|batteries? (du futur|sodium|lithium|solides?))/i],
  ["climat", /(climat|réchauffement|El Niño|inondations?|ouragan|cyclone|tempête|biodiversité|environnement|pollution|\bCO2\b|carbone|émissions|océan|glacier|sécheresse|canicule|incendie|déforestation|écolog|espèces? menacées|plastique)/i],
  ["sante", /(santé|médec|médical|maladie|cancer|vaccin|virus|bactéri|patient|hôpital|thérapie|essai clinique|alzheimer|parkinson|diabète|épidém|\bInserm\b|sommeil|obésité|antibio)/i],
  ["physique", /(physique|quantique|particule|\bCERN\b|photon|atome|laser|supraconduct|neutrino|boson|relativité|mathémati)/i],
  ["biologie", /(biologi|espèces? (animale|végétale|menacée|invasive|protégée|disparue|inconnue)|nouvelles? espèces?|animal|animaux|évolution (des espèces|du vivant|humaine)|fossile|dinosaure|\bADN\b|génome|\bgènes?\b|cellule|insecte|plantes?\b|paléonto)/i],
  ["tech", /(smartphone|iPhone|\bAndroid\b|\bApple\b|\bGoogle\b|Microsoft|Samsung|\bNvidia\b|\bIntel\b|\bAMD\b|\bMeta\b|TikTok|WhatsApp|Instagram|Facebook|YouTube|\bRGPD\b|processeur|\bpuces?\b|semi-conducteur|logiciel|\bapplications? (mobile|web)|\bappli\b|navigateur|Windows|Linux|macOS|\biOS\b|open source|\binternet\b|\bfibre\b|\b[56]G\b|\bcloud\b|data ?centers?|centres? de données|ordinateur|\bPC\b|numérique|réseaux? socia(l|ux)|algorithme|développeurs?|programmation|voitures? électriques?|véhicules? autonomes?|réalité (virtuelle|augmentée)|casque (VR|de réalité)|\bécrans?\b (OLED|pliable)|blockchain|\bWi-?Fi\b|Bluetooth|\bUSB\b|impression 3D|start-?ups?)/i],
  ["sciences", /(scientifi|\bsciences?\b|chercheu(r|se)s?|découverte|laboratoire|\bCNRS\b|archéolog|géolog|chimi|mathémati|préhistor|paléo|neuroscien|cerveau|volcan|séisme|météorite|molécul|physicien|biologiste|astronome|prix Nobel|expérience (scientifique|de laboratoire))/i],
];

/** Contenus promotionnels ou hors sujet écartés (bons plans, séries, jeux…). */
const OFF_TOPIC = /(black friday|cyber monday|french days|prime day|bon plan|bons plans|\bpromo|\d+\s?(€|%|euros) de (réduction|remise)|(réduction|remise) (immédiate|exceptionnelle|de \d)|(double|triple) remise|soldes|\bcode promo|vente flash|à saisir|pas cher|moins cher|à prix (cassé|réduit|mini)|économisez|prime video|netflix|disney\+|\bsérie\b|\bfilm\b|meilleures? offres?|\boffres?\b.{0,25}(limitée|spéciale|exceptionnelle|du moment)|\bprix\b.{0,20}(baisse|chute)|jeu vidéo|\bjeux?\b|\bPS5\b|xbox|nintendo|pokémon|\bGTA\b|loto|euromillions|horoscope)/i;

// Publicité déguisée en article (« 50 Go en Thaïlande pour 12,95 € ») : un prix de grande consommation dans le
// titre, un produit à acheter, ou une rubrique commerciale dans l'adresse. Un montant en millions ou en
// milliards (budget d'un télescope, levée de fonds) reste une information.
const RETAIL_PRICE = /\b\d{1,4}(?:[.,]\d{1,2})?\s?(?:€|euros?\b)(?!\s*(?:de\s+)?(?:millions?|milliards?))|-\s?\d{1,2}\s?%/i;
const SHOPPING = /(^\s*test\b[^:]{0,80}:|\bon a testé(?![a-zà-ÿ])|\bprise en main\b|\baspirateurs?\b|\beSIM\b|\bforfaits?\b|\bVPN\b|abonnement (mobile|internet|box)|billets? d'avion|compagnie aérienne|ryanair|easyjet|carte cadeau|idées? cadeaux?|guide d'achat|\bcomparatif\b|quel .{0,30} choisir|notre sélection)/i;
const SPONSORED = /(contenu (sponsorisé|partenaire)|article sponsorisé|publi-?rédactionnel|publi-?reportage)/i;
const SHOPPING_URL = /\/(bons?-plans?|bon-plan|deals?|shopping|promos?|guide-achat|guides?-d-achat|comparatifs?|partenaires?|sponsor[a-z]*|publi[a-z-]*)(\/|-|$)/i;

/** Vrai si l'article est une réclame : il n'entre pas dans le fil. */
export function isPromotional(title: string, summary: string, link = ""): boolean {
  // Le produit à acheter se juge sur le titre (un résumé peut citer un « forfait » sans rien vendre) ; la mention de parrainage, partout.
  if (RETAIL_PRICE.test(title) || SHOPPING.test(title) || SPONSORED.test(`${title} ${summary}`)) return true;
  try {
    return SHOPPING_URL.test(new URL(link).pathname);
  } catch {
    return false;
  }
}

// Politique, société, sport, culture : ce que publient aussi les sources généralistes, et qui n'a pas sa place sur Valyo.
const SOCIETY = /(élections?\b|électora|scrutin|référendum|gouvernement|ministre|président(e|ielle)?\b|parlement|député|sénat|\bpartis? (politique|socialiste|communiste)|socialiste|extrême[- ]droite|\bla (gauche|droite)\b|guerre|conflit armé|diplomat|géopoliti|football|rugby|\bJO\b|jeux olympiques|festival|cinéma|\broman\b|théâtre|religi|immobilier|retraites?\b|impôts?\b|\bgrève|syndicat|justice|procès|tribunal)/i;

/** Un titre en anglais dans un flux francophone (The Conversation mêle parfois ses éditions). */
function looksEnglish(title: string): boolean {
  const english = title.match(/\b(the|and|why|is|are|of|with|should|how|what|we|our|from|that)\b/gi)?.length ?? 0;
  const french = title.match(/\b(le|la|les|des|un|une|et|est|pour|dans|du|au|aux|que|qui|sur|en|ce|ces)\b/gi)?.length ?? 0;
  return english >= 2 && french === 0;
}

/**
 * Le thème d'un article, ou nul s'il n'entre pas dans le fil. `title` sert au filtre des sources
 * généralistes ; par défaut, c'est tout le texte.
 */
export function classify(source: ActuSource, text: string, title = text): ActuTheme | null {
  if (OFF_TOPIC.test(text)) return null;
  if (source.generalist && SOCIETY.test(title)) return null;
  if (source.lang === "fr" && looksEnglish(title)) return null;
  // Source généraliste : c'est le titre qui dit le sujet (un long résumé contient toujours un mot « énergie » ou « espace »).
  const scope = source.generalist ? title : text;
  for (const [theme, re] of KEYWORDS) if (re.test(scope)) return theme;
  return source.generalist ? null : source.fallback;
}
