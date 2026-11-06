import { z } from "zod";

import { cleanDescription } from "@/lib/guard/external";
import { loadDataset, type Dataset } from "@/lib/opendata/bydata";
import {
  address,
  coordinates,
  sourceOf,
  text,
  websiteUrl,
  type Coordinates,
  type SourceInfo,
} from "@/lib/opendata/common";
import { EVENTS_DATASET } from "@/lib/opendata/dailyFact";

/**
 * Termine aus dem bydata-Datensatz „Top Events Rothenburg“ (Issue #36), für
 * den Termin-Feed (iCal und GeoJSON) unter `/daten`.
 *
 * Bewusst ohne Speicher und Archiv: Der Feed entsteht bei jedem Abruf aus den
 * aktuellen Daten, vergangene Termine fallen heraus. Termine von
 * Partnerseiten mit Archiv sind ein eigenes Vorhaben (#117).
 *
 * Eigenheiten der Quelle (Stand November 2026):
 * - Eine mehrtägige Veranstaltung steht als ein Eintrag je Tag da, alle mit
 *   derselben `id` (Reiterlesmarkt: 68 Tage). Eindeutig wird ein Termin erst
 *   mit dem Datum.
 * - Einträge ohne Datum gibt es auch (Toppler Theater, „Spielzeit Juni bis
 *   August“ nur im Text). Sie bleiben im GeoJSON, ins iCal können sie nicht.
 * - Uhrzeiten fehlen; ein Termin gilt für den ganzen Tag.
 */

const recordSchema = z.object({
  id: z.string(),
  name: text,
  short_description: text,
  description: text,
  street: text,
  postal_code: text,
  city: text,
  lat: z.number().nullish(),
  lon: z.number().nullish(),
  url: text,
  start_date: text,
  end_date: text,
});

export type CityEvent = {
  /** Eindeutig je Termin: Kennung der Quelle plus Datum */
  id: string;
  name: string;
  description: string;
  address: string;
  coordinates: Coordinates | null;
  website: string | null;
  /** `YYYY-MM-DD`, `null` bei Einträgen ohne Datum */
  start: string | null;
  /** `YYYY-MM-DD`, mindestens `start`; `null` bei Einträgen ohne Datum */
  end: string | null;
};

export type EventData = {
  events: CityEvent[];
  source: SourceInfo;
};

const isoDate = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);

/** Kalendertag in deutscher Zeit, z. B. `2026-11-20`. */
export const berlinDay = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

export function toEvent(raw: unknown): CityEvent | null {
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.name) return null;
  const record = parsed.data;
  const start = isoDate(record.start_date);
  const end = start ? [isoDate(record.end_date) ?? start, start].sort().at(-1)! : null;
  return {
    id: start ? `${record.id}-${start}` : record.id,
    name: record.name,
    description: cleanDescription(record.short_description || record.description, `${EVENTS_DATASET} ${record.id}`),
    address: address(record.street, record.postal_code, record.city),
    coordinates: record.lat != null && record.lon != null ? coordinates(record.lat, record.lon) : null,
    website: websiteUrl(record.url),
    start,
    end,
  };
}

/**
 * Laufende und bevorstehende Termine, nach Datum; Einträge ohne Datum am
 * Ende. Entscheidend ist der Tag in deutscher Zeit: Ein Termin am 20.11.
 * steht bis zum Ende dieses Tages im Feed.
 */
export function toEventData(dataset: Dataset, now: Date): EventData {
  const today = berlinDay(now);
  const events = dataset.items
    .map(toEvent)
    .filter((event): event is CityEvent => event !== null)
    .filter((event) => event.end === null || event.end >= today)
    .sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999") || a.name.localeCompare(b.name, "de"));
  return { events, source: sourceOf(dataset, "Top Events Rothenburg") };
}

export async function loadEventData(now = new Date()): Promise<EventData | null> {
  try {
    return toEventData(await loadDataset(EVENTS_DATASET), now);
  } catch {
    return null;
  }
}
