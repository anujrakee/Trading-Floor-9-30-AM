import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#0B1016",
        panel: "#111922",
        line: "rgba(148, 163, 184, 0.22)",
        mint: "#111111",
        amber: "#111111",
        danger: "#111111",
        ocean: "#111111"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(0, 0, 0, 0.08)",
        bloom: "0 30px 110px rgba(0, 0, 0, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
