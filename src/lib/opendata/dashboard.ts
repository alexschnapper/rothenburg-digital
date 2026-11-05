import { germanDate } from "@/lib/opendata/common";
import {
  SEVERITY_LABEL,
  type DatasetReport,
  type Finding,
  type QualityReport,
  type RuleId,
  type Severity,
  type Traffic,
} from "@/lib/opendata/quality";

/**
 * Dashboard zur Datenqualität (Issue #84): Filter, Matrix Datensatz × Regel,
 * CSV-Export und Geometrie der Verlaufs-Charts.
 *
 * Alles hier ist reine Logik über dem eingecheckten Bericht. Die Seite
 * `/daten` rendert daraus serverseitig HTML und SVG, damit sie ohne
 * JavaScript lesbar bleibt.
 */

/** Kurze Spaltenköpfe der Matrix; der volle Satz steht im Befund. */
export const RULE_LABEL: Record<RuleId, string> = {
  "nicht-abrufbar": "Nicht abrufbar",
  leer: "Leer",
  veraltet: "Veraltet",
  "lizenz-fehlt": "Lizenz fehlt",
  "lizenz-verteilungen": "Lizenz je Format",
  "lizenz-eintrag": "Lizenz abweichend",
  "lizenz-eintrag-fehlt": "Lizenz im Eintrag fehlt",
  "beschreibung-datensatz": "Beschreibung Datensatz",
  kontakt: "Kontakt",
  koordinaten: "Koordinaten",
  "gleicher-punkt": "Gleicher Punkt",
  adresse: "Adresse",
  postleitzahl: "Postleitzahl",
  dublette: "Dubletten",
  oeffnungszeiten: "Öffnungszeiten",
  webadresse: "Webadresse",
  beschreibung: "Beschreibung Einträge",
  "termin-ohne-datum": "Termin ohne Datum",
  "termin-abgelaufen": "Termin vorbei",
  referenz: "Abgleich mit Quelle",
  "nicht-bewertet": "Nutzung offen",
};

export const SEVERITIES: Severity[] = ["fehler", "warnung", "hinweis"];
export const TRAFFIC_ORDER: Traffic[] = ["rot", "gelb", "gruen"];

const RULES = Object.keys(RULE_LABEL) as RuleId[];

// ─── Filter über die Adresse ───────────────────────────────────────────────

export type DashboardFilter = {
  schwere?: Severity;
  regel?: RuleId;
  datensatz?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Liest die Filter aus der Adresse (`/daten?regel=lizenz-eintrag`). Unbekannte
 * Werte fallen still weg: Ein veralteter Link zeigt dann eben alles, statt
 * auf einer Fehlerseite zu landen.
 */
export function parseFilter(params: SearchParams, report: QualityReport): DashboardFilter {
  const filter: DashboardFilter = {};
  const schwere = first(params.schwere);
  if (schwere && (SEVERITIES as string[]).includes(schwere)) filter.schwere = schwere as Severity;
  const regel = first(params.regel);
  if (regel && (RULES as string[]).includes(regel)) filter.regel = regel as RuleId;
  const datensatz = first(params.datensatz);
  if (datensatz && report.datasets.some((dataset) => dataset.id === datensatz)) {
    filter.datensatz = datensatz;
  }
  return filter;
}

export const isFiltered = (filter: DashboardFilter) =>
  Boolean(filter.schwere || filter.regel || filter.datensatz);

/** `?schwere=warnung&regel=veraltet` — leer ohne Filter. Feste Reihenfolge, damit Links gleich aussehen. */
export function filterQuery(filter: DashboardFilter): string {
  const params = new URLSearchParams();
  if (filter.schwere) params.set("schwere", filter.schwere);
  if (filter.regel) params.set("regel", filter.regel);
  if (filter.datensatz) params.set("datensatz", filter.datensatz);
  const query = params.toString();
  return query ? `?${query}` : "";
}

const matches = (finding: Finding, filter: DashboardFilter) =>
  (!filter.schwere || finding.severity === filter.schwere) &&
  (!filter.regel || finding.rule === filter.regel);

/**
 * Datensätze mit den passenden Befunden, die mit dem meisten Handlungsbedarf
 * zuerst. Filtert man nach Schwere oder Regel, fallen Datensätze ohne
 * passenden Befund weg — sonst bestünde die Matrix aus leeren Zeilen.
 */
export function filterDatasets(report: QualityReport, filter: DashboardFilter): DatasetReport[] {
  const byFinding = Boolean(filter.schwere || filter.regel);
  return report.datasets
    .filter((dataset) => !filter.datensatz || dataset.id === filter.datensatz)
    .map((dataset) => ({
      ...dataset,
      findings: dataset.findings.filter((finding) => matches(finding, filter)),
    }))
    .filter((dataset) => !byFinding || dataset.findings.length > 0)
    .sort(
      (a, b) =>
        TRAFFIC_ORDER.indexOf(a.status) - TRAFFIC_ORDER.indexOf(b.status) ||
        a.title.localeCompare(b.title, "de"),
    );
}

// ─── Matrix ────────────────────────────────────────────────────────────────

export type MatrixColumn = {
  rule: RuleId;
  /** Schwerste Stufe, mit der die Regel vorkommt */
  severity: Severity;
  /** In wie vielen der angezeigten Datensätze */
  datasets: number;
};

/**
 * Spalten der Matrix: nur Regeln mit mindestens einem Befund, die schweren
 * und häufigen zuerst. So steht „veraltet bei 14 von 18“ links und fällt auf.
 */
export function matrixColumns(datasets: DatasetReport[]): MatrixColumn[] {
  const columns = new Map<RuleId, MatrixColumn>();
  for (const dataset of datasets) {
    for (const finding of dataset.findings) {
      const column = columns.get(finding.rule);
      if (!column) {
        columns.set(finding.rule, { rule: finding.rule, severity: finding.severity, datasets: 1 });
        continue;
      }
      column.datasets += 1;
      if (SEVERITIES.indexOf(finding.severity) < SEVERITIES.indexOf(column.severity)) {
        column.severity = finding.severity;
      }
    }
  }
  return [...columns.values()].sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      b.datasets - a.datasets ||
      RULE_LABEL[a.rule].localeCompare(RULE_LABEL[b.rule], "de"),
  );
}

