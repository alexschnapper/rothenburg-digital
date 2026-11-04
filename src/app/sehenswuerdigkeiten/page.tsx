import type { Metadata } from "next";
import Link from "next/link";

import ExternalLink from "@/components/ExternalLink";
import LegalFooter from "@/components/LegalFooter";
import { OPEN_DATA_SOURCE, germanDate } from "@/lib/opendata/common";
import {
  loadSightData,
  type Sight,
  type SightGroup,
} from "@/lib/opendata/sights";

export const metadata: Metadata = {
  title: "Sehenswürdigkeiten – Rothenburg Digital",
  description:
    "Türme, Tore, Plätze, Museen und das jüdische Rothenburg aus den offenen Daten der Stadt Rothenburg ob der Tauber.",
};

// Wie /parken: Daten zur Laufzeit von bydata.
export const dynamic = "force-dynamic";

const GROUPS: { group: SightGroup; title: string; intro?: string }[] = [
  {
    group: "befestigung",
    title: "Türme, Tore und Stadtmauer",
    intro: "Die mittelalterliche Stadtbefestigung mit ihren Wehrtürmen und Stadttoren.",
  },
  { group: "gebaeude", title: "Plätze, Gebäude und Museen" },
  { group: "aussicht", title: "Aussicht und Natur" },
  {
    group: "juedisch",
    title: "Jüdisches Rothenburg",
    intro: "Orte, die an die jüdische Geschichte der Stadt erinnern.",
  },
];

function SightCard({ sight }: { sight: Sight }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold leading-tight">{sight.name}</h3>
        {sight.types.length > 0 && (
          <p className="text-sm opacity-80">{sight.types.join(" · ")}</p>
        )}
      </div>

      {sight.description && <p className="text-sm">{sight.description}</p>}

      {sight.openingHours && (
        <div className="text-sm">
          <p className="font-semibold">Öffnungszeiten</p>
          <p className="whitespace-pre-line">{sight.openingHours}</p>
        </div>
      )}
      {sight.price && (
        <p className="text-sm">
          <span className="font-semibold">Eintritt: </span>
          {sight.price}
        </p>
      )}
      {sight.attribution && (
        <p className="text-xs opacity-70">Text: {sight.attribution}</p>
      )}

      <div className="mt-auto flex flex-wrap gap-3 text-sm">
        <ExternalLink
          href={sight.mapUrl}
          className="rounded-md bg-brand px-3 py-1.5 font-medium text-white underline-offset-2 hover:underline"
        >
          Auf der Karte zeigen
        </ExternalLink>
      </div>
    </li>
  );
}

export default async function SehenswuerdigkeitenPage() {
  const data = await loadSightData();
  const stand = germanDate(data?.source.modified ?? null);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline opacity-80">
          &larr; Zurück zum Chat
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Sehenswürdigkeiten
        </h1>
        <p className="text-sm opacity-80 sm:text-base">
          Türme, Tore, Plätze und Museen in Rothenburg ob der Tauber. Die
          Angaben stammen aus den offenen Daten der Stadt und werden jede Woche
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
          GROUPS.map(({ group, title, intro }) => {
            const sights = data.sights.filter((sight) => sight.group === group);
            if (sights.length === 0) return null;
            return (
              <section
                key={group}
                aria-labelledby={`${group}-heading`}
                className="flex flex-col gap-3"
              >
                <h2 id={`${group}-heading`} className="text-lg font-bold">
                  {title} ({sights.length})
                </h2>
                {intro && <p className="text-sm opacity-80">{intro}</p>}
                <ul className="grid gap-3 sm:grid-cols-2">
                  {sights.map((sight) => (
                    <SightCard key={sight.id} sight={sight} />
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
            Die Liste ist nicht vollständig: Bekannte Orte wie das Plönlein, der
            Burggarten oder die St.-Jakobs-Kirche sind in den offenen Daten noch
            nicht eingetragen. Öffnungszeiten und Eintrittspreise stehen nur bei
            wenigen Orten. Mehr auf{" "}
            <ExternalLink href="https://www.rothenburg-tourismus.de">
              rothenburg-tourismus.de
            </ExternalLink>
            .
          </p>
        </section>

        {data && (
          <section aria-labelledby="quelle-heading" className="flex flex-col gap-1 text-sm">
            <h2 id="quelle-heading" className="text-base font-bold">
              Quelle
            </h2>
            <p>
              {OPEN_DATA_SOURCE} über das
              bayerische Open-Data-Portal bydata:{" "}
              <ExternalLink href={data.source.url}>{data.source.label}</ExternalLink>
              {stand ? `, Stand ${stand}` : ""}. Lizenz: CC0 (frei verwendbar),
              abweichende Lizenzen stehen beim jeweiligen Ort.
            </p>
          </section>
        )}
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        <LegalFooter />
      </footer>
    </div>
  );
}
