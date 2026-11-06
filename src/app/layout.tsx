import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";

import "./globals.css";

/** Schrift aus den Design-Tokens (#119), früh laden statt erst mit dem CSS. */
const FONT_URL = "/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2";

export const metadata: Metadata = {
  applicationName: "Rothenburg Digital",
  title: "Rothenburg Digital – Offene Daten für Rothenburg",
  description:
    "Offene Daten für Rothenburg ob der Tauber – geprüft, ergänzt, anschlussfähig. Barrierefrei aufbereitet, mit einem Chat als Demonstrator.",
  // Alle Icons liegen in public/app-icons und werden hier explizit deklariert.
  // Nicht `icons`: Apache hat unter Plesk den Standard-Alias `/icons/` und
  // liefert dort seine eigenen Symbole statt der App (#89).
  // Achtung: sobald `icons` gesetzt ist, ignoriert Next die Dateikonvention
  // (app/icon.*) — der Favicon muss deshalb mit aufgeführt werden, sonst
  // sucht der Browser nach /favicon.ico und findet nichts.
  icons: {
    icon: [
      { url: "/app-icons/icon.svg", type: "image/svg+xml" },
      { url: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/app-icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Rothenburg",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Zoom NICHT sperren (kein maximumScale/userScalable) — Voraussetzung für
  // WCAG 2.1 SC 1.4.4 (Resize Text).
  width: "device-width",
  initialScale: 1,
  // Wie `--color-brand` und `--color-bg` (dunkel) in public/design/tokens.css;
  // `themeColor` braucht feste Werte, keine CSS-Variablen.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#8b1e3f" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  preload(FONT_URL, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="de">
      <body>
        <a href="#main-content" className="skip-link">
          Zum Hauptinhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
