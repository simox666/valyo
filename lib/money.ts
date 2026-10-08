// Intl.NumberFormat needs a BCP-47 tag, not the app's short locale code.
const NUMBER_LOCALE: Record<string, string> = {
  fr: "fr-FR",
  en: "en-US",
  nl: "nl-NL",
  es: "es-ES",
};

export function formatMoney(n: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(NUMBER_LOCALE[locale] ?? "en-US", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}
