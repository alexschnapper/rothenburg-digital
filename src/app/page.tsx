import Chat from "@/components/Chat";
import { flags } from "@/lib/flags";

/**
 * Kurze Schwerpunkt-Kachel zwischen Header und Chat.
 *
 * Bewusst statisch und ohne Icon-Library: hier stehen dieselben vier
 * Schwerpunkte wie auf der PROD-Teaserseite (public/teaser.html), damit
 * Chat-Portal und Vorabseite optisch zusammengehören (#24). Später sollen
 * hier konkrete Hinweise aus Chat-Antworten stehen (Sightseeing, Events,
 * Luftdaten) — das ist bewusst noch nicht Teil dieser Änderung.
 */
function InfoBox({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-2 py-3 text-center">
      <span aria-hidden="true" className="text-xl">
        {icon}
      </span>
      <span className="text-xs font-medium sm:text-sm">{label}</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {/* Statisches lokales SVG-Logo — next/image würde hier
              `images.dangerouslyAllowSVG` in next.config voraussetzen. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/rothenburg_digital.svg"
            alt="Rothenburg.digital Wappen-Logo mit Stadttor und Signalpunkt"
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-xl"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand dark:text-[color:var(--color-focus)]">
              In Entwicklung &bull; Herbst 2026
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Rothenburg Digital
            </h1>
          </div>
        </div>
        <p className="text-base font-bold text-brand dark:text-[color:var(--color-focus)] sm:text-lg">
          Vom Marktplatz bis ins Taubertal – dein smarter Stadtbegleiter.
        </p>
        <p className="text-sm opacity-80 sm:text-base">
          Barrierefreies Chat-Portal – Fragen Sie, was Sie über die Stadt
          wissen möchten.
        </p>
      </header>

      <div
        className="grid grid-cols-3 gap-2 sm:gap-3"
        aria-label="Schwerpunkte von Rothenburg Digital"
      >
        <InfoBox icon="♿" label="Barrierefrei" />
        <InfoBox icon="🌍" label="Mehrsprachig" />
        <InfoBox icon="🌿" label="Smart City" />
      </div>

      <main id="main-content" className="flex flex-1 flex-col">
        <Chat />
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        <p>
          Eine unabhängige Open-Source-Initiative, entwickelt von Alexander
          Schnapper. Kein offizielles Angebot der Stadt Rothenburg ob der
          Tauber oder des Rothenburg Tourismus Service (RTS).
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Lizenziert unter{" "}
            <a
              href="https://github.com/alexschnapper/rothenburg-digital/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              GNU GPLv3
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>{" "}
            &bull; 2026
          </span>
          <nav aria-label="Rechtliche Hinweise" className="flex gap-2">
            <a
              href="https://alexander-schnapper.de/impressum"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Impressum
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
            <span aria-hidden="true">&bull;</span>
            <a
              href="https://alexander-schnapper.de/datenschutz"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Datenschutz
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
          </nav>
        </div>
        <p className="opacity-60">
          Aktive Module:{" "}
          {Object.entries(flags)
            .filter(([, enabled]) => enabled)
            .map(([name]) => name)
            .join(", ") || "nur Basis-Chat"}
        </p>
      </footer>
    </div>
  );
}
