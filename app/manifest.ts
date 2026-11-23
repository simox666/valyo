import type { MetadataRoute } from "next";

// Manifeste d'application : permet d'ajouter Valyo à l'écran d'accueil. Sur iPhone, c'est
// la condition pour recevoir les notifications push (Safari ne les autorise qu'ainsi).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Valyo",
    short_name: "Valyo",
    description: "Le réseau social des passionnés d’IA, d’espace, de sciences et de technologie.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF9F6",
    theme_color: "#1C4F3C",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
