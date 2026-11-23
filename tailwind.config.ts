import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Direction « Carnet de labo » (maquette G) : papier millimétré, encre bleu nuit, accent orange.
      // Les teintes vivent dans app/globals.css (variables --c-*), avec une version claire et une version sombre.
      colors: {
        ink: v("ink"),
        paper: v("paper"),
        accent: v("accent"),
        "accent-soft": v("accent-soft"),
        "accent-dark": v("accent-dark"),
        "accent-line": v("accent-line"),
        line: v("line"),
        "line-strong": v("line-strong"),
        hairline: v("hairline"),
        chip: v("chip"),
        muted: v("muted"),
        soft: v("soft"),
        body: v("body"),
        cream: v("cream"),
        "on-ink": v("on-ink"),
        success: v("success"),
        "success-soft": v("success-soft"),
        "success-line": v("success-line"),
        red: { 50: v("red-50"), 100: v("red-100"), 200: v("red-200"), 700: v("red-700"), 800: v("red-800") },
        amber: { 50: v("amber-50"), 100: v("amber-100"), 300: v("amber-300"), 800: v("amber-800"), 900: v("amber-900") },
      },
      // Fonds : « blanc » est la surface des cartes ; l'encre et l'accent en aplat gardent un fond sombre/orange sous du texte blanc.
      backgroundColor: { white: v("surface"), ink: v("ink-bg"), accent: v("accent-bg") },
      // Trois arrondis seulement : md (petits contrôles), lg (boutons, champs), card (cartes, encarts) ; full pour les pastilles.
      borderRadius: { card: "10px" },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
