import type { ReactNode } from "react";

import { TRAFFIC } from "@/components/daten/Marks";
import { CHART_TITLE, chartSvg, type ChartData, type ChartName } from "@/lib/opendata/charts";
import { germanDate } from "@/lib/opendata/common";
import { SEVERITIES, TRAFFIC_ORDER } from "@/lib/opendata/dashboard";
import type { HistoryEntry } from "@/lib/opendata/quality";

const PLURAL = { fehler: "Fehler", warnung: "Warnungen", hinweis: "Hinweise" } as const;

/**
 * Ein Chart aus `src/lib/opendata/charts.ts` mit Bildunterschrift und den
 * Links zum Export als SVG und PNG (#93). Das SVG ist eigener, serverseitig
 * gebauter Text ohne fremde Inhalte (nur Zahlen, Daten, feste Wörter).
 */
export function ChartFigure({
  name,
  data,
  className = "",
  children,
}: {
  name: ChartName;
  data: ChartData;
  className?: string;
  children?: ReactNode;
}) {
  const title = CHART_TITLE[name];
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <div
        className="w-full max-w-xl [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: chartSvg(name, data, { frame: false }) }}
      />
      {children}
      <p className="flex flex-wrap gap-x-4 text-sm print:hidden">
        {(["svg", "png"] as const).map((format) => (
          <a key={format} href={`/daten/charts/${name}.${format}`} download className="underline">
            {/* Linkzweck aus dem Link allein erkennbar (WCAG 2.4.9) */}
            <span className="sr-only">{title} </span>
            Als {format.toUpperCase()}
          </a>
        ))}
      </p>
    </figure>
  );
}

function HistoryTable({
  caption,
  history,
  columns,
}: {
  caption: string;
  history: HistoryEntry[];
  columns: { label: string; value: (entry: HistoryEntry) => number }[];
}) {
  return (
    <table className="w-full max-w-xl text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-[color:var(--color-border)]">
          <th scope="col" className="py-1 text-left">
            Bericht
          </th>
          {columns.map((column) => (
            <th key={column.label} scope="col" className="py-1 text-right">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {history.map((entry) => (
          <tr key={entry.date} className="border-b border-[color:var(--color-border)]">
            <th scope="row" className="py-1 text-left font-normal">
              {germanDate(entry.date)}
            </th>
            {columns.map((column) => (
              <td key={column.label} className="py-1 text-right tabular-nums">
                {column.value(entry)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Verlauf aus `reports/verlauf.json` (#80, #84, #93): Befunde je Stufe als
 * Linie, die Ampel als gestapelte Fläche (ab zwei Berichten, vorher ein
 * Balken), je mit gleichwertiger Tabelle. Eine Lücke heißt „nichts geändert“.
 */
export function QualityHistory({ data }: { data: ChartData }) {
  const { history } = data;
  if (history.length === 0) return <p className="text-sm">Noch kein Verlauf vorhanden.</p>;
  const latest = history[history.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        {history.length === 1
          ? `Bisher ein Bericht vom ${germanDate(latest.date)}. Der Verlauf füllt sich mit jedem wöchentlichen Lauf.`
          : `${history.length} Berichte vom ${germanDate(history[0].date)} bis ${germanDate(latest.date)}.`}{" "}
        Eine Lücke heißt, dass sich in der Woche nichts geändert hat.
      </p>

      <ChartFigure name="befunde-verlauf" data={data}>
        <HistoryTable
          caption="Befunde je Stufe nach Datum des Berichts"
          history={history}
          columns={SEVERITIES.map((severity) => ({
            label: PLURAL[severity],
            value: (entry) => entry.findings[severity],
          }))}
        />
      </ChartFigure>

      <ChartFigure name="ampel-verlauf" data={data}>
        <HistoryTable
          caption="Ampel der Datensätze nach Datum des Berichts"
          history={history}
          columns={TRAFFIC_ORDER.map((status) => ({
            label: TRAFFIC[status].label,
            value: (entry) => entry.status[status],
          }))}
        />
      </ChartFigure>
    </div>
  );
}
