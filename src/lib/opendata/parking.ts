import { z } from "zod";

import { cleanDescription } from "@/lib/guard/external";
import { isAllowedLinkHref, toSafeLinkHref } from "@/lib/guard/links";
import type { PlaceRef } from "@/lib/opendata/attribution";
import { loadDataset, type Dataset } from "@/lib/opendata/bydata";
import {
  address,
  coordinates,
  list,
  osmUrl,
  sourceOf,
  text,
  type Coordinates,
  type SourceInfo,
} from "@/lib/opendata/common";

/**
 * Parkplätze und E-Ladesäulen aus den offenen Daten der Stadt (Issue #6).
 *
 * Zwei bydata-Datensätze aus dem Social Knowledge Graph (SKG) der Stadt, CC0,
 * wöchentlich aktualisiert. Beide haben dasselbe Schema; leere Felder kommen
 * als `""` statt als fehlender Schlüssel.
 *
 * Was die Daten **nicht** enthalten: Preise, Öffnungszeiten der Parkplätze,
 * Anzahl der Stellplätze und die aktuelle Belegung. Der Chat darf dazu
 * deshalb nichts sagen (siehe `parkingPromptSection`).
 */

/**
 * Offizielle Übersicht der Stadt mit allen bekannten Ladesäulen, auch bei
 * Übernachtungsbetrieben. Vollständiger als der bydata-Datensatz (dort fehlen
 * z. B. P1, P4 und P5), aber nur als HTML-Seite — deshalb nur verlinkt.
 */
export const CHARGING_OVERVIEW_URL =
  "https://www.rothenburg.de/besuchen/mobilitaet/e-tankstellen";

export const PARKING_DATASET = "skg-venus-parkplaetze";
export const CHARGING_DATASET = "skg-venus-e-ladesaeulen";

const recordSchema = z.object({
  id: z.string(),
  name: text,
  types: text,
  short_description: text,
  url: text,
  street: text,
  postal_code: text,
  city: text,
  lat: z.number(),
  lon: z.number(),
  features: text,
  payment: text,
  updated_at: text,
});

export type Place = {
  id: string;
  /** Kurzname, z. B. „P4" oder „Schrannenplatz". */
  label: string;
  name: string;
  /** Wohnmobile erlaubt (laut `types`). */
  camper: boolean;
  description: string;
  address: string;
  features: string[];
  payment: string[];
  mapUrl: string;
  /** Für die Feeds (#81); `null`, wenn der Punkt nicht taugt. */
  coordinates: Coordinates | null;
  /** Nur Adressen aus der Link-Allowlist, sonst `null`. */
  website: string | null;
};

export type ParkingData = {
  parking: Place[];
  charging: Place[];
  /** Je Datensatz eigener Stand, z. B. `2026-10-22`. */
  sources: SourceInfo[];
};

function website(value: string): string | null {
  if (!value) return null;
  const href = /^https?:\/\//.test(value) ? value : `https://${value}`;
  return isAllowedLinkHref(href) ? toSafeLinkHref(href) : null;
}

/** „Parkplatz P4 Rothenburg ob der Tauber" → „P4". */
function shortLabel(name: string): string {
  const match = name.match(/\bP\s?(\d+)\b/);
  if (match) return `P${match[1]}`;
  return name.replace(/\s*Rothenburg ob der Tauber$/, "").trim();
}

export function toPlace(raw: unknown): Place | null {
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success) return null;
  const record = parsed.data;
  return {
    id: record.id,
    label: shortLabel(record.name),
    name: record.name,
    camper: /wohnmobil/i.test(record.types),
    description: cleanDescription(record.short_description, `Parkplatz ${record.id}`),
    address: address(record.street, record.postal_code, record.city),
    features: list(record.features),
    payment: list(record.payment),
    mapUrl: osmUrl(record.lat, record.lon),
    coordinates: coordinates(record.lat, record.lon),
    website: website(record.url),
  };
}

