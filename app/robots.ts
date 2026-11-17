import type { MetadataRoute } from "next";

// Périmètre déclaré aux robots (audit SEO du 17 novembre) : le contenu public est
// explorable, les espaces de compte et les parcours de connexion ne le sont pas.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL || "https://www.valyo.si";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/", "/admin/", "/parametres", "/messages", "/notifications", "/a-creuser",
          "/connexion", "/bienvenue", "/rejoindre/", "/inviter", "/publier", "/avis",
          "/sanctions", "/contestation", "/media/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
