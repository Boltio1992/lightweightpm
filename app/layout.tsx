import type { Metadata, Viewport } from "next";
import "./globals.css";

// viewport-fit=cover is what makes env(safe-area-inset-bottom) report a real
// value on iOS — without it the bottom tab bar and every .pb-nav page sit
// under the home indicator. interactiveWidget lets the layout viewport shrink
// when the on-screen keyboard opens, so a sheet's action bar stays reachable.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "LightPM",
  description: "A lightweight, modular project management app with Kanban boards, Gantt timelines, task breakdowns, and team collaboration.",
  openGraph: {
    title: "LightPM",
    description: "A lightweight, modular project management app with Kanban boards, Gantt timelines, task breakdowns, and team collaboration.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-[14px] antialiased">{children}</body>
    </html>
  );
}
