import { z } from "zod";

import { truncate } from "@/lib/guard/sanitize";
import { loadDataset, type Dataset } from "@/lib/opendata/bydata";
import { address, list, osmUrl, text } from "@/lib/opendata/common";
import {
  formatOpeningHours,
  openStatus,
  opensOnDay,
  parseOpeningHours,
  statusText,
  type Interval,
  type OpenStatus,
} from "@/lib/opendata/openingHours";
import {
  askedWeekday,
  asksForNow,
  keywords,
  normalize,
} from "@/lib/opendata/query";

/**
 * Gastronomie aus den offenen Daten der Stadt (Issue #27, Grounding).
 *
 * bydata-Datensatz `skg-venus-restaurants` aus dem Social Knowledge Graph
 * (SKG), CC0, wöchentlich aktualisiert. Erste Kategorie, bei der Öffnungszeiten
 * aus einer echten Quelle kommen statt aus Modellwissen.
 *
 * Der Datensatz ist **nicht vollständig** — Stand November 2026 sind 28
 * Betriebe eingetragen, Rothenburg hat deutlich mehr. Speisekarten, Preise und
 * Reservierung stehen nicht darin.
 */

export const RESTAURANT_DATASET = "skg-venus-restaurants";

const recordSchema = z.object({
  id: z.string(),
  name: text,
  types: text,
  cuisine: text,
  short_description: text,
  description: text,
  street: text,
  postal_code: text,
  city: text,
  lat: z.number(),
  lon: z.number(),
  opening_hours: text,
  contact_phone: text,
  url: text,
});

export type Restaurant = {
  id: string;
  name: string;
  /** z. B. `["Café", "Bäckerei"]` */
  types: string[];
  cuisine: string[];
  description: string;
  address: string;
  phone: string | null;
  /** Webseite des Betriebs, nur `https`, sonst `null`. */
  website: string | null;
  mapUrl: string;
  /** `null`: keine oder unlesbare Öffnungszeiten. */
  hours: Interval[] | null;
  /** Lesbare Zeilen, z. B. „Mo–Fr 9:00–17:00 Uhr". */
  hoursLines: string[];
};

export type RestaurantData = {
  restaurants: Restaurant[];
  source: { label: string; url: string; modified: string | null };
};

/** Nur `https`-Adressen; `www.example.de` wird zu `https://www.example.de/`. */
function website(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
    url.protocol = "https:";
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export function toRestaurant(raw: unknown): Restaurant | null {
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.name) return null;
  const record = parsed.data;
  const hours = parseOpeningHours(record.opening_hours);
  return {
    id: record.id,
    // Ein Eintrag heißt „Bronnenmühle _ Unter den Linden …".
    name: record.name.replace(/\s+_\s+/g, " – "),
    types: list(record.types),
    cuisine: list(record.cuisine),
    description: record.short_description || record.description,
    address: address(record.street, record.postal_code, record.city),
    phone: record.contact_phone || null,
    website: website(record.url),
    mapUrl: osmUrl(record.lat, record.lon),
    hours,
    hoursLines: hours ? formatOpeningHours(hours) : [],
  };
}

