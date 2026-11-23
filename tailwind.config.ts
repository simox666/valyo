import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Direction « Carnet de labo » (maquette G) : papier millimétré, encre bleu nuit, accent orange.
      colors: {
        ink: "#1B2430",
        paper: "#F7F7F3",
        accent: "#C2410C",
        "accent-soft": "#FBEEE6",
        line: "#DEDED6",
        "line-strong": "#C9C9C0",
        hairline: "#ECECE5",
        "accent-dark": "#9A3412",
        "accent-line": "#F3D9C8",
        cream: "#FBF7F2",
        body: "#2E3742",
        "on-ink": "#C9CED6",
        success: "#15803D",
        "success-soft": "#F0FAF2",
        "success-line": "#BBE3C4",
        chip: "#EEEEE8",
        muted: "#5F6873",
        soft: "#46505C",
      },
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
