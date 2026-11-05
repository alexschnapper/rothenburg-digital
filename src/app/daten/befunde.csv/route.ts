import type { NextRequest } from "next/server";

import { filterDatasets, findingsCsv, parseFilter } from "@/lib/opendata/dashboard";
import type { QualityReport } from "@/lib/opendata/quality";
import reportJson from "../../../../reports/datenqualitaet.json";

const report = reportJson as QualityReport;

/**
 * CSV-Export der Befunde (#84), aus dem eingecheckten Bericht wie `/daten`.
 * Dieselben Filter wie die Seite (`/daten/befunde.csv?regel=veraltet`), ohne
 * Filter alle Befunde.
 */
export function GET(request: NextRequest) {
  const filter = parseFilter(Object.fromEntries(request.nextUrl.searchParams), report);
  const csv = findingsCsv(report, filterDatasets(report, filter));
  const date = report.generatedAt.slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="befunde-${date}.csv"`,
    },
  });
}
