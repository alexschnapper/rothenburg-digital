import Link from "next/link";

import Chat from "@/components/Chat";
import ExternalLink from "@/components/ExternalLink";
import LegalFooter from "@/components/LegalFooter";
import { flags } from "@/lib/flags";
import { LlmConfigError, llmConfig } from "@/lib/llm/provider";
import { WEBCAM_URL } from "@/lib/webcam";

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
 * Kachel zu einer Seite aus den offenen Daten der Stadt (#44).
 *
 * Ersetzt die rein darstellenden Schwerpunkt-Kacheln (Inklusion, Sensorik &
 * Klima, Open Data aus #24): Hier stehen nur Bereiche, hinter denen schon
 * etwas Nutzbares liegt. Die Schwerpunkte bleiben auf der Teaserseite
 * (public/teaser.html) und kommen zurück, sobald es dazu eigene Seiten gibt.
 * Ohne Icon-Library, das Emoji ist nur Schmuck (`aria-hidden`).
 */
function DataTile({
  href,
  icon,
  label,
  hint,
  external = false,
}: {
  href: string;
  icon: string;
  label: string;
  hint: string;
  /** Fremde Seite (z. B. die Webcam der Stadt, #71): öffnet in neuem Tab. */
  external?: boolean;
}) {
  const className =
    "flex h-full items-center gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-4 py-3 transition-colors hover:border-brand";
  const content = (
    <>
      <span aria-hidden="true" className="text-2xl">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-bold sm:text-base">{label}</span>
        <span className="text-xs opacity-80 sm:text-sm">{hint}</span>
      </span>
    </>
  );
  return (
    <li>
      {external ? (
        <ExternalLink href={href} className={className}>
          {content}
        </ExternalLink>
      ) : (
        <Link href={href} className={className}>
          {content}
        </Link>
      )}
    </li>
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
              In Entwicklung &bull; Frühjahr 2027
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Rothenburg Digital
            </h1>
          </div>
        </div>
        <p className="text-base font-bold text-brand dark:text-[color:var(--color-focus)] sm:text-lg">
          Offene Daten für Rothenburg ob der Tauber – geprüft, ergänzt,
          anschlussfähig.
        </p>
        <p className="text-sm opacity-80 sm:text-base">
          Ein Proof of Concept des OK Lab Rothenburg. Es prüft die offenen
          Daten der Stadt regelmäßig, bereitet sie verständlich auf und macht
          sichtbar, wo die Datenbasis noch Lücken hat.
        </p>
      </header>

      <main id="main-content" className="flex flex-1 flex-col gap-8">
        <section aria-labelledby="daten-heading" className="flex flex-col gap-3">
          <h2 id="daten-heading" className="text-lg font-bold">
            Offene Daten der Stadt
          </h2>
          {/* Seiten aus den offenen Daten der Stadt (Issue #44: #6, #27, #61, #62), dazu die Webcam der Stadt (#71). Die Datenqualität (#80) steht vorn. */}
          <nav aria-label="Offene Daten">
            <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <DataTile
                href="/daten"
                icon="📊"
                label="Datenqualität"
                hint="Wie gut sind die offenen Daten? Wöchentlich geprüft"
              />
              <DataTile
                href="/parken"
                icon="🅿️"
                label="Parken & E-Laden"
                hint="Parkplätze und Ladesäulen auf einen Blick"
              />
              <DataTile
                href="/essen-trinken"
                icon="🍽️"
                label="Essen & Trinken"
                hint="Restaurants und Cafés – wer gerade geöffnet hat"
              />
              <DataTile
                href="/einkaufen"
                icon="🛍️"
                label="Einkaufen"
                hint="Geschäfte, Souvenirs und Regionales"
              />
              <DataTile
                href="/sehenswuerdigkeiten"
                icon="🏰"
                label="Sehenswürdigkeiten"
                hint="Türme, Tore, Plätze und Museen"
              />
              <DataTile
                href="/notfall-hitze"
                icon="🩺"
                label="Notfall & Hitze"
                hint="Defibrillatoren, Trinkbrunnen, kühle Orte"
              />
              <DataTile
                href={WEBCAM_URL}
                icon="📷"
                label="Webcam Marktplatz"
                hint="Aktuelles Bild der Stadt, auf rothenburg.de"
                external
              />
            </ul>
          </nav>
        </section>

        {/* Der Chat ist Demonstrator, nicht Hauptsache (#82): eingeklappt, damit
            die Datenseiten vorn stehen. Natives <details> statt eigenem Knopf:
            ohne JavaScript bedienbar, Screenreader melden auf- und zugeklappt
            von selbst. Zugeklappt bleibt der Chat im DOM, der Verlauf geht
            also nicht verloren. */}
        <details
          id="chat"
          className="group rounded-lg border border-[color:var(--color-border)] open:border-brand"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 hover:bg-[color:var(--color-muted)] [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="text-2xl">
              💬
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-sm font-bold sm:text-base">
                Demonstrator: Fragen an die offenen Daten
              </span>
              <span className="text-xs opacity-80 sm:text-sm">
                Ein KI-Chat zeigt, wie sich geprüfte Daten verständlich abfragen
                lassen – mit Quelle zu jeder Angabe.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-lg transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <PrivacyNotice provider={providerNotice()} />
            <Chat />
          </div>
        </details>
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
