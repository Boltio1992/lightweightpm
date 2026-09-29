"use client";

import { useEffect, useState } from "react";
import { applyTheme, readThemeChoice, systemPrefersDark, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { key: ThemeChoice; label: string; path: string }[] = [
  // Light: a sun.
  { key: "light", label: "Light", path: "M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" },
  // Dark: a moon.
  { key: "dark", label: "Dark", path: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" },
  // System: a monitor.
  { key: "system", label: "System", path: "M4 5h16v10H4zM9 19h6M12 15v4" },
];

/**
 * Three-way theme switch. Renders as a segmented control; pass `compact` for
 * the icon-only version used in the mobile top bar.
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  // Read the stored (or system) choice on mount — the <html> class itself is
  // already correct thanks to the pre-paint script.
  useEffect(() => {
    setChoice(readThemeChoice());
  }, []);

  // While on "system", follow the OS if it flips mid-session.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function pick(next: ThemeChoice) {
    setChoice(next);
    applyTheme(next);
  }

  if (compact) {
    // Cycle light → dark → system on tap.
    const next: ThemeChoice = choice === "light" ? "dark" : choice === "dark" ? "system" : "light";
    const current = OPTIONS.find((o) => o.key === choice) ?? OPTIONS[2];
    return (
      <button
        type="button"
        onClick={() => pick(next)}
        className="tap-icon -mr-1 p-2 text-muted transition hover:text-ink"
        title={`Theme: ${current.label} — tap for ${OPTIONS.find((o) => o.key === next)?.label}`}
        aria-label={`Theme: ${current.label}`}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d={current.path} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="seg w-full" role="group" aria-label="Colour theme">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => pick(o.key)}
          aria-pressed={choice === o.key}
          title={`${o.label} theme`}
          className={`seg-item flex-1 gap-1.5 ${choice === o.key ? "seg-item-on" : ""}`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d={o.path} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** True when the resolved theme is dark. Useful for JS-driven colours (charts). */
export function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);
  return isDark;
}

export { systemPrefersDark };