/** Sprungmarke eines Befunds in der Detailansicht, z. B. `skg-venus-museum--veraltet`. */
export const findingAnchor = (datasetId: string, rule: RuleId) => `${datasetId}--${rule}`;

/** „7 Einträge“, „1 Eintrag“ — leer bei Befunden zum ganzen Datensatz. */
export function countText(finding: Finding): string {
  if (finding.count === 0 || finding.rule === "referenz") return "";
  return finding.count === 1 ? "1 Eintrag" : `${finding.count} Einträge`;
}

// ─── CSV-Export ────────────────────────────────────────────────────────────

const CSV_HEADER = [
  "Datensatz-ID",
  "Datensatz",
  "Ampel",
  "Regel",
  "Regel (Bezeichnung)",
  "Schwere",
  "Betroffene Einträge",
  "Befund",
  "Beispiele",
  "Stand der Daten",
  "Bericht vom",
  "Datensatz im Portal",
];

const CSV_TRAFFIC: Record<Traffic, string> = { rot: "rot", gelb: "gelb", gruen: "grün" };

/**
 * Eine Zelle nach RFC 4180. Namen stammen aus fremden Daten: Beginnt eine
 * Zelle mit `=`, `+`, `-`, `@` oder einem Steuerzeichen, würde eine
 * Tabellenkalkulation sie als Formel ausführen. Ein vorangestelltes `'`
 * verhindert das (CSV-Injection).
 */
export function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Alle Befunde als CSV, eine Zeile je Befund. Semikolon und BOM, damit Excel
 * in deutscher Einstellung Spalten und Umlaute richtig erkennt.
 */
export function findingsCsv(report: QualityReport, datasets: DatasetReport[]): string {
  const generated = germanDate(report.generatedAt.slice(0, 10)) ?? "";
  const rows = [CSV_HEADER];
  for (const dataset of datasets) {
    for (const finding of dataset.findings) {
      rows.push([
        dataset.id,
        dataset.title,
        CSV_TRAFFIC[dataset.status],
        finding.rule,
        RULE_LABEL[finding.rule],
        SEVERITY_LABEL[finding.severity],
        finding.count > 0 && finding.rule !== "referenz" ? String(finding.count) : "",
        finding.message,
        finding.examples.join("; "),
        germanDate(dataset.modified) ?? "",
        generated,
        dataset.pageUrl,
      ]);
    }
  }
  return `﻿${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

// ─── Verlauf ───────────────────────────────────────────────────────────────

export type ChartBox = { width: number; height: number; padLeft: number; padRight: number; padTop: number; padBottom: number };

/** Obergrenze der y-Achse: glatte Zahl ab der Höchstzahl, mindestens 5. */
export function axisMax(values: number[]): number {
  const max = Math.max(5, ...values);
  const step = max <= 10 ? 5 : max <= 50 ? 10 : 50;
  return Math.ceil(max / step) * step;
}

/** x-Position je Lauf, gleichmäßig verteilt; ein einzelner Lauf steht mittig. */
export function xPositions(count: number, box: ChartBox): number[] {
  const inner = box.width - box.padLeft - box.padRight;
  if (count <= 1) return count === 1 ? [box.padLeft + inner / 2] : [];
  return Array.from({ length: count }, (_, index) => box.padLeft + (inner * index) / (count - 1));
}

export function yPosition(value: number, max: number, box: ChartBox): number {
  const inner = box.height - box.padTop - box.padBottom;
  return box.padTop + inner * (1 - value / max);
}

/** Kurzes Datum für die Achse: „05.11.“ */
export const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
