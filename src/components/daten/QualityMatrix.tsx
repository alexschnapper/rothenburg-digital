import Link from "next/link";

import { SEVERITY_MARK } from "@/components/daten/Marks";
import {
  RULE_LABEL,
  countText,
  filterQuery,
  findingAnchor,
  type DashboardFilter,
  type MatrixColumn,
} from "@/lib/opendata/dashboard";
import { SEVERITY_LABEL, type DatasetReport } from "@/lib/opendata/quality";

type Props = {
  datasets: DatasetReport[];
  columns: MatrixColumn[];
  filter: DashboardFilter;
  /** Bezugsgröße für „14 von 18“: alle geprüften bzw. die gewählten Datensätze */
  total: number;
};

/**
 * Hauptansicht (#84): Zeilen sind Datensätze, Spalten Prüfregeln, die Zelle
 * zeigt die Schwere. Eine Zelle springt zum Befund in der Detailansicht, ein
 * Spaltenkopf filtert nach der Regel. Auf dem Handy ersetzt `RuleList` die
 * Tabelle.
 */
export function QualityMatrix({ datasets, columns, filter, total }: Props) {
  if (columns.length === 0) {
    return <p className="text-sm">Für diese Auswahl gibt es keine Befunde.</p>;
  }
  return (
    // Breiter als der Bildschirm? Dann per Tastatur scrollbar (WCAG 2.1.1).
    <div
      role="region"
      aria-labelledby="matrix-caption"
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-[color:var(--color-border)] print:overflow-visible print:border-0"
    >
      <table className="w-full border-collapse text-sm">
        <caption id="matrix-caption" className="sr-only">
          Befunde je Datensatz und Prüfregel. Zeilen sind Datensätze, Spalten
          Prüfregeln; jede Zelle nennt die Schwere und verlinkt den Befund.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-[color:var(--color-bg)] p-2 text-left align-bottom">
              Datensatz
            </th>
            {columns.map((column) => (
              <th
                key={column.rule}
                scope="col"
                className="h-44 border-l border-[color:var(--color-border)] p-1 align-bottom font-semibold"
              >
                <Link
                  href={`/daten${filterQuery({ ...filter, regel: column.rule })}#matrix-heading`}
                  className="mx-auto block rotate-180 whitespace-nowrap text-left underline underline-offset-2 [writing-mode:vertical-rl]"
                >
                  <span className="sr-only">Nach Regel filtern: </span>
                  {RULE_LABEL[column.rule]}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datasets.map((dataset) => {
            const byRule = new Map(dataset.findings.map((finding) => [finding.rule, finding]));
            return (
              <tr key={dataset.id} className="border-t border-[color:var(--color-border)]">
                <th
                  scope="row"
                  className="sticky left-0 bg-[color:var(--color-bg)] p-2 text-left font-normal"
                >
                  <a href={`#${dataset.id}`} className="underline underline-offset-2">
                    {dataset.title}
                  </a>
                </th>
                {columns.map((column) => {
                  const finding = byRule.get(column.rule);
                  if (!finding) {
                    return (
                      <td key={column.rule} className="border-l border-[color:var(--color-border)] p-1 text-center">
                        <span aria-hidden="true" className="text-muted">
                          ·
                        </span>
                        <span className="sr-only">kein Befund</span>
                      </td>
                    );
                  }
                  const mark = SEVERITY_MARK[finding.severity];
                  const count = countText(finding);
                  return (
                    <td key={column.rule} className="border-l border-[color:var(--color-border)] p-1 text-center">
                      <a
                        href={`#${findingAnchor(dataset.id, finding.rule)}`}
                        className={`inline-flex min-h-8 min-w-11 items-center justify-center gap-1 rounded border-2 px-1.5 font-bold ${mark.className}`}
                      >
                        <span aria-hidden="true">{mark.icon}</span>
                        <span aria-hidden="true">{finding.count > 0 && finding.rule !== "referenz" ? finding.count : ""}</span>
                        {/* Linkzweck aus dem Link allein erkennbar (WCAG 2.4.9) */}
                        <span className="sr-only">
                          {SEVERITY_LABEL[finding.severity]}: {RULE_LABEL[finding.rule]} bei {dataset.title}
                          {count ? `, ${count}` : ""}
                        </span>
                      </a>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[color:var(--color-border)]">
            <th scope="row" className="sticky left-0 bg-[color:var(--color-bg)] p-2 text-left">
              Betroffen
            </th>
            {columns.map((column) => (
              <td key={column.rule} className="border-l border-[color:var(--color-border)] p-1 text-center font-semibold">
                {column.datasets}
                <span className="sr-only"> von {total} Datensätzen</span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Die Matrix als Liste für schmale Bildschirme: je Regel, wie viele Datensätze betroffen sind. */
export function RuleList({ columns, filter, total }: Omit<Props, "datasets">) {
  if (columns.length === 0) {
    return <p className="text-sm">Für diese Auswahl gibt es keine Befunde.</p>;
  }
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {columns.map((column) => {
        const mark = SEVERITY_MARK[column.severity];
        return (
          <li key={column.rule} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 font-bold ${mark.className}`}
            >
              {mark.icon}
            </span>
            <Link
              href={`/daten${filterQuery({ ...filter, regel: column.rule })}#matrix-heading`}
              className="underline underline-offset-2"
            >
              {RULE_LABEL[column.rule]}
            </Link>
            <span>
              ({SEVERITY_LABEL[column.severity]}): {column.datasets} von {total}{" "}
              Datensätzen
            </span>
          </li>
        );
      })}
    </ul>
  );
}
