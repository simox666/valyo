// Données structurées schema.org (JSON-LD) pour les moteurs de recherche. Le contenu vient
// en partie des membres : `<` est échappé pour qu'un titre ne puisse jamais fermer la balise.
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export const SITE_URL = (process.env.APP_URL || "https://www.valyo.si").replace(/\/$/, "");

/** L'éditeur du site, cité par les pages d'accueil et d'article. */
export const PUBLISHER = {
  "@type": "Organization",
  name: "Valyo",
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon.png` },
};
