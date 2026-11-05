/**
 * Datenqualitäts-Bericht (Issue #80): prüft alle offenen Datensätze der Stadt
 * bei bydata und schreibt
 *
 *   reports/datenqualitaet.json   maschinenlesbar, Grundlage für /daten
 *   reports/verlauf.json          eine Zeile je geändertem Bericht, für den Verlauf
 *   docs/datenqualitaet.md        lesbar, mit Änderungen zum letzten Bericht
 *
 * Aufruf: `npm run datenqualitaet`. Ohne Secrets, ohne Modellkosten.
 *
 * Umgebungsvariablen (nur für den Workflow `.github/workflows/datenqualitaet.yml`):
 *   AENDERUNGEN_DATEI   schreibt die Änderungen als Markdown in diese Datei
 *   GITHUB_OUTPUT       setzt `changed` und `added` als Step-Ausgaben
 *
 * Ist der Inhalt bis auf den Zeitpunkt gleich, bleiben alle Dateien
 * unverändert, damit der Workflow keinen leeren PR öffnet. Im Verlauf heißt
 * eine Lücke zwischen zwei Zeilen also: in der Zeit nichts geändert.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendHistory,
  buildQualityReport,
  changesMarkdown,
  diffReports,
  historyEntry,
  reportMarkdown,
  sameContent,
  type HistoryEntry,
  type QualityReport,
} from "@/lib/opendata/quality";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, "reports/datenqualitaet.json");
const markdownPath = join(root, "docs/datenqualitaet.md");
const historyPath = join(root, "reports/verlauf.json");

const previous: QualityReport | null = existsSync(jsonPath)
  ? JSON.parse(readFileSync(jsonPath, "utf8"))
  : null;

const history: HistoryEntry[] = existsSync(historyPath)
  ? JSON.parse(readFileSync(historyPath, "utf8"))
  : [];

const report = await buildQualityReport();
const changed = !sameContent(previous, report);
const diff = diffReports(previous, report);

if (changed) {
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, reportMarkdown(report, diff, previous === null));
  writeFileSync(historyPath, `${JSON.stringify(appendHistory(history, historyEntry(report)), null, 2)}\n`);
}

const changes = changesMarkdown(diff, previous === null);
if (process.env.AENDERUNGEN_DATEI) writeFileSync(process.env.AENDERUNGEN_DATEI, changes);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nadded=${diff.added.length}\n`);
}

const counts = { rot: 0, gelb: 0, gruen: 0 };
for (const dataset of report.datasets) counts[dataset.status] += 1;
console.log(
  `${report.datasets.length} Datensätze: ${counts.rot} rot, ${counts.gelb} gelb, ${counts.gruen} grün. ` +
    (changed ? "Bericht aktualisiert." : "Keine Änderung, Dateien unverändert."),
);
console.log(changes);