/** P1–P5 in Zahlenfolge, danach alle übrigen nach Name. */
function byLabel(a: Place, b: Place): number {
  const na = a.label.match(/^P(\d+)$/)?.[1];
  const nb = b.label.match(/^P(\d+)$/)?.[1];
  if (na && nb) return Number(na) - Number(nb);
  if (na) return -1;
  if (nb) return 1;
  return a.label.localeCompare(b.label, "de");
}

export function toPlaces(items: unknown[]): Place[] {
  return items
    .map(toPlace)
    .filter((place): place is Place => place !== null)
    .sort(byLabel);
}

export function toParkingData(parking: Dataset, charging: Dataset): ParkingData {
  return {
    parking: toPlaces(parking.items),
    charging: toPlaces(charging.items),
    sources: [
      sourceOf(parking, "Parkplätze und Wohnmobilstellplätze"),
      sourceOf(charging, "E-Ladesäulen"),
    ],
  };
}

/** Beide Datensätze laden; `null`, wenn einer davon nicht verfügbar ist. */
export async function loadParkingData(): Promise<ParkingData | null> {
  try {
    const [parking, charging] = await Promise.all([
      loadDataset(PARKING_DATASET),
      loadDataset(CHARGING_DATASET),
    ]);
    return toParkingData(parking, charging);
  } catch {
    return null;
  }
}

/**
 * Geht es in der Frage ums Parken oder E-Laden?
 *
 * Nur dann kommen die Daten in den Prompt — sonst würde jede Anfrage rund
 * 1.500 Token mehr kosten. Bewusst großzügig: ein überflüssiger Treffer kostet
 * nur Token, ein verpasster führt zu einer Antwort aus Modellwissen. „Laden"
 * allein zählt nicht, das ist meist ein Geschäft.
 */
const PARKING_PATTERN = new RegExp(
  [
    "park", // parken, Parkplatz, Parkhaus, parking, parkeren
    "stellpl",
    "wohnmobil",
    "camper",
    "wohnwagen",
    "\\bp\\s?[1-5]\\b",
    "\\bauto",
    "\\bpkw",
    "anreise",
    "lades[äa]ule",
    "ladestation",
    "ladepunkt",
    "aufladen",
    "e-auto",
    "elektroauto",
    "\\bstrom",
    "charg", // charging, charger
    "\\bev\\b",
    "oplaad", // NL
    "駐車", // JA: Parken
    "充電", // JA: Laden
  ].join("|"),
  "i",
);

/** Orte für die Kartenlinks unter der Antwort (#63). */
export function parkingPlaces(data: ParkingData): PlaceRef[] {
  const refs = (places: Place[], source: SourceInfo) =>
    places.map((place) => ({ label: place.label, aliases: [place.name], mapUrl: place.mapUrl, source }));
  return [...refs(data.parking, data.sources[0]), ...refs(data.charging, data.sources[1])];
}

export function isParkingQuestion(text: string): boolean {
  return PARKING_PATTERN.test(text);
}

function placeLine(place: Place): string {
  const parts = [
    `${place.label}${place.label !== place.name ? ` (${place.name})` : ""}`,
    place.address && `Adresse: ${place.address}`,
    place.camper && "Wohnmobile erlaubt",
    place.description && `Beschreibung: ${place.description}`,
    place.features.length > 0 && `Ausstattung: ${place.features.join(", ")}`,
    place.payment.length > 0 && `Bezahlung: ${place.payment.join(", ")}`,
  ];
  return `- ${parts.filter(Boolean).join(" | ")}`;
}

/** Datenblock für den Prompt, ohne Marker — den setzt `embedExternalContent`. */
export function parkingPromptData(data: ParkingData): string {
  return [
    "Parkplätze und Wohnmobilstellplätze:",
    ...data.parking.map(placeLine),
    "",
    "Öffentliche E-Ladesäulen:",
    ...(data.charging.length > 0
      ? data.charging.map(placeLine)
      : ["- keine Einträge"]),
  ].join("\n");
}
