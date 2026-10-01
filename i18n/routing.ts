import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "nl", "es"],
  defaultLocale: "fr",
  // French keeps unprefixed URLs (the site's existing links stay valid);
  // other locales get a /en, /nl, /es prefix.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
