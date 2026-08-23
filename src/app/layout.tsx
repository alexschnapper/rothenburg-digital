import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rothenburg Digital – Chat-Portal",
  description:
    "Barrierefreies Chat-Portal für die Rothenburger Bürgerinnen und Bürger.",
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
