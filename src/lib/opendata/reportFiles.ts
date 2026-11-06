import dcatJson from "../../../reports/dcat-ap.json";
import reportJson from "../../../reports/datenqualitaet.json";
import historyJson from "../../../reports/verlauf.json";

import type { ChartData } from "@/lib/opendata/charts";
import type { HistoryEntry, QualityReport, Traffic } from "@/lib/opendata/quality";

/**
 * Der eingecheckte Bericht und sein Verlauf (#80). Bewusst kein Live-Abruf:
 * Der wöchentliche Lauf legt einen PR an, und erst nach der Durchsicht stehen
 * neue Befunde auf `/daten`, im CSV- und im Chart-Export.
 */
export const report = reportJson as QualityReport;
export const history = historyJson as HistoryEntry[];

/**
 * Letzte Prüfung des eigenen DCAT-AP-Katalogs (#107, `scripts/dcat-pruefen.mts`).
 * Ändert sich nur, wenn sich Status oder Verstöße ändern; `geprueft` ist also
 * der Tag der letzten Änderung, nicht der letzten Prüfung.
 */
export const dcatResult = dcatJson as { geprueft: string; status: "ok" | "verstoesse" };

/** Daten für die Charts: Verlauf, Ampel heute und Stand des Berichts. */
export function chartData(): ChartData {
  const today: Record<Traffic, number> = { rot: 0, gelb: 0, gruen: 0 };
  for (const dataset of report.datasets) today[dataset.status] += 1;
  return { history, today, date: report.generatedAt.slice(0, 10) };
}
