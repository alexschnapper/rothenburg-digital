/**
 * Tatsächlich bezahlte Beträge laut Mistral-Rechnung (Issue #48).
 *
 * Von Hand gepflegt: Mistral liefert Kosten per API nur über die Admin-API, und
 * die gibt es nur im Enterprise-Tarif
 * (https://docs.mistral.ai/admin/admin-api/usage-metrics). Einmal im Monat den
 * Rechnungsbetrag aus der Mistral-Console hier eintragen, committen, ausrollen.
 *
 * Die Rechnung gilt für die ganze Organisation, also alle Umgebungen (dev,
 * staging, prod) zusammen — anders als die Schätzung auf `/kosten`, die nur die
 * jeweilige Umgebung zählt.
 */

export type Invoice = {
  /** Abrechnungsmonat, z. B. `2026-10` */
  month: string;
  /** Rechnungsbetrag in Euro, brutto */
  amountEur: number;
  /** optional, z. B. „inkl. Tests für #27" */
  note?: string;
};

export const MISTRAL_INVOICES: Invoice[] = [
  // { month: "2026-10", amountEur: 1.23 },
];

/**
 * Monatliches Ausgabenlimit, das in der Mistral-Console gesetzt ist (Euro),
 * `null` wenn keins eingetragen ist. Wird auf `/kosten` als Obergrenze gezeigt.
 */
export const MISTRAL_MONTHLY_LIMIT_EUR: number | null = 20;

/**
 * Im Tarif enthaltenes Kontingent für die API-Nutzung pro Kalendermonat (Euro),
 * `null` wenn keins. Solange der Verbrauch darunter bleibt, fällt keine
 * Rechnung an — `/kosten` erklärt dann, warum `MISTRAL_INVOICES` leer ist.
 * Stand 04.11.2026: Pay-as-you-go mit 8,50 € Kontingent, im November 0,12 €
 * davon verbraucht, noch keine Rechnung erhalten.
 */
export const MISTRAL_INCLUDED_MONTHLY_EUR: number | null = 8.5;
