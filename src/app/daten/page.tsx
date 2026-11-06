import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import ExternalLink from "@/components/ExternalLink";
import PageShell from "@/components/PageShell";
import { SEVERITY_MARK, StatusBadge } from "@/components/daten/Marks";
import { ChartFigure, QualityHistory } from "@/components/daten/QualityHistory";
import { QualityMatrix, RuleList } from "@/components/daten/QualityMatrix";
import { germanDate } from "@/lib/opendata/common";
import {
  RULE_LABEL,
  SEVERITIES,
  countText,
  filterDatasets,
  filterQuery,
  findingAnchor,
  isFiltered,
  matrixColumns,
  parseFilter,
  type DashboardFilter,
} from "@/lib/opendata/dashboard";
import { CATALOG_PATH, FEED_INFO, FEED_NAMES, ICAL_FEEDS, feedPath, icalPath } from "@/lib/opendata/feeds";
import { OTHER_SOURCES, USAGE_LABEL } from "@/lib/opendata/inventory";
import { SEVERITY_LABEL, type DatasetReport, type Traffic } from "@/lib/opendata/quality";
import { chartData, dcatResult, report } from "@/lib/opendata/reportFiles";
import { CITY, RTS, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Datenqualität – Rothenburg Digital",
  description:
    `Wöchentlicher, automatischer Bericht zur Qualität der offenen Daten der ${CITY.name}.`,
};

// Wie die übrigen Seiten: Statisch gebaut zöge die 404-Seite ihren bydata-Abruf
// (Fakt zum Tag) in den Build. Der Bericht selbst kommt trotzdem aus der Datei.
export const dynamic = "force-dynamic";

const RULES_URL = SITE.file("src/lib/opendata/quality.ts");
const REPORT_URL = SITE.file("docs/datenqualitaet.md");
const ISSUES_URL = SITE.issues;

/** Wofür rothenburg.digital den Datensatz nutzt, mit Links auf die eigenen Seiten (#66). */
function UsageLine({ dataset }: { dataset: DatasetReport }) {
  const { usage } = dataset;
  if (!usage) return <p className="text-sm font-semibold">Noch nicht bewertet</p>;
  const where = [
    ...usage.pages.map((page) => (
      <Link key={page.href} href={page.href} className="underline">
        {page.label}
      </Link>
    )),
    ...(usage.chat ? [<span key="chat">Chat</span>] : []),
  ];
  return (
    <p className="text-sm">
      <span className="font-semibold">{USAGE_LABEL[usage.status]}</span>
      {where.length > 0 && (
        <>
          {": "}
          {where.map((part, index) => (
            <span key={part.key}>
              {index > 0 ? ", " : ""}
              {part}
            </span>
          ))}
        </>
      )}
      {usage.note ? `. ${usage.note}` : "."}
    </p>
  );
}

/**
 * Detailansicht je Datensatz. Anker je Datensatz (`/daten#skg-venus-e-ladesaeulen`)
 * und je Befund, damit eine Zelle der Matrix direkt dorthin springt (#84).
 */
