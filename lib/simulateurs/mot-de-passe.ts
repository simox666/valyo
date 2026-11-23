// Casser un mot de passe : combien d'essais faut-il, au pire, pour le trouver en essayant toutes les combinaisons ?
// Le calcul se fait dans le navigateur : le mot de passe saisi n'est ni envoyé ni enregistré.

/** Quelques-uns des mots de passe les plus répandus : un attaquant les essaie avant tout le reste. */
const COMMON = new Set([
  "123456", "123456789", "12345678", "12345", "1234567", "1234567890", "111111", "000000", "123123", "654321",
  "password", "password1", "qwerty", "azerty", "azertyuiop", "qwertyuiop", "abc123", "iloveyou", "admin", "welcome",
  "motdepasse", "bonjour", "soleil", "doudou", "loulou", "chocolat", "marseille", "jetaime", "nicolas", "camille",
  "letmein", "monkey", "dragon", "football", "princesse", "secret", "azerty123", "password123", "admin123", "root",
]);

export const ATTACKERS = [
  { name: "En ligne, sur un site qui limite les essais", detail: "10 essais par seconde", rate: 10 },
  { name: "Base de données volée, un seul ordinateur de jeu", detail: "10 milliards d’essais par seconde", rate: 1e10 },
  { name: "Base de données volée, groupe très équipé", detail: "mille milliards d’essais par seconde", rate: 1e12 },
] as const;

export function analyse(password: string) {
  const chars = [...password];
  const has = { lower: /[a-z]/.test(password), upper: /[A-Z]/.test(password), digit: /\d/.test(password), symbol: /[^\p{L}\p{N}]/u.test(password), other: /[^\x00-\x7F]/.test(password) };
  const pool = (has.lower ? 26 : 0) + (has.upper ? 26 : 0) + (has.digit ? 10 : 0) + (has.symbol ? 33 : 0) + (has.other ? 100 : 0);
  // log10 du nombre de combinaisons : les nombres eux-mêmes dépassent vite ce qu'un ordinateur sait écrire.
  const log10 = chars.length && pool ? chars.length * Math.log10(pool) : 0;
  const common = COMMON.has(password.toLowerCase());
  const warnings: string[] = [];
  if (common) warnings.push("Il figure dans les listes des mots de passe les plus utilisés : il serait trouvé immédiatement, quelle que soit sa longueur.");
  if (chars.length > 0 && chars.length < 12) warnings.push("Moins de 12 caractères : la longueur compte bien plus que les caractères spéciaux.");
  if (/^\d+$/.test(password)) warnings.push("Uniquement des chiffres : très peu de combinaisons.");
  if (/(.)\1{2,}/.test(password)) warnings.push("Des caractères répétés : un motif que les outils d’attaque essaient tôt.");
  if (/^\p{L}+\d{1,4}\W*$/u.test(password)) warnings.push("Un mot suivi de quelques chiffres : c’est le motif le plus courant, essayé bien avant la force brute. Le délai réel est beaucoup plus court.");
  if (/(19|20)\d\d/.test(password)) warnings.push("Une année : les dates de naissance sont parmi les premières choses essayées.");
  return { length: chars.length, pool, log10, common, warnings };
}

/** Temps moyen pour le trouver (la moitié des combinaisons), en secondes, exprimé en log10. */
export const crackLog10Seconds = (log10Combos: number, rate: number) => log10Combos - Math.log10(2) - Math.log10(rate);

const YEAR = 365.25 * 24 * 3600;
export function formatDuration(log10Seconds: number, instant = false) {
  if (instant || log10Seconds < 0) return "instantané";
  const seconds = 10 ** Math.min(log10Seconds, 300);
  const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: n < 10 ? 1 : 0 });
  if (seconds < 60) return `${fr(seconds)} seconde${seconds >= 2 ? "s" : ""}`;
  if (seconds < 3600) return `${fr(seconds / 60)} minutes`;
  if (seconds < 86400) return `${fr(seconds / 3600)} heures`;
  if (seconds < YEAR) return `${fr(seconds / 86400)} jours`;
  const years = seconds / YEAR;
  if (years < 1e3) return `${fr(years)} ans`;
  if (years < 1e6) return `${fr(years / 1e3)} milliers d’années`;
  if (years < 1e9) return `${fr(years / 1e6)} millions d’années`;
  if (years < 1.38e10) return `${fr(years / 1e9)} milliards d’années`;
  return "plus que l’âge de l’Univers";
}
