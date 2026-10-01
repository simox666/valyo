import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valyo — Combien ça vaut ?",
  description: "Prenez une photo, obtenez une estimation de la valeur de vos objets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