function DatasetCard({ dataset }: { dataset: DatasetReport }) {
  const stand = germanDate(dataset.modified);
  return (
    <li
      id={dataset.id}
      className="flex scroll-mt-4 flex-col gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4 target:outline target:outline-4 target:outline-[color:var(--color-focus)] print:break-inside-avoid"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-bold leading-tight">
          <ExternalLink href={dataset.pageUrl} className="underline underline-offset-2">
            {dataset.title}
          </ExternalLink>
        </h3>
        <StatusBadge status={dataset.status} />
      </div>
      <p className="text-sm text-muted">
        {dataset.items === null ? "Nicht abrufbar" : `${dataset.items} Einträge`}
        {stand ? ` · Stand ${stand}` : ""}
        {` · Lizenz: ${dataset.license ?? "keine Angabe"}`}
      </p>
      <UsageLine dataset={dataset} />
      {dataset.findings.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {dataset.findings.map((finding) => {
            const count = countText(finding);
            return (
              <li
                key={finding.rule}
                id={findingAnchor(dataset.id, finding.rule)}
                className="flex scroll-mt-4 gap-2 rounded p-1 target:outline target:outline-4 target:outline-[color:var(--color-focus)]"
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs font-bold ${SEVERITY_MARK[finding.severity].className}`}
                >
                  {SEVERITY_MARK[finding.severity].icon}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold">
                    {SEVERITY_LABEL[finding.severity]} · {RULE_LABEL[finding.rule]}:
                  </span>{" "}
                  {finding.message}
                  {count ? ` Betroffen: ${count}.` : ""}
                  {finding.examples.length > 0 && (
                    <span className="text-muted">
                      {" "}
                      {finding.count > finding.examples.length ? "Zum Beispiel" : "Betroffen"}:{" "}
                      {finding.examples.join("; ")}.
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/** Filter als einfaches GET-Formular: funktioniert ohne JavaScript und ergibt einen teilbaren Link. */
function FilterForm({ filter }: { filter: DashboardFilter }) {
  const rules = matrixColumns(report.datasets).map((column) => column.rule);
  const datasets = [...report.datasets].sort((a, b) => a.title.localeCompare(b.title, "de"));
  // Ein Auswahlfeld ist so breit wie sein längster Eintrag („Direktvermarkter
  // Pop-Up Rothenburg"). Bei 320 px und breiter Schrift ragte es sonst über den
  // Rand (WCAG 1.4.10); `max-w-full` kürzt die Anzeige im Feld.
  const select =
    "min-h-11 w-full max-w-full rounded border-2 border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 text-sm";
  return (
    <form
      method="get"
      action="/daten"
      aria-labelledby="filter-heading"
      className="flex flex-wrap items-end gap-3 print:hidden"
    >
      <h2 id="filter-heading" className="sr-only">
        Filter
      </h2>
      <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm font-semibold">
        Schwere
        <select name="schwere" defaultValue={filter.schwere ?? ""} className={select}>
          <option value="">Alle</option>
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABEL[severity]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm font-semibold">
        Regel
        <select name="regel" defaultValue={filter.regel ?? ""} className={select}>
          <option value="">Alle</option>
          {rules.map((rule) => (
            <option key={rule} value={rule}>
              {RULE_LABEL[rule]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm font-semibold">
        Datensatz
        <select name="datensatz" defaultValue={filter.datensatz ?? ""} className={select}>
          <option value="">Alle</option>
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.title}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="min-h-11 rounded bg-brand px-4 text-sm font-bold text-brand-fg"
      >
        Filter anwenden
      </button>
      {isFiltered(filter) && (
        <Link href="/daten" className="min-h-11 content-center text-sm underline">
          Alle Befunde zeigen
        </Link>
      )}
    </form>
  );
}

/** „Regel: Veraltet, Schwere: Warnung“ — was gerade gefiltert ist, in Worten. */
function filterText(filter: DashboardFilter): string {
  const parts: string[] = [];
  if (filter.schwere) parts.push(`Schwere „${SEVERITY_LABEL[filter.schwere]}“`);
  if (filter.regel) parts.push(`Regel „${RULE_LABEL[filter.regel]}“`);
  if (filter.datensatz) {
    const title = report.datasets.find((dataset) => dataset.id === filter.datensatz)?.title;
    parts.push(`Datensatz „${title}“`);
  }
  return parts.join(", ");
}

export default async function DatenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilter(params, report);
  const filtered = isFiltered(filter);
  const query = filterQuery(filter);
  // Das Formular schickt auch leere Felder mit (`?schwere=&regel=veraltet`).
  // Weiter auf die bereinigte Adresse, damit ein geteilter Link kurz bleibt;
  // unbekannte Werte fallen dabei ebenfalls weg.
  const sent = ["schwere", "regel", "datensatz"].filter((key) => key in params);
  if (sent.some((key) => !(key in filter))) redirect(`/daten${query}`);
  const datasets = filterDatasets(report, filter);
  const columns = matrixColumns(datasets);
  const counts: Record<Traffic, number> = { rot: 0, gelb: 0, gruen: 0 };
  for (const dataset of report.datasets) counts[dataset.status] += 1;
  const date = germanDate(report.generatedAt.slice(0, 10));
  const charts = chartData();
  // „Veraltet bei 14 von 18“: Bezug sind alle Datensätze, außer man wählt einen aus.
  const total = filter.datensatz ? 1 : report.datasets.length;

  return (
    <PageShell
      title="Datenqualität der offenen Daten"
      intro={
        <>
          Wie vollständig, aktuell und widerspruchsfrei sind die offenen Daten
          der {CITY.name}? Ohne belastbare Daten kann keine
          Anwendung verlässliche Auskunft geben.
        </>
      }
    >
      {/* Überblick: Text links, daneben die Ampel heute als Ring (#93). */}
      <section
        aria-labelledby="ueberblick-heading"
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,48rem)_minmax(0,22rem)]"
      >
        <div className="flex flex-col gap-3">
          <h2 id="ueberblick-heading" className="text-lg font-bold">
            Überblick
          </h2>
          <p className="text-sm sm:text-base">
            Geprüft wurden {report.datasets.length} Datensätze der Stadt im
            bayerischen Open-Data-Portal bydata: {counts.rot} mit Fehlern,{" "}
            {counts.gelb} mit Warnungen, {counts.gruen} in Ordnung.
          </p>
          <p className="text-sm">
            Ein Datensatz ist eine Sammlung im Portal, etwa „Restaurants“. Er
            enthält viele Einträge, also einzelne Orte oder Angebote. Die Daten
            stammen aus dem Projekt {RTS.graph} des {RTS.full}.
          </p>
          <p className="text-sm">
            Der Bericht entsteht wöchentlich automatisch, nach festen Regeln und
            ohne KI. Diese Fassung stammt vom {date}. Die Befunde beschreiben die
            Daten, nicht die Menschen, die sie pflegen: Ein Hinweis heißt, dass
            etwas fehlt oder nicht zusammenpasst, nicht, dass jemand einen Fehler
            gemacht hat.
          </p>
        </div>
        {/* Der Satz daneben nennt dieselben Zahlen: Er ist die Textfassung des Rings. */}
        <ChartFigure name="ampel-heute" data={charts} className="max-w-sm" />
      </section>

      <FilterForm filter={filter} />
      {filtered && (
        <p className="max-w-3xl text-sm font-semibold">
          Gefiltert nach {filterText(filter)}: {datasets.length} von{" "}
          {report.datasets.length} Datensätzen.
        </p>
      )}

      {/* Desktop zuerst: Matrix und Verlauf nebeneinander, auf dem Handy untereinander. */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] print:block">
        <section aria-labelledby="matrix-heading" className="flex min-w-0 flex-col gap-3">
          <h2 id="matrix-heading" className="scroll-mt-4 text-lg font-bold">
            Befunde nach Regel
          </h2>
          <p className="hidden max-w-3xl text-sm lg:block print:block">
            Je Zeile ein Datensatz, je Spalte eine Prüfregel. Eine Zelle führt
            zum Befund mit Beispielen, ein Spaltenkopf filtert nach der Regel.
            Zeichen: <span aria-hidden="true">✖</span> Fehler,{" "}
            <span aria-hidden="true">!</span> Warnung,{" "}
            <span aria-hidden="true">i</span> Hinweis, die Zahl nennt die
            betroffenen Einträge.
          </p>
          <div className="hidden lg:block print:block">
            <QualityMatrix datasets={datasets} columns={columns} filter={filter} total={total} />
          </div>
          <div className="flex flex-col gap-3 lg:hidden print:hidden">
            <p className="text-sm">
              Je Prüfregel, wie viele Datensätze betroffen sind. Ein Klick
              filtert nach der Regel, die Befunde stehen weiter unten.
            </p>
            <RuleList columns={columns} filter={filter} total={total} />
          </div>
        </section>

        <section aria-labelledby="verlauf-heading" className="flex min-w-0 flex-col gap-3 print:mt-8">
          <h2 id="verlauf-heading" className="text-lg font-bold">
            Verlauf
          </h2>
          <QualityHistory data={charts} />
        </section>
      </div>

      <section aria-labelledby="datensaetze-heading" className="flex flex-col gap-3">
        <h2 id="datensaetze-heading" className="text-lg font-bold">
          Befunde je Datensatz
        </h2>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3 [&>li]:break-words print:block print:space-y-3">
          {datasets.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="export-heading" className="flex max-w-3xl flex-col gap-2 text-sm print:hidden">
        <h2 id="export-heading" className="text-base font-bold">
          Weitergeben und Exportieren
        </h2>
        <ul className="list-inside list-disc">
          <li>
            <a href="/daten/befunde.csv" download className="underline">
              Alle Befunde als CSV
            </a>{" "}
            (eine Zeile je Befund, für Excel oder LibreOffice)
          </li>
          {filtered && (
            <li>
              <a href={`/daten/befunde.csv${query}`} download className="underline">
                Gefilterte Befunde als CSV
              </a>
            </li>
          )}
          <li>
            Drucken oder als PDF speichern: über die Druckfunktion des
            Browsers (Strg + P bzw. ⌘ + P). Filter und Navigation fallen dabei
            weg.
          </li>
          <li>
            Die Adresse dieser Seite enthält die gewählten Filter und lässt
            sich als Link weitergeben. Jeder Datensatz hat einen eigenen
            Anker, etwa{" "}
            <a href="/daten#skg-venus-e-ladesaeulen" className="underline">
              /daten#skg-venus-e-ladesaeulen
            </a>
            .
          </li>
        </ul>
      </section>

      {/* Aufbereitete Daten zurückgeben, damit das Projekt keine Insel ist (#81). */}
      <section
        id="feeds"
        aria-labelledby="feeds-heading"
        className="flex max-w-3xl scroll-mt-4 flex-col gap-2 text-sm"
      >
        <h2 id="feeds-heading" className="text-base font-bold">
          Daten weiterverwenden
        </h2>
        <p>
          Was rothenburg.digital aus den offenen Daten aufbereitet (bereinigte
          Namen und Adressen, lesbare Öffnungszeiten, nur plausible Koordinaten),
          steht in Standardformaten bereit. Andere Systeme können die Feeds
          direkt übernehmen; sie werden bei jedem Abruf aus den aktuellen Daten
          gebaut.
        </p>
        <ul className="list-inside list-disc">
          {FEED_NAMES.map((name) => (
            <li key={name}>
              <a href={feedPath(name)} className="underline">
                {FEED_INFO[name].title}
              </a>{" "}
              (GeoJSON)
              {ICAL_FEEDS.includes(name) && (
                <>
                  {" "}
                  und{" "}
                  <a href={icalPath(name)} className="underline">
                    als Kalender zum Abonnieren
                  </a>{" "}
                  (iCalendar)
                </>
              )}
            </li>
          ))}
          <li>
            <a href={CATALOG_PATH} className="underline">
              Katalog aller Feeds
            </a>{" "}
            (DCAT-AP, JSON-LD), damit Datenportale sie finden
          </li>
        </ul>
        <p>
          Die Termine stammen aus dem Datensatz „Top Events Rothenburg“. Er
          enthält bisher nur wenige Veranstaltungen, vor allem die einzelnen
          Tage des Reiterlesmarkts. Der Kalender zeigt laufende und kommende
          Termine und aktualisiert sich von selbst, sobald die Stadt weitere
          einträgt. Die Adresse des Kalenders lässt sich in Kalender-Apps als
          Abonnement hinzufügen.
        </p>
        <p>
          Der Katalog ist das Inhaltsverzeichnis der Feeds nach einer EU-Norm
          (DCAT-AP). Datenportale lesen ihn automatisch und nehmen die Feeds so
          in ihr Verzeichnis auf. Er wird jede Woche automatisch mit dem
          Prüfwerkzeug der EU geprüft:{" "}
          {dcatResult.status === "ok"
            ? `er besteht die Prüfung (Ergebnis unverändert seit ${germanDate(dcatResult.geprueft)}).`
            : `zuletzt mit Verstößen (seit ${germanDate(dcatResult.geprueft)}), sie werden behoben.`}{" "}
          Das prüft nur die Beschreibung der Feeds. Ob die Daten selbst
          stimmen, zeigt der Bericht oben.
        </p>
        <p>
          Lizenz und Quelle stehen an jedem Eintrag und in jeder Datei. Mischt
          ein Feed mehrere Datensätze, gilt für ihn die strengste Lizenz. So
          steht der Feed zum Einkaufen (Stand November 2026) unter CC BY-SA 4.0
          und darf nur unter derselben Lizenz weitergegeben werden. Die Bereichsseiten enthalten
          dieselben Angaben zusätzlich als schema.org.
        </p>
      </section>

      <section aria-labelledby="weitere-heading" className="flex max-w-3xl flex-col gap-2 text-sm">
        <h2 id="weitere-heading" className="text-base font-bold">
          Weitere Daten im Portal
        </h2>
        <p>
          Diese Daten zeigt das Portal der Stadt ebenfalls oder die Suche findet
          sie. Sie stehen nicht im Katalog der Stadt und werden nicht geprüft.
        </p>
        <ul className="list-inside list-disc">
          {OTHER_SOURCES.map((source) => (
            <li key={source.title}>
              <span className="font-semibold">{source.title}</span> ({source.publisher}):{" "}
              {source.note}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="methode-heading" className="flex max-w-3xl flex-col gap-2 text-sm">
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
    </PageShell>
  );
}
