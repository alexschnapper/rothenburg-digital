import type { Metadata } from "next";
import Link from "next/link";

import ExternalLink from "@/components/ExternalLink";
import LegalFooter from "@/components/LegalFooter";
import { germanDate } from "@/lib/opendata/common";
import {
  SEVERITY_LABEL,
  type DatasetReport,
  type QualityReport,
  type Traffic,
} from "@/lib/opendata/quality";
import reportJson from "../../../reports/datenqualitaet.json";

export const metadata: Metadata = {
  title: "Datenqualität – Rothenburg Digital",
  description:
    "Wöchentlicher, automatischer Bericht zur Qualität der offenen Daten der Stadt Rothenburg ob der Tauber.",
};

// Bewusst der eingecheckte Bericht und kein Live-Abruf (#80): Der wöchentliche
// Lauf legt einen PR an, und erst nach der Durchsicht steht der neue Stand hier.
const report = reportJson as QualityReport;

// Wie die übrigen Seiten: Statisch gebaut zöge die 404-Seite ihren bydata-Abruf
// (Fakt zum Tag) in den Build. Der Bericht selbst kommt trotzdem aus der Datei.
export const dynamic = "force-dynamic";

const RULES_URL =
  "https://github.com/alexschnapper/rothenburg-digital/blob/main/src/lib/opendata/quality.ts";
const REPORT_URL =
  "https://github.com/alexschnapper/rothenburg-digital/blob/main/docs/datenqualitaet.md";
const ISSUES_URL = "https://github.com/alexschnapper/rothenburg-digital/issues";

/** Farbe nie allein: Symbol und Wort tragen dieselbe Aussage. */
const TRAFFIC: Record<Traffic, { icon: string; label: string; className: string }> = {
  rot: {
    icon: "✖",
    label: "Fehler",
    className: "border-red-700 text-red-800 dark:border-red-400 dark:text-red-200",
  },
  gelb: {
    icon: "!",
    label: "Warnung",
    className: "border-amber-700 text-amber-900 dark:border-amber-400 dark:text-amber-200",
  },
  gruen: {
    icon: "✓",
    label: "In Ordnung",
    className: "border-green-700 text-green-800 dark:border-green-400 dark:text-green-200",
  },
};

function StatusBadge({ status }: { status: Traffic }) {
  const { icon, label, className } = TRAFFIC[status];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border-2 px-3 py-0.5 text-xs font-bold ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

function DatasetCard({ dataset }: { dataset: DatasetReport }) {
  const stand = germanDate(dataset.modified);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-bold leading-tight">
          <ExternalLink href={dataset.pageUrl} className="underline underline-offset-2">
            {dataset.title}
          </ExternalLink>
        </h3>
        <StatusBadge status={dataset.status} />
      </div>
      <p className="text-sm opacity-80">
        {dataset.items === null ? "Nicht abrufbar" : `${dataset.items} Einträge`}
        {stand ? ` · Stand ${stand}` : ""}
        {` · Lizenz: ${dataset.license ?? "keine Angabe"}`}
      </p>
      {dataset.findings.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {dataset.findings.map((finding) => (
            <li key={finding.rule}>
              <span className="font-semibold">{SEVERITY_LABEL[finding.severity]}:</span>{" "}
              {finding.message}
              {finding.count > 0 && finding.rule !== "referenz" ? ` (${finding.count})` : ""}
              {finding.examples.length > 0 && (
                <span className="opacity-80"> Zum Beispiel: {finding.examples.join("; ")}.</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function DatenPage() {
  const counts: Record<Traffic, number> = { rot: 0, gelb: 0, gruen: 0 };
  for (const dataset of report.datasets) counts[dataset.status] += 1;
  const date = germanDate(report.generatedAt.slice(0, 10));
  // Erst die Datensätze, bei denen am meisten zu tun ist.
  const order: Traffic[] = ["rot", "gelb", "gruen"];
  const datasets = [...report.datasets].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status),
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline opacity-80">
          &larr; Zur Startseite
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Datenqualität der offenen Daten
        </h1>
        <p className="text-sm opacity-80 sm:text-base">
          Wie vollständig, aktuell und widerspruchsfrei sind die offenen Daten
          der Stadt Rothenburg ob der Tauber? Ohne belastbare Daten kann keine
          Anwendung verlässliche Auskunft geben.
        </p>
      </header>

      <main id="main-content" className="flex flex-col gap-8">
        <section aria-labelledby="ueberblick-heading" className="flex flex-col gap-3">
          <h2 id="ueberblick-heading" className="text-lg font-bold">
            Überblick
          </h2>
          <p className="text-sm sm:text-base">
            Geprüft wurden {report.datasets.length} Datensätze der Stadt im
            bayerischen Open-Data-Portal bydata: {counts.rot} mit Fehlern,{" "}
            {counts.gelb} mit Warnungen, {counts.gruen} in Ordnung.
          </p>
          <p className="text-sm">
            Der Bericht entsteht wöchentlich automatisch, nach festen Regeln und
            ohne KI. Diese Fassung stammt vom {date}. Die Befunde beschreiben die
            Daten, nicht die Menschen, die sie pflegen: Ein Hinweis heißt, dass
            etwas fehlt oder nicht zusammenpasst, nicht, dass jemand einen Fehler
            gemacht hat.
          </p>
        </section>

        <section aria-labelledby="datensaetze-heading" className="flex flex-col gap-3">
          <h2 id="datensaetze-heading" className="text-lg font-bold">
            Datensätze
          </h2>
          <ul className="flex flex-col gap-3">
            {datasets.map((dataset) => (
              <DatasetCard key={dataset.id} dataset={dataset} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="methode-heading" className="flex flex-col gap-2 text-sm">
          <h2 id="methode-heading" className="text-base font-bold">
            So wird geprüft
          </h2>
          <ul className="list-inside list-disc">
            <li>
              <span className="font-semibold">Fehler:</span> Daten fehlen ganz,
              sind nicht abrufbar oder offensichtlich falsch (Postleitzahl,
              Koordinaten).
            </li>
            <li>
              <span className="font-semibold">Warnung:</span> Daten sind
              unvollständig, veraltet oder widersprechen sich (Lizenzen,
              Dubletten).
            </li>
            <li>
              <span className="font-semibold">Hinweis:</span> Angaben, die
              fehlen oder nicht einheitlich sind, die Nutzung aber nicht
              verhindern. Hinweise ändern die Ampel nicht.
            </li>
          </ul>
          <p>
            Alle Regeln sind öffentlich: <ExternalLink href={RULES_URL}>Prüfregeln im Quellcode</ExternalLink>,{" "}
            <ExternalLink href={REPORT_URL}>Bericht mit Änderungen zur Vorwoche</ExternalLink>.
            Einen Fehler in den Daten gefunden oder eine Regel, die nicht passt?{" "}
            <ExternalLink href={ISSUES_URL}>Rückmeldung auf GitHub</ExternalLink>.
          </p>
        </section>
      </main>

      <footer className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-xs opacity-70 sm:text-sm">
        <LegalFooter />
      </footer>
    </div>
  );
}
