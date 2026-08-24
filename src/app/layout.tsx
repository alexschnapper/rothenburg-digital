import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Rothenburg Digital",
  title: "Rothenburg Digital – Chat-Portal",
  description:
    "Barrierefreies Chat-Portal für die Rothenburger Bürgerinnen und Bürger.",
  // Alle Icons liegen in public/icons und werden hier explizit deklariert.
  // Achtung: sobald `icons` gesetzt ist, ignoriert Next die Dateikonvention
  // (app/icon.*) — der Favicon muss deshalb mit aufgeführt werden, sonst
  // sucht der Browser nach /favicon.ico und findet nichts.
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
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
