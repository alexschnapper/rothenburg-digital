import type { Metadata } from "next";
import Link from "next/link";

import ExternalLink from "@/components/ExternalLink";
import LegalFooter from "@/components/LegalFooter";
import OpenDataSources from "@/components/OpenDataSources";
import {
  CHARGING_OVERVIEW_URL,
  loadParkingData,
  type Place,
} from "@/lib/opendata/parking";

export const metadata: Metadata = {
  title: "Parken & E-Laden – Rothenburg Digital",
  description:
    "Parkplätze, Wohnmobilstellplätze und E-Ladesäulen in Rothenburg ob der Tauber aus den offenen Daten der Stadt.",
};

// Die Daten kommen zur Laufzeit von bydata (Zwischenspeicher im Prozess,
// `src/lib/opendata/bydata.ts`). Ohne `force-dynamic` würde Next die Seite
// beim Build einmal abrufen und den Stand dann bis zum nächsten Build
// einfrieren — und ein Build ohne Netz würde fehlschlagen.
export const dynamic = "force-dynamic";

function PlaceCard({ place }: { place: Place }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-brand px-2 text-lg font-extrabold text-white"
        >
          {/^P\d+$/.test(place.label) ? place.label : "P"}
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold leading-tight">
            {place.label !== place.name ? (
              <>
                {place.label}
                <span className="sr-only">: </span>
                <span className="block text-sm font-normal opacity-80">
                  {place.name}
                </span>
              </>
            ) : (
              place.name
            )}
          </h3>
          {place.address && <p className="text-sm">{place.address}</p>}
        </div>
      </div>

      {place.camper && (
        <p className="w-fit rounded-full border border-[color:var(--color-border)] px-3 py-0.5 text-xs font-medium">
          🚐 Auch für Wohnmobile
        </p>
      )}

      {place.description && <p className="text-sm">{place.description}</p>}

      <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {place.features.length > 0 && (
          <>
            <dt className="font-semibold">Ausstattung</dt>
            <dd>{place.features.join(", ")}</dd>
          </>
        )}
        <dt className="font-semibold">Bezahlung</dt>
        <dd>
          {place.payment.length > 0
            ? place.payment.join(", ")
            : "keine Angabe in den Daten"}
        </dd>
      </dl>

      <div className="flex flex-wrap gap-3 text-sm">
        <ExternalLink
          href={place.mapUrl}
          className="rounded-md bg-brand px-3 py-1.5 font-medium text-white underline-offset-2 hover:underline"
        >
          Auf der Karte zeigen
        </ExternalLink>
        {place.website && (
          <ExternalLink href={place.website} className="px-1 py-1.5 underline">
            Webseite
          </ExternalLink>
        )}
      </div>
    </li>
  );
}

export default async function ParkenPage() {
  const data = await loadParkingData();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline opacity-80">
          &larr; Zur Startseite
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Parken &amp; E-Laden
        </h1>
        <p className="text-sm opacity-80 sm:text-base">
          Wo Sie in Rothenburg ob der Tauber parken und Ihr Elektroauto laden
          können. Die Angaben stammen aus den offenen Daten der Stadt und werden
          jede Woche aktualisiert.
        </p>
      </header>

      <main id="main-content" className="flex flex-col gap-8">
        {!data ? (
          <p
            role="status"
            className="rounded-lg border border-[color:var(--color-border)] border-l-4 border-l-brand bg-[color:var(--color-muted)] px-4 py-3 text-sm"
          >
            Die Daten sind gerade nicht abrufbar. Bitte versuchen Sie es später
            noch einmal oder informieren Sie sich auf{" "}
            <ExternalLink href="https://www.rothenburg.de">
              rothenburg.de
            </ExternalLink>
            .
          </p>
        ) : (
          <>
            <section aria-labelledby="parken-heading" className="flex flex-col gap-3">
              <h2 id="parken-heading" className="text-lg font-bold">
                Parkplätze ({data.parking.length})
              </h2>
              <p className="text-sm opacity-80">
                Die Parkplätze P1 bis P5 liegen außerhalb der Stadtmauer, von
                dort gehen Sie zu Fuß in die Altstadt. Der Schrannenplatz liegt
                innerhalb der Mauer.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.parking.map((place) => (
                  <PlaceCard key={place.id} place={place} />
                ))}
              </ul>
            </section>

            <section aria-labelledby="laden-heading" className="flex flex-col gap-3">
              <h2 id="laden-heading" className="text-lg font-bold">
                E-Ladesäulen ({data.charging.length})
              </h2>
              {data.charging.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {data.charging.map((place) => (
                    <PlaceCard key={place.id} place={place} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm">
                  In den offenen Daten ist derzeit keine Ladesäule eingetragen.
                </p>
              )}
              <p className="rounded-lg border border-[color:var(--color-border)] border-l-4 border-l-brand bg-[color:var(--color-muted)] px-4 py-3 text-sm">
                Diese Liste ist nicht vollständig. Alle Ladesäulen, auch auf
                den Parkplätzen und bei Übernachtungsbetrieben, stehen in der{" "}
                <ExternalLink href={CHARGING_OVERVIEW_URL}>
                  offiziellen Übersicht der Stadt
                </ExternalLink>
                . Prüfen Sie vor der Fahrt zusätzlich eine Lade-App – auch für
                deren Angaben kann keine Gewähr übernommen werden.
              </p>
            </section>
          </>
        )}

        <section
          aria-labelledby="eauto-heading"
          className="flex flex-col gap-2 rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm"
        >
          <h2 id="eauto-heading" className="text-base font-bold">
            Parken mit dem E-Auto
          </h2>
          <ul className="list-inside list-disc">
            <li>
              Auf öffentlichen Parkplätzen parken Elektroautos in Bayern 3
              Stunden kostenlos (nicht auf Parkplätzen privater Anbieter).
            </li>
            <li>
              In der Altstadt dürfen alle Fahrzeuge höchstens 2 Stunden parken.
            </li>
          </ul>
          <p>
            Quelle:{" "}
            <ExternalLink href={CHARGING_OVERVIEW_URL}>
              rothenburg.de – E-Tankstellen
            </ExternalLink>
          </p>
        </section>

        <section
          aria-labelledby="fehlt-heading"
          className="flex flex-col gap-2 rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm"
        >
          <h2 id="fehlt-heading" className="text-base font-bold">
            Was hier (noch) fehlt
          </h2>
          <p>
            Preise, Öffnungszeiten und die Zahl der Stellplätze stehen nicht in
            den Daten. Ob gerade ein Platz frei ist, zeigt die Seite ebenfalls
            noch nicht: Eine Erkennung der Belegung für ausgewählte Parkflächen
            vor der Stadtmauer ist ein Ziel des OK Lab Rothenburg. Verbindlich
            sind die Angaben vor Ort und auf{" "}
            <ExternalLink href="https://www.rothenburg.de">
              rothenburg.de
            </ExternalLink>
            .
          </p>
        </section>

        {data && (
          <OpenDataSources sources={data.sources} />
        )}
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        <LegalFooter />
      </footer>
    </div>
  );
}