export function toRestaurantData(dataset: Dataset): RestaurantData {
  return {
    restaurants: dataset.items
      .map(toRestaurant)
      .filter((restaurant): restaurant is Restaurant => restaurant !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    source: {
      label: "Restaurants, Cafés und Gastronomie",
      url: dataset.pageUrl,
      modified: dataset.modified,
    },
  };
}

export async function loadRestaurantData(): Promise<RestaurantData | null> {
  try {
    return toRestaurantData(await loadDataset(RESTAURANT_DATASET));
  } catch {
    return null;
  }
}

/** Öffnungsstatus jetzt, `null` ohne lesbare Öffnungszeiten. */
export function restaurantStatus(
  restaurant: Restaurant,
  now: Date,
): OpenStatus | null {
  return restaurant.hours ? openStatus(restaurant.hours, now) : null;
}

/**
 * Geht es in der Frage um Essen, Trinken oder Gastronomie?
 *
 * Wie bei `isParkingQuestion`: die Daten kosten rund 2.000 Token und kommen
 * nur bei passenden Fragen in den Prompt. Lieber ein Treffer zu viel.
 */
const FOOD_PATTERN = new RegExp(
  [
    "essen",
    "restaurant",
    "gasth",
    "gastst",
    "gastro",
    "wirtshaus",
    "weinstube",
    "einkehr",
    "caf[eé]",
    "kaffee",
    "kuchen",
    "torte",
    "frühstück",
    "brunch",
    "mittag",
    "abendbrot",
    "hunger",
    "hungrig",
    "speise",
    "küche",
    "vegan",
    "vegetar",
    "pizza",
    "imbiss",
    "snack",
    "bäcker",
    "schneeball",
    "\\beis\\b",
    "eisdiele",
    "biergarten",
    "kneipe",
    "\\bbar\\b",
    "\\bpub\\b",
    "\\bbier",
    "\\bwein",
    "trinken",
    "\\beat\\b",
    "\\bfood",
    "lunch",
    "dinner",
    "breakfast",
    "coffee",
    "\\beten\\b", // NL
    "ontbijt", // NL
    "レストラン", // JA
    "食事", // JA
    "カフェ", // JA
  ].join("|"),
  "i",
);

export function isFoodQuestion(text: string): boolean {
  return FOOD_PATTERN.test(text);
}

function restaurantLine(restaurant: Restaurant, now: Date): string {
  const status = restaurantStatus(restaurant, now);
  const parts = [
    restaurant.name,
    restaurant.types.length > 0 && `Art: ${restaurant.types.join(", ")}`,
    restaurant.cuisine.length > 0 && `Küche: ${restaurant.cuisine.join(", ")}`,
    restaurant.description &&
      `Beschreibung: ${truncate(restaurant.description, 160)}`,
    restaurant.address && `Adresse: ${restaurant.address}`,
    restaurant.hoursLines.length > 0
      ? `Öffnungszeiten: ${restaurant.hoursLines.join("; ")}`
      : "Öffnungszeiten: nicht angegeben",
    status && `Jetzt: ${statusText(status)}`,
    restaurant.phone && `Telefon: ${restaurant.phone}`,
    `Karte: ${restaurant.mapUrl}`,
  ];
  return `- ${parts.filter(Boolean).join(" | ")}`;
}

/**
 * So viele Betriebe bekommt das Modell mit allen Details — gleich der
 * Obergrenze im Prompt. Bei sechs nannte es im Test auch sechs.
 */
export const DETAIL_LIMIT = 5;

/**
 * Fragewörter → Art des Betriebs. Trifft eins, zählen Betriebe dieser Art
 * mehr. Die Art steht in den Daten in `types` (z. B. „Café; Bäckerei").
 */
const CATEGORY_HINTS: { words: RegExp; types: RegExp }[] = [
  { words: /restaurant|essen gehen|abendessen|mittagessen|dinner|lunch|speisen/, types: /restaurant/ },
  { words: /caf[eé]|kaffee|kuchen|torte|frühstück|brunch|coffee|breakfast|ontbijt/, types: /café|bäckerei/ },
  { words: /bäcker|brot|brötchen|schneeball|bakery/, types: /bäckerei/ },
  { words: /\bbar\b|kneipe|\bpub\b|\bbier|\bwein|cocktail|drink/, types: /bar|pub|biergarten/ },
  { words: /biergarten|draußen|garten/, types: /biergarten/ },
  { words: /\beis\b|eisdiele|ice cream|gelato/, types: /eisdiele/ },
  { words: /imbiss|to.?go|snack|schnell/, types: /to-go|imbiss/ },
];

/** Teile von Namen, die viele Betriebe tragen — kein Hinweis auf einen bestimmten. */
const GENERIC_NAME_WORDS = new Set([
  "restaurant", "rothenburg", "tauber", "café", "cafe", "hotel", "gasthaus",
  "gasthof", "konditorei", "weinstube", "bäckerei", "spezialitäten",
]);

/** Punkte eines Betriebs für eine Frage — höher heißt passender. */
export function scoreRestaurant(
  restaurant: Restaurant,
  question: string,
  now: Date,
): number {
  const q = normalize(question);
  const name = normalize(restaurant.name);
  const types = normalize(restaurant.types.join(" "));
  const cuisine = normalize(restaurant.cuisine.join(" "));
  const description = normalize(restaurant.description);
  let score = 0;

  // Name genannt: fast immer die gemeinte Antwort.
  const nameWords = name
    .split(" ")
    .filter((word) => word.length >= 4 && !GENERIC_NAME_WORDS.has(word));
  if (nameWords.some((word) => q.includes(word))) score += 10;

  for (const hint of CATEGORY_HINTS) {
    if (hint.words.test(q) && hint.types.test(types)) score += 5;
  }

  // Küche über den Wortstamm: „italienisch", „Italiener", „italian".
  for (const entry of restaurant.cuisine) {
    const stem = normalize(entry).slice(0, 5);
    if (stem.length === 5 && q.includes(stem)) score += 5;
  }

  // Begriffe aus Beschreibung oder Küche, z. B. „Schäufele".
  for (const word of keywords(question)) {
    if (description.includes(word) || cuisine.includes(word)) score += 3;
  }

  if (restaurant.hours) {
    if (asksForNow(question)) {
      const state = openStatus(restaurant.hours, now).state;
      score += state === "open" ? 4 : state === "opens-later" ? 1 : -4;
    }
    const day = askedWeekday(question, now);
    if (day !== null) score += opensOnDay(restaurant.hours, day) ? 3 : -3;
  }

  return score;
}

/**
 * Die passendsten Betriebe zuerst. Bei Gleichstand gewinnt, wer gerade
 * geöffnet hat, dann der Name — damit die Auswahl ohne Treffer nicht zufällig
 * ist.
 */
export function selectRestaurants(
  data: RestaurantData,
  question: string,
  now: Date,
  limit = DETAIL_LIMIT,
): { selected: Restaurant[]; others: Restaurant[] } {
  const ranked = data.restaurants
    .map((restaurant) => ({
      restaurant,
      score: scoreRestaurant(restaurant, question, now),
      open: restaurantStatus(restaurant, now)?.state === "open" ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.open - a.open ||
        a.restaurant.name.localeCompare(b.restaurant.name, "de"),
    )
    .map((entry) => entry.restaurant);
  return { selected: ranked.slice(0, limit), others: ranked.slice(limit) };
}

/**
 * Datenblock für den Prompt, ohne Marker — den setzt `embedExternalContent`.
 * Die vorausgewählten Betriebe mit allen Angaben, die übrigen nur mit Namen,
 * damit das Modell weiß, wer überhaupt eingetragen ist.
 */
export function restaurantPromptData(
  data: RestaurantData,
  now: Date,
  question = "",
): string {
  const { selected, others } = selectRestaurants(data, question, now);
  const lines = [
    `Passend zur Frage ausgewählt (${selected.length} von ${data.restaurants.length}):`,
    ...selected.map((restaurant) => restaurantLine(restaurant, now)),
  ];
  if (others.length > 0) {
    lines.push(
      "",
      "Ebenfalls eingetragen, ohne Details:",
      others.map((restaurant) => restaurant.name).join("; "),
    );
  }
  return lines.join("\n");
}
