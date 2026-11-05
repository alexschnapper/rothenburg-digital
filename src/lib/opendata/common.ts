import { z } from "zod";

import type { Dataset, DatasetLicense } from "@/lib/opendata/bydata";

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

/** OpenStreetMap-Suche nach einer Adresse — wenn die Koordinaten nicht taugen. */
export const osmSearchUrl = (address: string) =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;

/** „Herrngasse 2, 91541 …" → „herrngasse" — Straße ohne Hausnummer. */
const streetName = (address: string) =>
  address.split(",")[0].toLowerCase().replace(/[\d\s–-]+[a-z]?\b/g, " ").trim();

/**
 * Teilen sich Einträge an **verschiedenen Straßen** exakt dieselben
 * Koordinaten, stimmen sie für die meisten nicht — so im Datensatz
 * Einkaufsmöglichkeiten (Stand November 2026): Herrngasse 1 und 2, Marktplatz 7
 * und Obere Schmiedgasse 29 auf einem Punkt. Diese Einträge bekommen statt des
 * Punkts eine Suche nach ihrer Adresse. Gleiche Straße (mehrere Läden in einem
 * Haus oder nebeneinander) bleibt beim Punkt.
 */
export function withReliableMapUrls<T extends { mapUrl: string; address: string }>(
  entries: T[],
): T[] {
  const streets = new Map<string, Set<string>>();
  for (const entry of entries) {
    const set = streets.get(entry.mapUrl) ?? new Set<string>();
    set.add(streetName(entry.address));
    streets.set(entry.mapUrl, set);
  }
  return entries.map((entry) =>
    streets.get(entry.mapUrl)!.size > 1 && entry.address
      ? { ...entry, mapUrl: osmSearchUrl(entry.address) }
      : entry,
  );
}

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

/** Quelle eines Datensatzes für Seiten und Prompt: Name, Link, Stand, Lizenz. */
export type SourceInfo = {
  label: string;
  url: string;
  modified: string | null;
  license: DatasetLicense | null;
};

export const sourceOf = (dataset: Dataset, label: string): SourceInfo => ({
  label,
  url: dataset.pageUrl,
  modified: dataset.modified,
  license: dataset.license,
});

