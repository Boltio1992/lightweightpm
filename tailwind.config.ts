import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Semantic colours are tuned for WCAG AA: every value below clears 4.5:1
        // against white AND against its own soft background. Don't lighten them.
        ink: "#37352f",
        muted: "#6b6b66",
        line: "#e6e4df",
        canvas: "#ffffff",
        subtle: "#f7f7f5",
        surface: "#ffffff",
        surfaceMuted: "#fbfbfa",
        accent: "#185fa5",
        accentSoft: "#e6f1fb",
        danger: "#c0392b",
        dangerSoft: "#fcebeb",
        warn: "#854f0b",
        warnSoft: "#faeeda",
        good: "#3b6d11",
        goodSoft: "#eaf3de",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06)",
        pop: "0 4px 16px rgba(0,0,0,0.12)",
        soft: "0 2px 10px rgba(12, 12, 13, 0.06)",
      },
      borderRadius: {
        md: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
