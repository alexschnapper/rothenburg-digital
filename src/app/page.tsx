import Link from "next/link";

import Chat from "@/components/Chat";
import LegalFooter from "@/components/LegalFooter";
import { flags } from "@/lib/flags";
import { LlmConfigError, llmConfig } from "@/lib/llm/provider";

// Ohne dynamische Request-APIs würde Next diese Seite zur Build-Zeit
// statisch vorrendern — dann bliebe der Anbieter-Hinweis (#18) nach einem
// reinen `LLM_PROVIDER`-Wechsel + Neustart (laut docs/DEPLOYMENT.md kein
// Rebuild nötig) auf dem alten Anbieter stehen, obwohl /api/chat längst den
// neuen benutzt. `force-dynamic` erzwingt Server-Rendering pro Anfrage.
export const dynamic = "force-dynamic";

/**
 * Anbieter und Verarbeitungsort für den Datenschutzhinweis (#18).
 *
 * Aus `llmConfig()` statt fest im Text: nach einem Providerwechsel (#12,
 * `LLM_PROVIDER`) ändert sich die Aussage automatisch mit, ohne dass hier
 * etwas angepasst werden muss. Ein Konfigurationsfehler soll die Seite nicht
 * zum Absturz bringen — `/api/chat` meldet ihn ohnehin beim ersten
 * Chat-Versuch.
 */
function providerNotice(): { label: string; dataRegion: string } | null {
  try {
    const llm = llmConfig();
    return { label: llm.label, dataRegion: llm.dataRegion };
  } catch (error) {
    if (!(error instanceof LlmConfigError)) throw error;
    return null;
  }
}

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

/**
 * Dauerhaft sichtbarer Datenschutz- und Verlässlichkeitshinweis (#18).
 *
 * Bewusst kein wegklickbares Banner — die Aussage muss bei jedem Besuch
 * stehen, nicht nur einmal. Direkt vor dem Chat, damit sie im Screenreader
 * vor dem Eingabefeld erreichbar ist.
 */
function PrivacyNotice({
  provider,
}: {
  provider: { label: string; dataRegion: string } | null;
}) {
  return (
    <p className="rounded-lg border border-[color:var(--color-border)] border-l-4 border-l-brand bg-[color:var(--color-muted)] px-4 py-3 text-sm">
      {provider ? (
        <>
          Ihre Eingaben werden zur Beantwortung an {provider.label} übermittelt
          (Verarbeitungsort: {provider.dataRegion}).{" "}
        </>
      ) : (
        "Ihre Eingaben werden zur Beantwortung an einen externen KI-Anbieter übermittelt. "
      )}
      Geben Sie <strong>keine personenbezogenen Daten</strong> ein (z.&nbsp;B.
      Namen, Adresse, Gesundheitsangaben). Antworten können Fehler enthalten
      – verbindlich ist die Auskunft der Stadt.{" "}
      <Link href="/datenschutz" className="whitespace-nowrap font-medium underline">
        Mehr zum Datenschutz
      </Link>
      .
    </p>
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

      <main id="main-content" className="flex flex-1 flex-col gap-4">
        <PrivacyNotice provider={providerNotice()} />
        <Chat />
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        <LegalFooter />
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
