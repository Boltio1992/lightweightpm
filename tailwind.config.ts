import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#37352f",
        muted: "#787774",
        line: "#eaeaea",
        canvas: "#ffffff",
        subtle: "#f7f7f5",
        surface: "#ffffff",
        surfaceMuted: "#fbfbfa",
        accent: "#2f80ed",
        accentSoft: "#eef5ff",
        danger: "#eb5757",
        dangerSoft: "#fff2f2",
        warn: "#f2994a",
        warnSoft: "#fff5ea",
        good: "#219653",
        goodSoft: "#edf9f2",
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
