import { createHash, randomBytes } from "node:crypto";

/**
 * Protokollierung der Abwehr — datenschutzfreundlich.
 *
 * Missbrauch erkennt man nur, wenn man ihn sieht; gleichzeitig ist eine
 * IP-Adresse ein personenbezogenes Datum und der Nachrichtentext erst recht.
 * Deshalb gilt hier:
 *
 * - Die IP wird nur als gekürzter Hash geschrieben (Pseudonym). Er genügt, um
 *   „dieselbe Gegenstelle" über Logzeilen hinweg zu erkennen, und lässt sich
 *   ohne den Salt nicht auf eine Adresse zurückrechnen.
 * - Nachrichteninhalte werden **nie** geloggt, nur Kennzahlen (Länge, Anzahl
 *   entfernter Zeichen) und die Namen der ausgelösten Regeln.
 *
 * Der Salt kommt aus `CHAT_LOG_SALT`. Ohne gesetzten Salt wird pro Prozess ein
 * zufälliger benutzt: die Pseudonyme sind dann innerhalb einer Laufzeit
 * vergleichbar und nach einem Neustart nicht mehr — für die Auswertung von
 * Angriffswellen reicht das, und es entsteht kein dauerhaftes Merkmal.
 */

const salt = process.env.CHAT_LOG_SALT ?? randomBytes(16).toString("hex");

export function pseudonym(key: string): string {
  return createHash("sha256").update(`${salt}:${key}`).digest("hex").slice(0, 10);
}

export type GuardEvent = {
  /** Kurzname des Ereignisses, z. B. "blocked" oder "invalid-body". */
  event: string;
  /**
   * Pseudonym der Gegenstelle. Optional: ein paar Ereignisse (z. B.
   * "budget-warning" in `ratelimit.ts`) betreffen keine einzelne Gegenstelle,
   * sondern den Gesamtverbrauch über alle Nutzer.
   */
  client?: string;
  [key: string]: unknown;
};

export function logGuard(
  level: "info" | "warn",
  data: GuardEvent,
): void {
  const line = JSON.stringify({ scope: "chat-guard", ...data });
  if (level === "warn") console.warn(line);
  else console.info(line);
}
