import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  // Theme is driven by a class on <html> so the choice survives a hard reload
  // and can be applied before first paint (see app/layout.tsx).
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Every entry points at a CSS variable in app/globals.css, which is
        // redefined under `.dark`. That keeps `bg-surface` / `text-ink` working
        // unchanged in components while the theme flips. Light values are the
        // WCAG-AA set — keep the two definitions in sync.
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        canvas: "var(--color-canvas)",
        subtle: "var(--color-subtle)",
        surface: "var(--color-surface)",
        surfaceMuted: "var(--color-surface-muted)",
        accent: "var(--color-accent)",
        accentSoft: "var(--color-accent-soft)",
        danger: "var(--color-danger)",
        dangerSoft: "var(--color-danger-soft)",
        warn: "var(--color-warn)",
        warnSoft: "var(--color-warn-soft)",
        good: "var(--color-good)",
        goodSoft: "var(--color-good-soft)",
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
