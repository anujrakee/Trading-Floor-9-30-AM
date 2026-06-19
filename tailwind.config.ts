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
        mint: "#00D19A",
        amber: "#F6C84C",
        danger: "#FF5B6E",
        ocean: "#1C8BFF"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(0, 209, 154, 0.15)",
        bloom: "0 30px 110px rgba(28, 139, 255, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
