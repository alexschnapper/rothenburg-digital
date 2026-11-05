import type { Metadata } from "next";

import ExternalLink from "@/components/ExternalLink";
import PageShell, { CARD_GRID_HALF, SIDE_BY_SIDE } from "@/components/PageShell";
import FeedJsonLd from "@/components/FeedJsonLd";
import OpenDataSources from "@/components/OpenDataSources";
import { emergencyFeed } from "@/lib/opendata/feeds";
import { loadEmergencyData, type Spot } from "@/lib/opendata/emergency";
import { statusText } from "@/lib/opendata/openingHours";

export const metadata: Metadata = {
  title: "Notfall & Hitze – Rothenburg Digital",
  description:
    "Defibrillatoren, Trinkbrunnen und kühle Orte in Rothenburg ob der Tauber aus den offenen Daten der Stadt.",
};

// Wie /parken: Daten zur Laufzeit von bydata; der Öffnungsstatus hängt von
// der Uhrzeit des Aufrufs ab.
export const dynamic = "force-dynamic";

function SpotCard({ spot }: { spot: Spot }) {
  return (
    <li className="flex max-w-3xl flex-col gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4">
      <h3 className="text-base font-bold leading-tight">{spot.name}</h3>
      {spot.address && <p className="text-sm">{spot.address}</p>}
      {spot.description && <p className="text-sm">{spot.description}</p>}
      {spot.status && (
        <p className="w-fit rounded-full border border-[color:var(--color-border)] px-3 py-0.5 text-xs font-semibold">
          {statusText(spot.status).replace(/^jetzt /, "Jetzt ").replace(/^heute /, "Heute ")}
        </p>
      )}
      {spot.hoursLines.length > 0 && (
        <ul className="text-sm">
          {spot.hoursLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-1 text-sm">
        <ExternalLink
          href={spot.mapUrl}
          className="inline-block rounded-md bg-brand px-3 py-1.5 font-medium text-white underline-offset-2 hover:underline"
        >
          Auf der Karte zeigen
        </ExternalLink>
      </div>
    </li>
  );
}

export default async function NotfallHitzePage() {
  const data = await loadEmergencyData();
  const fountains = data?.heat.filter((spot) => spot.kind === "Trinkbrunnen") ?? [];
  const cool = data?.heat.filter((spot) => spot.kind === "Kühler Ort") ?? [];

  return (
    <PageShell
      title="Notfall & Hitze"
      intro={
        <>
          Defibrillatoren, Trinkbrunnen und kühle Orte in Rothenburg ob der
          Tauber, aus den offenen Daten der Stadt.
        </>
      }
    >
      {/* Ganz oben und unabhängig von den Daten: Im Notfall zuerst 112. */}
      <section
        aria-labelledby="notruf-heading"
        className="flex max-w-3xl flex-col gap-3 rounded-lg border-2 border-red-700 bg-red-50 px-4 py-4 text-red-950 dark:border-red-400 dark:bg-red-950/40 dark:text-red-50"
      >
        <h2 id="notruf-heading" className="text-xl font-extrabold">
          Im Notfall: Notruf 112
        </h2>
        <p className="text-sm sm:text-base">
          Ist jemand zusammengebrochen, bewusstlos oder atmet nicht, rufen Sie
          sofort die 112. Die Leitstelle schickt Hilfe und unterstützt Sie am
          Telefon, bis sie eintrifft.
        </p>
        <a
          href="tel:112"
          className="w-fit rounded-md bg-red-700 px-5 py-2.5 text-lg font-bold text-white hover:bg-red-800"
        >
          112 anrufen
        </a>
      </section>

      {!data ? (
        <p
          role="status"
          className="max-w-3xl rounded-lg border border-[color:var(--color-border)] border-l-4 border-l-brand bg-[color:var(--color-muted)] px-4 py-3 text-sm"
        >
          Die Standorte sind gerade nicht abrufbar. Bitte versuchen Sie es
          später noch einmal.
        </p>
      ) : (
        <>
          <div className={SIDE_BY_SIDE}>
            <section aria-labelledby="defi-heading" className="flex flex-col gap-3">
              <h2 id="defi-heading" className="text-lg font-bold">
                Defibrillatoren ({data.defibrillators.length})
              </h2>
              <p className="max-w-3xl text-sm">
                Ob ein Gerät gerade zugänglich ist, steht nicht in den Daten —
                Geräte in Gebäuden sind oft nur zu deren Öffnungszeiten
                erreichbar. Die Liste ist nicht vollständig: Weitere Geräte gibt
                es oft in Geschäften, Hotels oder Praxen.
              </p>
              <ul className={CARD_GRID_HALF}>
                {data.defibrillators.map((spot) => (
                  <SpotCard key={spot.id} spot={spot} />
                ))}
              </ul>
            </section>

            <section aria-labelledby="hitze-heading" className="flex flex-col gap-3">
              <h2 id="hitze-heading" className="text-lg font-bold">
                Bei Hitze
              </h2>
              <p className="max-w-3xl text-sm">
                Viel trinken, Schatten suchen und die Mittagshitze meiden. Bei
                Anzeichen eines Hitzschlags (Verwirrtheit, heiße trockene Haut,
                Bewusstlosigkeit): Notruf 112.
              </p>
              {fountains.length > 0 && (
                <>
                  <h3 className="text-base font-bold">Trinkbrunnen ({fountains.length})</h3>
                  <ul className={CARD_GRID_HALF}>
                    {fountains.map((spot) => (
                      <SpotCard key={spot.id} spot={spot} />
                    ))}
                  </ul>
                </>
              )}
              {cool.length > 0 && (
                <>
                  <h3 className="text-base font-bold">Kühle Orte ({cool.length})</h3>
                  <ul className={CARD_GRID_HALF}>
                    {cool.map((spot) => (
                      <SpotCard key={spot.id} spot={spot} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <OpenDataSources sources={data.sources} feed="notfall-hitze" />
          <FeedJsonLd feed={emergencyFeed(data)} />
        </>
      )}
    </PageShell>
  );
}
