import { loadDataset } from "@/lib/opendata/bydata";
import { osmUrl } from "@/lib/opendata/common";

/**
 * „Wussten Sie schon?" für Fehlerseiten (Issue #54): ein Fakt zum heutigen Tag
 * aus den offenen Daten der Stadt statt einer trockenen Fehlermeldung.
 *
 * Bewusst aus den Daten und nicht von Hand oder vom Modell geschrieben: Ein
 * erfundener Fakt auf einer Seite, die ohnehin schon „Fehler" sagt, wäre der
 * schlechteste Ort für eine Falschaussage.
 *
 * - Findet heute eine Veranstaltung aus „Top Events" statt, kommt sie zuerst.
 * - Sonst eine Sehenswürdigkeit, pro Tag fest gewählt (alle sehen am selben
 *   Tag dieselbe), nur Einträge unter CC0 — andere Lizenzen verlangen eine
 *   Namensnennung pro Objekt.
 */

export const SIGHTS_DATASET = "skg-venus-sehenswuerdigkeiten";
export const EVENTS_DATASET = "skg-venus-top-events-rothenburg";

export type DailyFact = {
  kind: "event" | "sight";
  title: string;
  text: string;
  mapUrl: string | null;
  sourceUrl: string;
};

type Item = Record<string, unknown>;

/** Kalendertag in deutscher Zeit, z. B. `2026-11-04`. */
const berlinDay = (date: Date) =>
  date.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const str = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

/** Bis zu zwei ganze Sätze, höchstens rund 260 Zeichen. */
export function shortText(text: string, maxChars = 260): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  let result = "";
  for (const sentence of sentences.slice(0, 2)) {
    if ((result + sentence).length > maxChars && result) break;
    result += sentence;
  }
  result = result.trim();
  return result.length > maxChars ? `${result.slice(0, maxChars - 1).trimEnd()}…` : result;
}

/** Einfacher, stabiler Hash — gleicher Tag, gleicher Fakt. */
function dayIndex(day: string, length: number): number {
  let hash = 0;
  for (const char of day) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

const point = (item: Item) =>
  typeof item.lat === "number" && typeof item.lon === "number"
    ? osmUrl(item.lat, item.lon)
    : null;

export function eventToday(items: unknown[], now: Date, sourceUrl: string): DailyFact | null {
  const today = berlinDay(now);
  const item = (items as Item[]).find((entry) => str(entry.start_date) === today);
  if (!item || !str(item.name)) return null;
  return {
    kind: "event",
    title: `Heute in Rothenburg: ${str(item.name)}`,
    text: shortText(str(item.short_description) || str(item.description)),
    mapUrl: point(item),
    sourceUrl,
  };
}

export function sightOfDay(items: unknown[], now: Date, sourceUrl: string): DailyFact | null {
  const candidates = (items as Item[]).filter(
    (item) =>
      str(item.name) &&
      str(item.short_description) &&
      str(item.license).toUpperCase().startsWith("CC0"),
  );
  if (candidates.length === 0) return null;
  const item = candidates[dayIndex(berlinDay(now), candidates.length)];
  return {
    kind: "sight",
    title: str(item.name).replace(/\s+Rothenburg ob der Tauber$/, ""),
    text: shortText(str(item.short_description)),
    mapUrl: point(item),
    sourceUrl,
  };
}

/** Wartet höchstens `ms` — eine Fehlerseite soll nicht auf bydata warten. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms).unref?.()),
  ]);
}

/** Fakt des Tages, `null` wenn die Daten nicht schnell genug vorliegen. */
export async function loadDailyFact(now = new Date(), timeoutMs = 1500): Promise<DailyFact | null> {
  try {
    const events = await withTimeout(loadDataset(EVENTS_DATASET), timeoutMs);
    const event = events ? eventToday(events.items, now, events.pageUrl) : null;
    if (event) return event;

    const sights = await withTimeout(loadDataset(SIGHTS_DATASET), timeoutMs);
    return sights ? sightOfDay(sights.items, now, sights.pageUrl) : null;
  } catch {
    return null;
  }
}
