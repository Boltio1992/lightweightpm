/* Theme handling. The class goes on <html>; everything else follows from the CSS
   variables redefined under `.dark` in app/globals.css. */

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_KEY = "lightpm:theme";

/** Script string injected before first paint so a reload never flashes. */
export const THEME_INIT_SCRIPT = `try{var s=localStorage.getItem('${THEME_KEY}')||'system';var d=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}`;

export function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* private mode */
  }
  return "system";
}

export function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies a choice to <html> and persists it. Returns the resolved is-dark. */
export function applyTheme(choice: ThemeChoice) {
  const isDark = choice === "dark" || (choice === "system" && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode — the theme just won't persist */
  }
  return isDark;
}
