import { z } from "zod";

import {
  SEARCH_API,
  datasetPageUrl,
  fetchJson,
  isAcceptableDownloadUrl,
  toLicense,
} from "@/lib/opendata/bydata";
import { germanDate } from "@/lib/opendata/common";
import { parseOpeningHours } from "@/lib/opendata/openingHours";
import { CHARGING_DATASET, CHARGING_OVERVIEW_URL } from "@/lib/opendata/parking";

/**
 * Bericht zur Datenqualität der offenen Daten der Stadt (Issue #80).
 *
 * Bewusst nur feste Regeln, kein Sprachmodell: Ein Befund soll sich von jedem
 * nachprüfen lassen und bei gleichen Daten gleich ausfallen. Die Befunde
 * beschreiben die Daten, nicht die Menschen, die sie pflegen.
 *
 * Die Texte der Befunde enthalten nichts, was sich von Tag zu Tag ändert (kein
 * „vor 51 Tagen"). So ändert sich der Bericht nur, wenn sich die Daten ändern,
 * und der wöchentliche Lauf öffnet nur dann einen PR.
 */

/** Katalog der Stadt bei bydata — dieselben 18 Datensätze wie auf rothenburg.bydata.de. */
export const CITY_CATALOG = "rothenburg-import";

export type Severity = "fehler" | "warnung" | "hinweis";

export type RuleId =
  | "nicht-abrufbar"
  | "leer"
  | "veraltet"
  | "lizenz-fehlt"
  | "lizenz-verteilungen"
  | "lizenz-eintrag"
  | "lizenz-eintrag-fehlt"
  | "beschreibung-datensatz"
  | "kontakt"
  | "koordinaten"
  | "adresse"
  | "postleitzahl"
  | "dublette"
  | "oeffnungszeiten"
  | "webadresse"
  | "beschreibung"
  | "termin-ohne-datum"
  | "termin-abgelaufen"
  | "referenz";

export type Finding = {
  rule: RuleId;
  severity: Severity;
  /** Ein Satz, sachlich, ohne Datum relativ zu heute. */
  message: string;
  /** Betroffene Einträge; 0 bei Befunden zum ganzen Datensatz. */
  count: number;
  /** Höchstens drei Namen betroffener Einträge, zum Nachschlagen. */
  examples: string[];
};

export type Traffic = "rot" | "gelb" | "gruen";

export type DatasetReport = {
  id: string;
  title: string;
  pageUrl: string;
  modified: string | null;
  periodicity: string | null;
  license: string | null;
  /** `null`, wenn die Daten nicht abrufbar waren. */
  items: number | null;
  status: Traffic;
  findings: Finding[];
};

export type QualityReport = {
  /** Zeitpunkt des Laufs (ISO). Gehört nicht zum Vergleich mit der Vorwoche. */
  generatedAt: string;
  catalog: string;
  datasets: DatasetReport[];
};

export type DatasetMeta = {
  id: string;
  title: string;
  description: string;
  modified: string | null;
  /** z. B. `weekly` laut DCAT-Frequenz */
  periodicity: string | null;
  hasContact: boolean;
  /** Lizenz je Distribution (JSON, CSV, …), kurz wie „CC BY 4.0". */
  licenses: string[];
  jsonUrl: string | null;
};

// ─── Metadaten aus der Such-API ────────────────────────────────────────────

const licenseSchema = z
  .object({
    label: z.string().optional(),
    homepage: z.string().optional(),
    resource: z.string().optional(),
  })
  .nullish();

const searchSchema = z.object({
  result: z.object({
    count: z.number(),
    results: z.array(
      z.object({
        id: z.string(),
        title: z.record(z.string(), z.string()).optional(),
        description: z.record(z.string(), z.string()).optional(),
        modified: z.string().optional(),
        accrual_periodicity: z.object({ label: z.string().optional() }).nullish(),
        contact_point: z.array(z.unknown()).nullish(),
        distributions: z.array(
          z.object({
            format: z.object({ id: z.string() }).optional(),
            download_url: z.array(z.string()).optional(),
            access_url: z.array(z.string()).optional(),
            license: licenseSchema,
          }),
        ),
      }),
    ),
  }),
});

