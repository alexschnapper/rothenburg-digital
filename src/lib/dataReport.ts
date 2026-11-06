import { SITE } from "@/lib/site";

/**
 * „Fehler in diesen Daten melden“ und „Idee einreichen“ (Issue #10): Links zu
 * vorausgefüllten GitHub-Formularen (`.github/ISSUE_TEMPLATE/datenfehler.yml`
 * und `idee.yml`), wie „Fehler melden“ auf den Fehlerseiten (#54).
 *
 * Bewusst nur Links: Der Server schreibt nichts, braucht keinen Token und keinen
 * Bot-Schutz (#20 ist geschlossen). Ein Weg ohne GitHub-Konto ist noch in
 * Klärung (#10).
 *
 * Mitgeschickt wird nur, was die Seite ohnehin zeigt: Datensatz und Pfad ohne
 * Query-String.
 */

export const DATA_REPORT_LABEL = "datenmeldung";

/** Alle bisherigen Meldungen, öffentlich auf GitHub */
export const DATA_REPORTS_URL = SITE.issuesWithLabel(DATA_REPORT_LABEL);

export type DataReport = {
  /** Name des Datensatzes, z. B. „Restaurants“ */
  dataset?: string;
  /** Pfad der Seite, z. B. `/essen-trinken` */
  path?: string;
};

const pathOnly = (path?: string) => path?.split(/[?#]/)[0];

export function dataReportUrl({ dataset, path }: DataReport = {}): string {
  const params = new URLSearchParams({
    template: "datenfehler.yml",
    title: `Datenfehler${dataset ? ` in „${dataset}“` : ""}: `,
  });
  if (dataset) params.set("datensatz", dataset);
  const page = pathOnly(path);
  if (page) params.set("seite", page);
  return `${SITE.newIssue}?${params.toString()}`;
}

export function ideaUrl(): string {
  return `${SITE.newIssue}?${new URLSearchParams({ template: "idee.yml", title: "Idee: " }).toString()}`;
}
