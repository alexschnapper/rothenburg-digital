/**
 * Kleine Helfer zum Lesen von Umgebungsvariablen.
 *
 * Bewusst ohne Framework: Next lädt `.env*` selbst, hier geht es nur um das
 * Auswerten der Strings mit sinnvollen Defaults.
 */

/** `"1"` oder `"true"` (case-insensitive) = aktiv, alles andere = inaktiv. */
export const isTruthy = (value: string | undefined): boolean =>
  value === "1" || value?.toLowerCase() === "true";

/**
 * Ganzzahl aus einer Env-Variable, sonst `fallback`.
 *
 * `0` ist ein gültiger Wert (viele Grenzwerte bedeuten „0 = aus"), negative
 * oder unlesbare Werte fallen auf den Default zurück.
 */
export const envInt = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Kommaseparierte Liste, leere Einträge entfernt. */
export const envList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
