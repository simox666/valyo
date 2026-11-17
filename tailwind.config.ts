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
        chip: "#EEEEE8",
        muted: "#5F6873",
        soft: "#46505C",
      },
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
