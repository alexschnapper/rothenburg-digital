import Link from "next/link";
import type { ReactNode } from "react";

import LegalFooter from "@/components/LegalFooter";

/**
 * Seitenrahmen für alle Inhaltsseiten (#94): Breite, Abstände, Kopf, Footer
 * und Druckansicht an einer Stelle, damit die Seiten nicht auseinanderlaufen.
 *
 * Desktop zuerst wie `/daten` (#84): Der Rahmen ist breit, Fließtext bleibt
 * mit `PROSE` schmal (WCAG 1.4.8: höchstens 80 Zeichen pro Zeile). Breit
 * werden nur Karten, Kacheln und Tabellen. `width="narrow"` für reine
 * Textseiten.
 */

/** Fließtext und Infokästen: nie breiter als eine gut lesbare Zeile. */
export const PROSE = "max-w-3xl";

/**
 * Kartenlisten: eine Spalte auf dem Handy, zwei ab Tablet, drei auf dem
 * Desktop. `grid-cols-1` statt der impliziten Spalte, die mit langen Wörtern
 * (URLs in Befunden) über den Bildschirm hinauswüchse (WCAG 1.4.10); lange
 * Wörter brechen um. Im Druck bricht keine Karte über zwei Seiten.
 */
export const CARD_GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>li]:break-words [&>li]:break-inside-avoid";

/** Kartenliste in einer Hälfte von `SIDE_BY_SIDE`: höchstens zwei Spalten. */
export const CARD_GRID_HALF =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 [&>li]:break-words [&>li]:break-inside-avoid";

/**
 * Zwei Bereiche nebeneinander ab Desktop (Parken | E-Laden, Defibrillatoren |
 * Hitze). Die Reihenfolge im DOM bleibt die Lesereihenfolge.
 */
export const SIDE_BY_SIDE =
  "grid grid-cols-1 gap-8 xl:grid-cols-2 xl:items-start print:block print:space-y-8";

type Props = {
  /** Überschrift der Seite; entfällt, wenn `header` gesetzt ist. */
  title?: ReactNode;
  intro?: ReactNode;
  /** Eigener Kopf statt Zurück-Link, Überschrift und Einleitung (Startseite). */
  header?: ReactNode;
  /** Zusätzliche Zeilen im Footer unter den rechtlichen Links. */
  footer?: ReactNode;
  width?: "wide" | "narrow";
  children: ReactNode;
};

export default function PageShell({ title, intro, header, footer, width = "wide", children }: Props) {
  const frame = width === "wide" ? "max-w-screen-2xl lg:px-8" : "max-w-3xl";
  return (
    <div
      className={`mx-auto flex min-h-screen w-full flex-col gap-6 px-4 py-8 ${frame} print:max-w-none print:p-0`}
    >
      {header ?? (
        <header className={`flex ${PROSE} flex-col gap-2`}>
          <Link href="/" className="text-sm underline opacity-80 print:hidden">
            &larr; Zur Startseite
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {intro && <p className="text-sm opacity-80 sm:text-base">{intro}</p>}
        </header>
      )}

      <main id="main-content" className="flex flex-1 flex-col gap-8">
        {children}
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm print:hidden">
        <LegalFooter />
        {footer}
      </footer>
    </div>
  );
}
