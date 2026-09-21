import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LightPM",
  description: "A lightweight, modular project management app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-[14px] antialiased">{children}</body>
    </html>
  );
}
