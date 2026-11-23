import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { IconSprite } from "@/components/Icon";
import "./globals.css";

// Polices embarquées : le build de déploiement ne dépend pas de Google Fonts.
const inter = localFont({ src: "./fonts/Inter-Variable.woff2", weight: "100 900", style: "normal", display: "swap", variable: "--font-sans" });
const interTight = localFont({ src: "./fonts/InterTight-Variable.woff2", weight: "100 900", style: "normal", display: "swap", variable: "--font-display" });
const martian = localFont({ src: "./fonts/MartianMono-Variable.woff2", weight: "100 800", style: "normal", display: "swap", variable: "--font-mono" });

const SITE_DESCRIPTION =
  "Découvrez les avancées en IA, technologie et sciences, comprenez ce qu’elles changent et discutez-en avec d’autres passionnés.";

export const metadata: Metadata = {
  // Adresse publique (ex. https://valyo.si) : aperçus de liens partagés corrects.
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "Valyo — les nouvelles tech et science, et ceux qui en parlent", template: "%s · Valyo" },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: "Valyo",
    locale: "fr_BE",
    type: "website",
    // Pas de titre ni de description ici : chaque page transmet les siens à son aperçu de
    // lien (une valeur fixée à la racine s'imposait à /jeux, /recap, /salons, aux thèmes…).
    // Carte de partage par défaut (public/partage.png) ; les articles la remplacent par la leur.
    images: ["/partage.png"],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${interTight.variable} ${martian.variable} min-h-screen bg-paper font-sans text-ink antialiased`}>
        <IconSprite />
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-20 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
          Aller au contenu
        </a>
        <div className="mx-auto max-w-[1920px] lg:flex lg:items-start lg:gap-8 lg:px-6 xl:gap-10">
          <Header />
          <div className="min-w-0 flex-1">
            <main id="contenu" tabIndex={-1} className="px-4 py-5 lg:px-0 lg:py-7">
              {children}
            </main>
            <footer className="px-4 pb-24 pt-4 text-xs text-muted lg:px-0 lg:pb-10">
              <nav aria-label="Liens de bas de page" className="flex flex-wrap gap-x-4 gap-y-1">
                <Link href="/regles" className="hover:underline">Règles de la communauté</Link>
                <Link href="/avis" className="hover:underline">Votre avis (bêta)</Link>
                <Link href="/confidentialite" className="hover:underline">Confidentialité</Link>
              </nav>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