/** Antwort der Such-API → Metadaten je Datensatz, nach Titel sortiert. */
export function toDatasetMetas(raw: unknown): DatasetMeta[] {
  const { result } = searchSchema.parse(raw);
  return result.results
    .map((entry) => {
      const json = entry.distributions.find(
        (distribution) => distribution.format?.id.toUpperCase() === "JSON",
      );
      const licenses = entry.distributions
        .map((distribution) => toLicense(distribution.license)?.label)
        .filter((label): label is string => Boolean(label));
      return {
        id: entry.id,
        title: entry.title?.de ?? entry.id,
        description: entry.description?.de?.trim() ?? "",
        modified: entry.modified?.slice(0, 10) ?? null,
        periodicity: entry.accrual_periodicity?.label ?? null,
        hasContact: (entry.contact_point?.length ?? 0) > 0,
        licenses,
        jsonUrl:
          [...(json?.download_url ?? []), ...(json?.access_url ?? [])].find(
            isAcceptableDownloadUrl,
          ) ?? null,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
}

// ─── Regeln ────────────────────────────────────────────────────────────────

/** Spätestens nach so vielen Tagen erwartet man laut Frequenz eine Änderung. */
const PERIOD_DAYS: Record<string, number> = { daily: 3, weekly: 14, monthly: 62 };
const PERIOD_LABEL: Record<string, string> = {
  daily: "täglich",
  weekly: "wöchentlich",
  monthly: "monatlich",
};

/**
 * Großzügiger Rahmen um Rothenburg samt Ortsteilen und Nachbarorten
 * (Direktvermarkter in Ohrenbach u. Ä.). Was außerhalb liegt, ist fast immer
 * ein Tippfehler oder vertauschte Koordinaten.
 */
const AREA = { latMin: 49.25, latMax: 49.55, lonMin: 10.0, lonMax: 10.4 };

/**
 * Was laut einer offiziellen Quelle im Datensatz stehen müsste. Von Hand
 * gepflegt: Fehlt etwas, prüft man die Quelle und passt die Liste an.
 */
export const REFERENCES: { dataset: string; source: string; expected: string[] }[] = [
  {
    dataset: CHARGING_DATASET,
    source: CHARGING_OVERVIEW_URL,
    expected: ["P1", "P4", "P5", "Bahnhof"],
  },
];

const itemSchema = z
  .object({
    id: z.unknown(),
    name: z.unknown(),
    lat: z.unknown(),
    lon: z.unknown(),
    geometry_type: z.unknown(),
    street: z.unknown(),
    postal_code: z.unknown(),
    city: z.unknown(),
    url: z.unknown(),
    opening_hours: z.unknown(),
    short_description: z.unknown(),
    description: z.unknown(),
    license: z.unknown(),
    start_date: z.unknown(),
    end_date: z.unknown(),
  })
  .partial();

type Item = z.infer<typeof itemSchema>;

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Namen aus fremden Daten landen im Markdown, in PRs und Issue-Kommentaren.
 * Ohne Markdown-Zeichen und `@`, damit ein Name dort weder verlinkt noch
 * jemanden auf GitHub benachrichtigt.
 */
export const cleanExample = (name: string) =>
  name.replace(/[[\]()<>`*_|@#!\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "(ohne Name)";

/** „CC0 1.0" und „CC0" sind dieselbe Lizenz. */
const sameLicense = (a: string, b: string) =>
  a.replace(/^CC0.*/i, "CC0").toUpperCase() === b.replace(/^CC0.*/i, "CC0").toUpperCase();

function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / 86_400_000);
}

/** Befund über die Einträge, auf die `match` zutrifft — oder keiner. */
function itemFinding(
  items: Item[],
  match: (item: Item) => boolean,
  finding: Omit<Finding, "count" | "examples">,
): Finding[] {
  const hits = items.filter(match);
  if (hits.length === 0) return [];
  const examples = [...new Set(hits.map((item) => cleanExample(str(item.name))))].slice(0, 3);
  return [{ ...finding, count: hits.length, examples }];
}

function isValidWebAddress(raw: string): boolean {
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Gleiche ID oder gleicher Name, jeweils am selben Tag. Termine einer Reihe
 * (Reiterlesmarkt) teilen sich ID und Namen und stehen einmal pro Tag drin —
 * das ist keine Dublette.
 */
function duplicates(items: Item[]): Item[] {
  const keys = (item: Item) => [
    `id|${str(item.id)}|${str(item.start_date)}`,
    `name|${str(item.name).toLowerCase()}|${str(item.start_date)}`,
  ];
  const seen = new Map<string, number>();
  for (const item of items) {
    for (const key of keys(item)) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return items.filter((item) => keys(item).some((key) => (seen.get(key) ?? 0) > 1));
}

/** Alle Befunde für einen Datensatz. `rawItems` ist `null`, wenn der Abruf scheiterte. */
export function checkDataset(meta: DatasetMeta, rawItems: unknown[] | null, now: Date): Finding[] {
  const findings: Finding[] = [];
  const datasetLicense = meta.licenses[0] ?? null;

  // Metadaten
  if (!meta.description) {
    findings.push({
      rule: "beschreibung-datensatz",
      severity: "hinweis",
      message: "Der Datensatz hat keine Beschreibung.",
      count: 0,
      examples: [],
    });
  }
  if (!meta.hasContact) {
    findings.push({
      rule: "kontakt",
      severity: "hinweis",
      message: "Der Datensatz nennt keinen Kontakt für Rückfragen.",
      count: 0,
      examples: [],
    });
  }
  if (!datasetLicense) {
    findings.push({
      rule: "lizenz-fehlt",
      severity: "warnung",
      message: "Der Datensatz nennt keine Lizenz. Ohne Lizenz ist unklar, ob die Daten weiterverwendet werden dürfen.",
      count: 0,
      examples: [],
    });
  } else if (meta.licenses.some((label) => !sameLicense(label, datasetLicense))) {
    findings.push({
      rule: "lizenz-verteilungen",
      severity: "warnung",
      message: `Die Dateiformate stehen unter verschiedenen Lizenzen (${[...new Set(meta.licenses)].join(", ")}).`,
      count: 0,
      examples: [],
    });
  }
  const period = meta.periodicity?.toLowerCase() ?? "";
  if (meta.modified && PERIOD_DAYS[period] && daysBetween(meta.modified, now) > PERIOD_DAYS[period]) {
    findings.push({
      rule: "veraltet",
      severity: "warnung",
      message: `Als „${PERIOD_LABEL[period]}" aktualisiert angegeben, zuletzt geändert am ${germanDate(meta.modified)}. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.`,
      count: 0,
      examples: [],
    });
  }

  if (rawItems === null) {
    findings.push({
      rule: "nicht-abrufbar",
      severity: "fehler",
      message: "Die Daten im JSON-Format waren beim Abruf nicht erreichbar oder nicht lesbar.",
      count: 0,
      examples: [],
    });
    return findings;
  }
  if (rawItems.length === 0) {
    findings.push({
      rule: "leer",
      severity: "fehler",
      message: "Der Datensatz enthält keine Einträge.",
      count: 0,
      examples: [],
    });
    return findings;
  }

  const items = rawItems.map((raw) => itemSchema.safeParse(raw).data ?? {});
  const isPoint = (item: Item) => str(item.geometry_type) !== "LineString";
  const isEvent = (item: Item) => item.start_date !== undefined;
  const duplicated = new Set(duplicates(items));

  // Inhalt je Eintrag
  findings.push(
    ...itemFinding(
      items,
      (item) => {
        const { lat, lon } = item;
        if (typeof lat !== "number" || typeof lon !== "number") return true;
        return lat < AREA.latMin || lat > AREA.latMax || lon < AREA.lonMin || lon > AREA.lonMax;
      },
      {
        rule: "koordinaten",
        severity: "fehler",
        message: "Koordinaten fehlen oder liegen weit außerhalb von Rothenburg.",
      },
    ),
    ...itemFinding(
      items,
      (item) => isPoint(item) && !isEvent(item) && (!str(item.street) || !str(item.city)),
      {
        rule: "adresse",
        // Türme und Tore haben oft keine Hausadresse, deshalb nur ein Hinweis.
        severity: "hinweis",
        message: "Straße oder Ort fehlen in der Adresse.",
      },
    ),
    ...itemFinding(
      items,
      (item) => str(item.postal_code) !== "" && !/^\d{5}$/.test(str(item.postal_code)),
      {
        rule: "postleitzahl",
        severity: "fehler",
        message: "Die Postleitzahl hat nicht fünf Ziffern.",
      },
    ),
    ...itemFinding(items, (item) => duplicated.has(item), {
      rule: "dublette",
      severity: "warnung",
      message: "Einträge kommen doppelt vor (gleiche ID oder gleicher Name am selben Tag).",
    }),
    ...itemFinding(
      items,
      (item) => str(item.opening_hours) !== "" && parseOpeningHours(str(item.opening_hours)) === null,
      {
        rule: "oeffnungszeiten",
        severity: "warnung",
        message: "Öffnungszeiten stehen in einer Form, die sich nicht maschinell lesen lässt.",
      },
    ),
    ...itemFinding(items, (item) => str(item.url) !== "" && !isValidWebAddress(str(item.url)), {
      rule: "webadresse",
      severity: "hinweis",
      message: "Webadressen ohne „https://“ oder nicht als Adresse lesbar.",
    }),
    ...itemFinding(items, (item) => !str(item.short_description) && !str(item.description), {
      rule: "beschreibung",
      severity: "hinweis",
      message: "Einträge ohne jede Beschreibung.",
    }),
    ...itemFinding(items, (item) => !str(item.license), {
      rule: "lizenz-eintrag-fehlt",
      severity: "hinweis",
      message: "Einträge ohne eigene Lizenzangabe.",
    }),
  );

  if (datasetLicense) {
    findings.push(
      ...itemFinding(
        items,
        (item) => str(item.license) !== "" && !sameLicense(str(item.license), datasetLicense),
        {
          rule: "lizenz-eintrag",
          severity: "warnung",
          message: `Einträge nennen eine andere Lizenz als der Datensatz (${datasetLicense}).`,
        },
      ),
    );
  }

  // Termine
  const today = now.toISOString().slice(0, 10);
  findings.push(
    ...itemFinding(items, (item) => isEvent(item) && !str(item.start_date), {
      rule: "termin-ohne-datum",
      severity: "hinweis",
      message: "Termine ohne Datum.",
    }),
    ...itemFinding(
      items,
      (item) => {
        const end = str(item.end_date) || str(item.start_date);
        return isEvent(item) && end !== "" && end.slice(0, 10) < today;
      },
      {
        rule: "termin-abgelaufen",
        severity: "hinweis",
        message: "Termine, die schon vorbei sind.",
      },
    ),
  );

  // Vollständigkeit gegen offizielle Quellen
  for (const reference of REFERENCES.filter((entry) => entry.dataset === meta.id)) {
    const haystack = items
      .map((item) => `${str(item.name)} ${str(item.street)} ${str(item.description)}`)
      .join(" ")
      .toLowerCase();
    const missing = reference.expected.filter(
      (needle) => !new RegExp(`\\b${needle.toLowerCase()}\\b`).test(haystack),
    );
    if (missing.length > 0) {
      findings.push({
        rule: "referenz",
        severity: "warnung",
        message: `Laut ${reference.source} fehlen: ${missing.join(", ")}.`,
        count: missing.length,
        examples: [],
      });
    }
  }

  return findings;
}

export function trafficLight(findings: Finding[]): Traffic {
  if (findings.some((finding) => finding.severity === "fehler")) return "rot";
  if (findings.some((finding) => finding.severity === "warnung")) return "gelb";
  return "gruen";
}

// ─── Abruf und Bericht ─────────────────────────────────────────────────────

export function datasetReport(meta: DatasetMeta, rawItems: unknown[] | null, now: Date): DatasetReport {
  const findings = checkDataset(meta, rawItems, now);
  return {
    id: meta.id,
    title: meta.title,
    pageUrl: datasetPageUrl(meta.id),
    modified: meta.modified,
    periodicity: meta.periodicity,
    license: meta.licenses[0] ?? null,
    items: rawItems?.length ?? null,
    status: trafficLight(findings),
    findings,
  };
}

/** Alle Datensätze der Stadt abrufen und prüfen. Wirft nur, wenn die Liste selbst fehlt. */
export async function buildQualityReport(now = new Date()): Promise<QualityReport> {
  const facets = encodeURIComponent(JSON.stringify({ catalog: [CITY_CATALOG] }));
  const metas = toDatasetMetas(
    await fetchJson(`${SEARCH_API}/search?filter=dataset&limit=100&facets=${facets}`),
  );
  const datasets: DatasetReport[] = [];
  // Nacheinander statt parallel: schont den Dateiserver der Stadt.
  for (const meta of metas) {
    let items: unknown[] | null = null;
    if (meta.jsonUrl) {
      try {
        const raw = await fetchJson(meta.jsonUrl);
        items = Array.isArray(raw) ? raw : null;
      } catch (error) {
        console.error(`[datenqualitaet] ${meta.id}:`, error);
      }
    }
    datasets.push(datasetReport(meta, items, now));
  }
  return { generatedAt: now.toISOString(), catalog: CITY_CATALOG, datasets };
}

// ─── Vergleich mit dem letzten Bericht ─────────────────────────────────────

export type ReportChange = { dataset: string; title: string; finding: Finding };
export type ReportDiff = { added: ReportChange[]; resolved: ReportChange[] };

const changeKey = (dataset: string, finding: Finding) => `${dataset}:${finding.rule}`;

function flatten(report: QualityReport | null): Map<string, ReportChange> {
  const map = new Map<string, ReportChange>();
  for (const dataset of report?.datasets ?? []) {
    for (const finding of dataset.findings) {
      map.set(changeKey(dataset.id, finding), { dataset: dataset.id, title: dataset.title, finding });
    }
  }
  return map;
}

/** Neue und behobene Befunde. Eine geänderte Anzahl zählt nicht als neu. */
export function diffReports(previous: QualityReport | null, current: QualityReport): ReportDiff {
  const before = flatten(previous);
  const after = flatten(current);
  return {
    added: [...after].filter(([key]) => !before.has(key)).map(([, change]) => change),
    resolved: [...before].filter(([key]) => !after.has(key)).map(([, change]) => change),
  };
}

/** Gleich bis auf den Zeitpunkt des Laufs? Dann braucht es keinen neuen PR. */
export function sameContent(a: QualityReport | null, b: QualityReport): boolean {
  if (!a) return false;
  return JSON.stringify(a.datasets) === JSON.stringify(b.datasets) && a.catalog === b.catalog;
}

// ─── Verlauf ───────────────────────────────────────────────────────────────

/**
 * Eine Zeile je Bericht in `reports/verlauf.json`: Grundlage für den Verlauf
 * im Dashboard („seit Dezember 9 Befunde behoben"). Bewusst nur Zahlen und die
 * Ampel je Datensatz, die Befunde selbst stehen in der Git-Historie des
 * Berichts.
 */
export type HistoryEntry = {
  /** Tag des Laufs, `YYYY-MM-DD` */
  date: string;
  status: Record<Traffic, number>;
  findings: Record<Severity, number>;
  datasets: Record<string, Traffic>;
};

export function historyEntry(report: QualityReport): HistoryEntry {
  const status: Record<Traffic, number> = { rot: 0, gelb: 0, gruen: 0 };
  const findings: Record<Severity, number> = { fehler: 0, warnung: 0, hinweis: 0 };
  const datasets: Record<string, Traffic> = {};
  for (const dataset of report.datasets) {
    status[dataset.status] += 1;
    datasets[dataset.id] = dataset.status;
    for (const finding of dataset.findings) findings[finding.severity] += 1;
  }
  return { date: report.generatedAt.slice(0, 10), status, findings, datasets };
}

/** Hängt an; ein zweiter Lauf am selben Tag ersetzt den ersten. */
export function appendHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [...history.filter((row) => row.date !== entry.date), entry].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

// ─── Lesbare Fassung ───────────────────────────────────────────────────────

export const TRAFFIC_LABEL: Record<Traffic, string> = {
  rot: "🔴 Fehler",
  gelb: "🟡 Warnung",
  gruen: "🟢 in Ordnung",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  fehler: "Fehler",
  warnung: "Warnung",
  hinweis: "Hinweis",
};

const escapeCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");

function findingLine(finding: Finding): string {
  const count = finding.count > 0 && finding.rule !== "referenz" ? ` (${finding.count})` : "";
  const examples = finding.examples.length > 0 ? ` Zum Beispiel: ${finding.examples.join("; ")}.` : "";
  return `**${SEVERITY_LABEL[finding.severity]}:** ${finding.message}${count}${examples}`;
}

export function changesMarkdown(diff: ReportDiff, first = false): string {
  if (first) return "Erster Bericht, noch kein Vergleich.\n";
  const lines: string[] = [];
  if (diff.added.length > 0) {
    lines.push("**Neu:**", "");
    for (const change of diff.added) lines.push(`- ${change.title}: ${findingLine(change.finding)}`);
    lines.push("");
  }
  if (diff.resolved.length > 0) {
    lines.push("**Behoben:**", "");
    for (const change of diff.resolved) lines.push(`- ${change.title}: ${change.finding.message}`);
    lines.push("");
  }
  return lines.length > 0 ? lines.join("\n") : "Keine Änderungen gegenüber dem letzten Bericht.\n";
}

export function reportMarkdown(report: QualityReport, diff: ReportDiff, first = false): string {
  const date = germanDate(report.generatedAt.slice(0, 10));
  const counts = { rot: 0, gelb: 0, gruen: 0 };
  for (const dataset of report.datasets) counts[dataset.status] += 1;

  const lines = [
    "# Datenqualität der offenen Daten",
    "",
    `Automatisch erstellt am ${date} von \`scripts/datenqualitaet.mts\` (Issue #80). Nicht von Hand bearbeiten.`,
    "",
    `Geprüft: ${report.datasets.length} Datensätze der Stadt Rothenburg ob der Tauber bei [bydata](https://rothenburg.bydata.de/). ` +
      `${counts.rot} mit Fehlern, ${counts.gelb} mit Warnungen, ${counts.gruen} in Ordnung. ` +
      "Die Regeln stehen in `src/lib/opendata/quality.ts`. Die Befunde beschreiben die Daten, nicht die Menschen, die sie pflegen.",
    "",
    "## Änderungen gegenüber dem letzten Bericht",
    "",
    changesMarkdown(diff, first),
    "## Übersicht",
    "",
    "| Datensatz | Stand | Einträge | Lizenz | Ergebnis |",
    "|---|---|---|---|---|",
    ...report.datasets.map(
      (dataset) =>
        `| [${escapeCell(dataset.title)}](${dataset.pageUrl}) | ${germanDate(dataset.modified) ?? "–"} | ${dataset.items ?? "–"} | ${dataset.license ?? "–"} | ${TRAFFIC_LABEL[dataset.status]} |`,
    ),
    "",
    "## Befunde je Datensatz",
    "",
  ];
  for (const dataset of report.datasets) {
    if (dataset.findings.length === 0) continue;
    lines.push(`### ${dataset.title}`, "");
    for (const finding of dataset.findings) lines.push(`- ${findingLine(finding)}`);
    lines.push("");
  }
  return lines.join("\n");
}
