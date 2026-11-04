import { z } from "zod";

/**
 * Gemeinsame Bausteine für die SKG-Datensätze der Stadt (bydata, #44).
 *
 * Alle Datensätze haben dasselbe Schema; leere Felder kommen als `""` statt
 * als fehlender Schlüssel, Listen als `;`-getrennter Text.
 */

/** Textfeld: fehlend oder `null` wird `""`, Leerraum wird zusammengefasst. */
export const text = z
  .string()
  .nullish()
  .transform((value) => (value ?? "").replace(/\s+/g, " ").trim());

/** `"Toiletten; Spielplatz"` → `["Toiletten", "Spielplatz"]`. */
export const list = (value: string) =>
  value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** OpenStreetMap mit Markierung genau auf den Koordinaten aus den Daten. */
export const osmUrl = (lat: number, lon: number) => {
  const la = lat.toFixed(5);
  const lo = lon.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=18/${la}/${lo}`;
};

/** Straße, PLZ und Ort zu einer Zeile. */
export function address(street: string, postalCode: string, city: string): string {
  const place = [postalCode, city].filter(Boolean).join(" ");
  return [street, place].filter(Boolean).join(", ");
}

/** `2026-10-22` → `22.10.2026`. */
export function germanDate(iso: string | null): string | null {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null;
}

/**
 * So heißt die Quelle in Chat-Antworten und auf den Seiten. „Offene Daten /
 * Open Data" statt nur „offene Daten" — klein geschrieben war nicht klar,
 * dass ein feststehender Begriff gemeint ist.
 */
export const OPEN_DATA_SOURCE = "Offene Daten / Open Data der Stadt Rothenburg ob der Tauber";

