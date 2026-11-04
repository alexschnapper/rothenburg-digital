import Link from "next/link";

import type { HttpStatusInfo } from "@/lib/httpStatus";

/**
 * Gemeinsamer Aufbau aller Fehlerseiten (Issue #54): Code groß, deutsche
 * Bezeichnung, Erklärung in einfacher Sprache, Wege zurück.
 *
 * Ohne Server-Importe, damit auch `error.tsx` (Client Component) sie nutzen
 * kann. Was je Seite dazukommt — Fakt des Tages, „Erneut versuchen" — kommt
 * über `children`.
 */
export default function StatusView({
  status,
  children,
}: {
  status: HttpStatusInfo;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <main id="main-content" className="flex flex-1 flex-col gap-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/rothenburg_digital.svg"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-xl"
          />
          <p className="text-sm font-bold uppercase tracking-wide text-brand dark:text-[color:var(--color-focus)]">
            Rothenburg Digital
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p
            className="text-6xl font-extrabold tabular-nums text-brand dark:text-[color:var(--color-focus)] sm:text-7xl"
            aria-hidden="true"
          >
            {status.code}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            <span className="sr-only">Fehler {status.code}: </span>
            {status.name}
          </h1>
          <p className="text-base opacity-80">{status.explanation}</p>
        </div>

        {children}

        <nav aria-label="Weiter" className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/"
            className="rounded-md bg-brand px-4 py-2 font-medium text-white underline-offset-2 hover:underline"
          >
            Zur Startseite und zum Chat
          </Link>
          <Link href="/parken" className="px-1 py-2 underline">
            Parken &amp; E-Laden
          </Link>
          <Link href="/essen-trinken" className="px-1 py-2 underline">
            Essen &amp; Trinken
          </Link>
        </nav>
      </main>

      <footer className="border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        Fehlercode {status.code} ({status.name}) ·{" "}
        <a
          href="https://de.wikipedia.org/wiki/HTTP-Statuscode"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Was bedeuten HTTP-Statuscodes?
          <span className="sr-only"> (öffnet in neuem Tab)</span>
        </a>
      </footer>
    </div>
  );
}
