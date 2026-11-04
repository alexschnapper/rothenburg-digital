import type { Metadata } from "next";
import Link from "next/link";

import ExternalLink from "@/components/ExternalLink";
import LegalFooter from "@/components/LegalFooter";
import OpenDataSources from "@/components/OpenDataSources";
import { statusText, type OpenStatus } from "@/lib/opendata/openingHours";
import {
  loadRestaurantData,
  restaurantStatus,
  type Restaurant,
} from "@/lib/opendata/restaurants";
import { berlinParts, clock } from "@/lib/touristInfo";

export const metadata: Metadata = {
  title: "Essen & Trinken – Rothenburg Digital",
  description:
    "Restaurants, Cafés und Bäckereien in Rothenburg ob der Tauber mit Öffnungszeiten aus den offenen Daten der Stadt.",
};

// Wie /parken: Daten zur Laufzeit von bydata, und der Öffnungsstatus hängt
// von der Uhrzeit des Aufrufs ab.
export const dynamic = "force-dynamic";

/** Reihenfolge: erst geöffnet, dann „öffnet heute noch", dann der Rest. */
const ORDER: Record<OpenStatus["state"] | "unknown", number> = {
  open: 0,
  "opens-later": 1,
  holiday: 2,
  "closed-today": 3,
  unknown: 4,
};

function StatusBadge({ status }: { status: OpenStatus | null }) {
  const open = status?.state === "open";
  const label = status
    ? statusText(status).replace(/^jetzt /, "Jetzt ").replace(/^heute /, "Heute ")
    : "Öffnungszeiten nicht angegeben";
  return (
    <p
      className={`w-fit rounded-full border px-3 py-0.5 text-xs font-semibold ${
        open
          ? "border-brand bg-brand text-white"
          : "border-[color:var(--color-border)]"
      }`}
    >
      {label}
    </p>
  );
}

function RestaurantCard({
  restaurant,
  status,
}: {
  restaurant: Restaurant;
  status: OpenStatus | null;
}) {
  const kind = [...restaurant.types, ...restaurant.cuisine].join(" · ");
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold leading-tight">{restaurant.name}</h3>
        {kind && <p className="text-sm opacity-80">{kind}</p>}
        {restaurant.address && <p className="text-sm">{restaurant.address}</p>}
      </div>

      <StatusBadge status={status} />

      {restaurant.description && (
        <p className="line-clamp-3 text-sm">{restaurant.description}</p>
      )}

      {restaurant.hoursLines.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold">Öffnungszeiten</p>
          <ul>
            {restaurant.hoursLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <ExternalLink
          href={restaurant.mapUrl}
          className="rounded-md bg-brand px-3 py-1.5 font-medium text-white underline-offset-2 hover:underline"
        >
          Auf der Karte zeigen
        </ExternalLink>
        {restaurant.phone && (
          <a href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`} className="underline">
            {restaurant.phone}
          </a>
        )}
        {restaurant.website && (
          <ExternalLink href={restaurant.website}>Webseite</ExternalLink>
        )}
      </div>
    </li>
  );
}

export default async function EssenTrinkenPage() {
  const data = await loadRestaurantData();
  const now = new Date();

  const entries = (data?.restaurants ?? [])
    .map((restaurant) => ({ restaurant, status: restaurantStatus(restaurant, now) }))
    .sort(
      (a, b) =>
        ORDER[a.status?.state ?? "unknown"] - ORDER[b.status?.state ?? "unknown"],
    );
  const openCount = entries.filter((entry) => entry.status?.state === "open").length;
  const time = clock(berlinParts(now).minutes);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline opacity-80">
          &larr; Zurück zum Chat
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Essen &amp; Trinken
        </h1>
        <p className="text-sm opacity-80 sm:text-base">
          Restaurants, Cafés und Bäckereien in Rothenburg ob der Tauber – mit
          Öffnungszeiten und der Angabe, wer gerade geöffnet hat. Die Angaben
          stammen aus den offenen Daten der Stadt und werden jede Woche
          aktualisiert.
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
            <ExternalLink href="https://www.rothenburg-tourismus.de">
              rothenburg-tourismus.de
            </ExternalLink>
            .
          </p>
        ) : (
          <section aria-labelledby="betriebe-heading" className="flex flex-col gap-3">
            <h2 id="betriebe-heading" className="text-lg font-bold">
              Betriebe ({entries.length})
            </h2>
            <p className="text-sm opacity-80">
              Stand der Anzeige: heute, {time} Uhr. Jetzt geöffnet: {openCount}.
              Was gerade geöffnet hat, steht oben.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {entries.map(({ restaurant, status }) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} status={status} />
              ))}
            </ul>
          </section>
        )}

        <section
          aria-labelledby="fehlt-heading"
          className="flex flex-col gap-2 rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm"
        >
          <h2 id="fehlt-heading" className="text-base font-bold">
            Was hier (noch) fehlt
          </h2>
          <p>
            Die Liste ist nicht vollständig: Rothenburg hat deutlich mehr
            Gastronomie, als in den offenen Daten eingetragen ist. Weitere
            Betriebe finden Sie auf{" "}
            <ExternalLink href="https://www.rothenburg-tourismus.de">
              rothenburg-tourismus.de
            </ExternalLink>
            . Speisekarten, Preise und Reservierungen stehen nicht in den
            Daten.
          </p>
          <p>
            Öffnungszeiten können sich ändern – etwa durch Ruhetage, Saison,
            Betriebsurlaub oder Feiertage. Fragen Sie im Zweifel vorher beim
            Betrieb nach.
          </p>
        </section>

        {data && (
          <OpenDataSources sources={[data.source]} />
        )}
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        <LegalFooter />
      </footer>
    </div>
  );
}
