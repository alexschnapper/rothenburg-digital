import type { Metadata } from "next";
import Link from "next/link";

import ExternalLink from "@/components/ExternalLink";
import LegalFooter from "@/components/LegalFooter";
import OpenDataSources from "@/components/OpenDataSources";
import { statusText, type OpenStatus } from "@/lib/opendata/openingHours";
import {
  loadShopData,
  shopStatus,
  type Shop,
  type ShopGroup,
} from "@/lib/opendata/shopping";

export const metadata: Metadata = {
  title: "Einkaufen – Rothenburg Digital",
  description:
    "Geschäfte, Souvenirs, Kunsthandwerk und regionale Lebensmittel in Rothenburg ob der Tauber aus den offenen Daten der Stadt.",
};

// Wie /essen-trinken: Daten zur Laufzeit von bydata, und der Öffnungsstatus
// hängt von der Uhrzeit des Aufrufs ab.
export const dynamic = "force-dynamic";

const GROUPS: { group: ShopGroup; title: string; intro?: string }[] = [
  { group: "souvenir", title: "Souvenirs, Geschenke und Spielzeug" },
  {
    group: "handmade",
    title: "Kunsthandwerk und Deko",
    intro: "Handgemachtes aus der Region, teils im Pop-up-Laden in der Altstadt.",
  },
  { group: "mode", title: "Mode, Schmuck und Accessoires" },
  { group: "lebensmittel", title: "Lebensmittel und Regionales" },
  { group: "weitere", title: "Weitere Geschäfte" },
];

/** Reihenfolge je Gruppe: erst geöffnet, dann „öffnet heute noch", dann der Rest. */
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

function ShopCard({ shop, status }: { shop: Shop; status: OpenStatus | null }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold leading-tight">{shop.name}</h3>
        {shop.types.length > 0 && (
          <p className="text-sm opacity-80">{shop.types.join(" · ")}</p>
        )}
        {shop.address && <p className="text-sm">{shop.address}</p>}
      </div>

      <StatusBadge status={status} />

      {shop.description && <p className="line-clamp-3 text-sm">{shop.description}</p>}

      {shop.hoursLines.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold">Öffnungszeiten</p>
          <ul>
            {shop.hoursLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 text-sm">
        <ExternalLink
          href={shop.mapUrl}
          className="rounded-md bg-brand px-3 py-1.5 font-medium text-white underline-offset-2 hover:underline"
        >
          Auf der Karte zeigen
        </ExternalLink>
        {shop.phone && (
          <a href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`} className="underline">
            {shop.phone}
          </a>
        )}
        {shop.website && <ExternalLink href={shop.website}>Webseite</ExternalLink>}
      </div>
    </li>
  );
}

export default async function EinkaufenPage() {
  const data = await loadShopData();
  const now = new Date();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline opacity-80">
          &larr; Zurück zum Chat
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Einkaufen</h1>
        <p className="text-sm opacity-80 sm:text-base">
          Geschäfte, Souvenirs, Kunsthandwerk und regionale Lebensmittel in
          Rothenburg ob der Tauber – mit Öffnungszeiten und der Angabe, wer
          gerade geöffnet hat. Die Angaben stammen aus den offenen Daten der
          Stadt und werden jede Woche aktualisiert.
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
          GROUPS.map(({ group, title, intro }) => {
            const entries = data.shops
              .filter((shop) => shop.group === group)
              .map((shop) => ({ shop, status: shopStatus(shop, now) }))
              .sort(
                (a, b) =>
                  ORDER[a.status?.state ?? "unknown"] - ORDER[b.status?.state ?? "unknown"],
              );
            if (entries.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`${group}-heading`} className="flex flex-col gap-3">
                <h2 id={`${group}-heading`} className="text-lg font-bold">
                  {title} ({entries.length})
                </h2>
                {intro && <p className="text-sm opacity-80">{intro}</p>}
                <ul className="grid gap-3 sm:grid-cols-2">
                  {entries.map(({ shop, status }) => (
                    <ShopCard key={shop.id} shop={shop} status={status} />
                  ))}
                </ul>
              </section>
            );
          })
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
            Geschäfte, als in den offenen Daten eingetragen sind. Bei vielen
            Einträgen fehlen Öffnungszeiten. Preise und Sortiment stehen nicht
            in den Daten. Cafés und Bäckereien finden Sie unter{" "}
            <Link href="/essen-trinken" className="underline">
              Essen &amp; Trinken
            </Link>
            .
          </p>
          <p>
            Öffnungszeiten können sich ändern – etwa durch Saison, Urlaub oder
            Feiertage. Fragen Sie im Zweifel vorher beim Geschäft nach.
          </p>
        </section>

        {data && <OpenDataSources sources={data.sources} />}
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        <LegalFooter />
      </footer>
    </div>
  );
}
