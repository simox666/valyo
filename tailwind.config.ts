import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16161A",
        paper: "#FAF9F6",
        accent: "#1C4F3C",
        line: "#E4E2DC",
        chip: "#F0EEE8",
      },
    },
  },
  plugins: [],
};

export default config;
