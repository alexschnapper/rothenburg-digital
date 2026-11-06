import type { Metadata } from "next";

import ExternalLink from "@/components/ExternalLink";
import StatusView from "@/components/StatusView";
import { httpStatus } from "@/lib/httpStatus";
import { OPEN_DATA_SOURCE } from "@/lib/opendata/common";
import { loadDailyFact } from "@/lib/opendata/dailyFact";

export const metadata: Metadata = {
  title: "Seite nicht gefunden – Rothenburg Digital",
  // Fehlerseiten gehören nicht in den Suchindex.
  robots: { index: false, follow: true },
};

/**
 * 404 für alle unbekannten Adressen (Issue #54) — statt der englischen
 * Standardseite von Next. Dazu ein Fakt zum heutigen Tag aus den offenen
 * Daten der Stadt (`dailyFact.ts`); liegt er nicht schnell vor, fehlt er
 * einfach.
 */
export default async function NotFound() {
  const fact = await loadDailyFact();

  return (
    <StatusView status={httpStatus(404)}>
      {fact && (
        <aside
          aria-labelledby="fakt-heading"
          className="flex flex-col gap-2 rounded-lg border border-[color:var(--color-border)] border-l-4 border-l-brand bg-[color:var(--color-muted)] px-4 py-3 text-sm"
        >
          <p id="fakt-heading" className="font-bold">
            {fact.kind === "event" ? "Heute los" : "Wussten Sie schon?"} – {fact.title}
          </p>
          {fact.text && <p>{fact.text}</p>}
          <p className="flex flex-wrap gap-x-3 text-xs text-muted">
            {fact.mapUrl && <ExternalLink href={fact.mapUrl}>Auf der Karte zeigen</ExternalLink>}
            <ExternalLink href={fact.sourceUrl}>Quelle: {OPEN_DATA_SOURCE}</ExternalLink>
          </p>
        </aside>
      )}
    </StatusView>
  );
}
