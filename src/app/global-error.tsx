"use client";

import Link from "next/link";

/**
 * Letzte Rückfallebene, wenn selbst das Root-Layout scheitert (Issue #54).
 * Ersetzt das Layout komplett, deshalb eigenes `<html>`/`<body>` und Stile
 * inline — `globals.css` steht hier nicht zur Verfügung.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: "36rem",
          margin: "0 auto",
          padding: "2rem 1rem",
          lineHeight: 1.5,
        }}
      >
        <title>Fehler – Rothenburg Digital</title>
        <p style={{ fontSize: "3.5rem", fontWeight: 800, color: "#8B1E3F", margin: 0 }}>500</p>
        <h1 style={{ fontSize: "1.5rem", margin: "0.5rem 0" }}>Interner Serverfehler</h1>
        <p>Auf unserer Seite ist etwas schiefgelaufen. Das liegt nicht an Ihnen.</p>
        <p>
          <button type="button" onClick={() => retry()} style={{ padding: "0.5rem 1rem" }}>
            Erneut versuchen
          </button>{" "}
          <Link href="/">Zur Startseite</Link>
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            Fehlerkennung für Rückfragen: <code>{error.digest}</code>
          </p>
        )}
      </body>
    </html>
  );
}
