import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14161A",
        paper: "#FAFAF8",
      },
    },
  },
  plugins: [],
};

export default config;
