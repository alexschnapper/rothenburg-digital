import type { Metadata } from "next";
import Link from "next/link";

import LegalFooter from "@/components/LegalFooter";
import { LlmConfigError, llmConfig } from "@/lib/llm/provider";

export const metadata: Metadata = {
  title: "Datenschutz – Rothenburg Digital",
  description:
    "Wie der Chat-Assistent von Rothenburg Digital mit Ihren Eingaben umgeht.",
};

// Siehe Begründung in src/app/page.tsx — dieselbe Anbieter-Angabe, dasselbe
// Problem ohne force-dynamic.
export const dynamic = "force-dynamic";

/** Siehe dieselbe Herleitung in src/app/page.tsx (#18). */
function providerInfo(): { label: string; dataRegion: string } | null {
  try {
    const llm = llmConfig();
    return { label: llm.label, dataRegion: llm.dataRegion };
  } catch (error) {
    if (!(error instanceof LlmConfigError)) throw error;
    return null;
  }
}

export default function DatenschutzPage() {
  const provider = providerInfo();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline opacity-80">
          &larr; Zurück zum Chat
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Datenschutz beim Chat
        </h1>
        <p className="text-sm opacity-80 sm:text-base">
          Diese Seite beschreibt, was mit Ihren Eingaben im Chat-Portal
          passiert — technisch und konkret, nicht als allgemeine
          Datenschutzerklärung. Für Anbieterkennzeichnung und rechtliche
          Verantwortlichkeit siehe das{" "}
          <a
            href="https://alexander-schnapper.de/impressum"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Impressum
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>
          .
        </p>
      </header>

      <main id="main-content" className="flex flex-col gap-6 text-sm sm:text-base">
        <section aria-labelledby="anbieter-heading" className="flex flex-col gap-2">
          <h2 id="anbieter-heading" className="text-lg font-bold">
            Anbieter und Verarbeitungsort
          </h2>
          {provider ? (
            <p>
              Ihre Chat-Eingaben werden zur Erzeugung einer Antwort an{" "}
              <strong>{provider.label}</strong> übermittelt. Verarbeitungsort:{" "}
              {provider.dataRegion}. Welcher Anbieter aktiv ist, kann sich je
              nach Umgebung (Entwicklung, Vorschau, Live-Betrieb) unterscheiden
              — diese Seite zeigt immer den Anbieter der Umgebung, die Sie
              gerade nutzen.
            </p>
          ) : (
            <p>
              Der aktuell konfigurierte Anbieter konnte nicht ermittelt
              werden. Der Chat ist in diesem Fall ohnehin nicht nutzbar; bitte
              versuchen Sie es später erneut.
            </p>
          )}
        </section>

        <section aria-labelledby="zweck-heading" className="flex flex-col gap-2">
          <h2 id="zweck-heading" className="text-lg font-bold">
            Wozu Ihre Eingaben verwendet werden
          </h2>
          <p>
            Der Text, den Sie ins Eingabefeld schreiben, geht ausschließlich
            an den oben genannten Anbieter und ausschließlich, um eine
            Antwort auf Ihre Frage zu erzeugen. Es gibt keine weitere
            Verwendung durch dieses Projekt.
          </p>
          <p>
            Geben Sie bitte <strong>keine personenbezogenen Daten</strong> ein
            — etwa Ihren Namen, Ihre Adresse oder Angaben zu Ihrer Gesundheit.
            Für Fragen, bei denen das nötig ist (z.&nbsp;B. ein konkreter
            Antrag), wenden Sie sich direkt an die zuständige Stelle der
            Stadt.
          </p>
        </section>

        <section aria-labelledby="speicherung-heading" className="flex flex-col gap-2">
          <h2 id="speicherung-heading" className="text-lg font-bold">
            Speicherung des Gesprächsverlaufs
          </h2>
          <p>
            Der Server speichert Ihren Gesprächsverlauf nicht. Jede Anfrage an
            den Anbieter enthält nur den Verlauf, den Ihr Browser im aktuellen
            Tab mitschickt — schließen Sie den Tab oder laden Sie die Seite
            neu, ist der Verlauf weg. Es gibt keine Nutzerkonten und keine
            serverseitige Sitzung.
          </p>
        </section>

        <section aria-labelledby="protokoll-heading" className="flex flex-col gap-2">
          <h2 id="protokoll-heading" className="text-lg font-bold">
            Protokollierung der Missbrauchs-Abwehr
          </h2>
          <p>
            Damit der Chat nicht für Angriffe oder als kostenloser
            KI-Zugang missbraucht wird, protokolliert der Server technische
            Kennzahlen: welche Abwehrregel ausgelöst hat, die Länge einer
            Nachricht und ein Pseudonym Ihrer Adresse (ein gehashter,
            gekürzter Wert — keine echte IP-Adresse). Der Inhalt Ihrer
            Nachrichten wird dabei <strong>nie</strong> mitgeschrieben.
          </p>
        </section>

        <section aria-labelledby="verlaesslichkeit-heading" className="flex flex-col gap-2">
          <h2 id="verlaesslichkeit-heading" className="text-lg font-bold">
            Verlässlichkeit der Antworten
          </h2>
          <p>
            Der Assistent ist eine Software auf Basis eines Sprachmodells und
            kann sich irren — etwa bei Öffnungszeiten, Gebühren oder Fristen.
            Verbindlich ist immer die Auskunft der zuständigen Stelle der
            Stadt Rothenburg ob der Tauber, nicht die Antwort des Chats.
          </p>
        </section>
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        <LegalFooter />
      </footer>
    </div>
  );
}
