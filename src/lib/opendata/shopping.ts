import { z } from "zod";

import { cleanDescription } from "@/lib/guard/external";
import { truncate } from "@/lib/guard/sanitize";
import type { PlaceRef } from "@/lib/opendata/attribution";
import { loadDataset, type Dataset } from "@/lib/opendata/bydata";
import {
  address,
  coordinates,
  list,
  osmUrl,
  sourceOf,
  text,
  withReliableMapUrls,
  type Coordinates,
  type SourceInfo,
} from "@/lib/opendata/common";
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
 * Einkaufen aus den offenen Daten der Stadt (Issue #62).
 *
 * Kern ist `skg-venus-einkaufsmoeglichkeiten` (Stand November 2026: 54
 * Einträge, CC BY-SA 4.0). Die kleineren Datensätze überschneiden sich fast
 * vollständig damit — über die gemeinsame `id` werden Dubletten entfernt, der
 * erste Datensatz in `SHOP_DATASETS` gewinnt und liefert Quelle und Lizenz.
 * `skg-venus-einzelhandel` enthält (Stand 05.11.2026) dieselben 54 Einträge
 * mit denselben IDs und fügt deshalb nichts hinzu. Er
 * bleibt dabei, damit abweichende Einträge ohne Codeänderung erscheinen.
 */

export const SHOP_DATASETS = [
  { id: "skg-venus-einkaufsmoeglichkeiten", label: "Einkaufsmöglichkeiten" },
  { id: "skg-venus-einzelhandel", label: "Einzelhandel" },
  { id: "skg-venus-handmade", label: "Handmade" },
  { id: "skg-venus-direktvermarkter-popup-rothenburg", label: "Direktvermarkter Pop-up" },
  { id: "skg-venus-direktvermarkter-got-rothenburg", label: "Direktvermarkter „Genießen ob der Tauber“" },
] as const;

const recordSchema = z.object({
  id: z.string(),
  name: text,
  types: text,
  topics: text,
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

export type ShopGroup = "lebensmittel" | "mode" | "handmade" | "souvenir" | "weitere";

export type Shop = {
  id: string;
  name: string;
  /** z. B. `["Souvenirladen", "Spielzeugladen"]` */
  types: string[];
  topics: string[];
  group: ShopGroup;
  description: string;
  address: string;
  phone: string | null;
  /** Webseite des Geschäfts, nur `https`, sonst `null`. */
  website: string | null;
  mapUrl: string;
  /** Für die Feeds (#81); `null`, wenn der Punkt nicht taugt. */
  coordinates: Coordinates | null;
  /** `null`: keine oder unlesbare Öffnungszeiten. */
  hours: Interval[] | null;
  hoursLines: string[];
  /** Datensatz, aus dem der Eintrag stammt — Quelle und Lizenz. */
  source: SourceInfo;
};

export type ShopData = {
  shops: Shop[];
  /** Nur Datensätze, aus denen mindestens ein Eintrag stammt. */
  sources: SourceInfo[];
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

/** Gastronomie steht auf /essen-trinken, nicht hier (z. B. eine Kaffeerösterei). */
const GASTRO_TYPES = /^(café|restaurant|bar|bistro|imbiss|eisdiele)$/i;

/** Erste passende Gruppe gewinnt — Reihenfolge ist Absicht. */
function groupOf(types: string[], topics: string[]): ShopGroup {
  const all = types.join(" ");
  if (/lebensmittel|supermarkt|süßwaren|direktvermarkter/i.test(all)) return "lebensmittel";
  if (/bekleidung|schmuck|accessoires|schuh/i.test(all)) return "mode";
  if (topics.some((topic) => /handmade|popup/i.test(topic)) || /dekoration/i.test(all)) {
    return "handmade";
  }
  if (/souvenir|gemischtwaren|spielzeug/i.test(all)) return "souvenir";
  return "weitere";
}

export function toShop(raw: unknown, source: SourceInfo): Shop | null {
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.name) return null;
  const record = parsed.data;
  const types = list(record.types);
  if (types.length > 0 && types.every((type) => GASTRO_TYPES.test(type))) return null;
  const topics = list(record.topics);
  const hours = parseOpeningHours(record.opening_hours);
  return {
    id: record.id,
    name: record.name.replace(/\s+_\s+/g, " – "),
    types,
    topics,
    group: groupOf(types, topics),
    description: cleanDescription(
      record.short_description || record.description,
      `Geschäft ${record.id}`,
    ),
    address: address(record.street, record.postal_code, record.city),
    phone: record.contact_phone || null,
    website: website(record.url),
    mapUrl: osmUrl(record.lat, record.lon),
    coordinates: coordinates(record.lat, record.lon),
    hours,
    hoursLines: hours ? formatOpeningHours(hours) : [],
    source,
  };
}

/** Datensätze in der Reihenfolge von `SHOP_DATASETS` zusammenführen. */
export function toShopData(datasets: { dataset: Dataset; label: string }[]): ShopData {
  const shops = new Map<string, Shop>();
  const sources: SourceInfo[] = [];
  for (const { dataset, label } of datasets) {
    const source = sourceOf(dataset, label);
    let used = false;
    for (const item of dataset.items) {
      const shop = toShop(item, source);
      if (!shop || shops.has(shop.id)) continue;
      shops.set(shop.id, shop);
      used = true;
    }
    if (used) sources.push(source);
  }
  return {
    shops: withReliableMapUrls([...shops.values()]).sort((a, b) =>
      a.name.localeCompare(b.name, "de"),
    ),
    sources,
  };
}

/** `null`, wenn der Hauptdatensatz fehlt; fehlt ein kleiner, geht es ohne ihn. */
export async function loadShopData(): Promise<ShopData | null> {
  const results = await Promise.allSettled(
    SHOP_DATASETS.map(async ({ id, label }) => ({ dataset: await loadDataset(id), label })),
  );
  if (results[0].status !== "fulfilled") return null;
  return toShopData(
    results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  );
}

/** Öffnungsstatus jetzt, `null` ohne lesbare Öffnungszeiten. */
export function shopStatus(shop: Shop, now: Date): OpenStatus | null {
  return shop.hours ? openStatus(shop.hours, now) : null;
}

/**
 * Geht es in der Frage ums Einkaufen? Wie bei der Gastronomie lieber ein
 * Treffer zu viel — die Daten kommen sonst gar nicht in den Prompt. Bewusst
 * ohne „laden" (E-Auto laden) und mit `\buhren` (sonst „Stadtführungen").
 */
const SHOPPING_PATTERN = new RegExp(
  [
    "einkauf", "kaufen", "\\bshop", "shopping", "geschäft", "läden",
    "boutique", "souvenir", "andenken", "mitbringsel", "geschenk", "weihnacht",
    "christkind", "spielzeug", "teddy", "schmuck", "goldschmied", "\\buhren",
    "kleidung", "\\bmode\\b", "schuh", "buchhandl", "bücher", "supermarkt",
    "lebensmittel", "hofladen", "regional", "direktvermarkt", "handmade",
    "handgemacht", "kunsthandwerk", "keramik", "drogerie", "süßigkeit",
    "bonbon", "feinkost",
    "\\bstore", "\\bbuy\\b", "\\bgift", "christmas", "\\btoy", "jewel",
    "clothes", "grocer",
    "winkel", "cadeau", "kerst", // NL
    "お土産", "買い物", "ショップ", // JA
  ].join("|"),
  "i",
);

export function isShoppingQuestion(question: string): boolean {
  return SHOPPING_PATTERN.test(question);
}

/** Orte für die Kartenlinks unter der Antwort (#63). */
export function shopPlaces(data: ShopData): PlaceRef[] {
  return data.shops.map((shop) => ({ label: shop.name, mapUrl: shop.mapUrl, source: shop.source }));
}

/** Fragewörter → Art des Geschäfts, wie `CATEGORY_HINTS` bei den Restaurants. */
const GROUP_HINTS: { words: RegExp; group: ShopGroup }[] = [
  { words: /lebensmittel|supermarkt|einkaufen für|hofladen|regional|direktvermarkt|bonbon|süß|feinkost|grocer/, group: "lebensmittel" },
  { words: /kleidung|\bmode\b|schmuck|schuh|uhren|clothes|jewel/, group: "mode" },
  { words: /handmade|handgemacht|kunsthandwerk|künstler|deko|keramik/, group: "handmade" },
  { words: /souvenir|andenken|mitbringsel|geschenk|weihnacht|spielzeug|teddy|gift|christmas|\btoy/, group: "souvenir" },
];

/** Teile von Namen, die viele Geschäfte tragen. */
const GENERIC_NAME_WORDS = new Set(["rothenburg", "tauber", "laden", "shop", "haus", "gmbh"]);

/** Punkte eines Geschäfts für eine Frage — höher heißt passender. */
export function scoreShop(shop: Shop, question: string, now: Date): number {
  const q = normalize(question);
  const name = normalize(shop.name);
  const details = normalize([...shop.types, ...shop.topics, shop.description].join(" "));
  let score = 0;

  const nameWords = name
    .split(" ")
    .filter((word) => word.length >= 4 && !GENERIC_NAME_WORDS.has(word));
  if (nameWords.some((word) => q.includes(word))) score += 10;

  for (const hint of GROUP_HINTS) {
    if (hint.words.test(q) && hint.group === shop.group) score += 5;
  }

  for (const word of keywords(question)) {
    if (details.includes(word) || name.includes(word)) score += 3;
  }

  if (shop.hours) {
    if (asksForNow(question)) {
      const state = openStatus(shop.hours, now).state;
      score += state === "open" ? 4 : state === "opens-later" ? 1 : -4;
    }
    const day = askedWeekday(question, now);
    if (day !== null) score += opensOnDay(shop.hours, day) ? 3 : -3;
  }

  return score;
}

/** Wie bei den Restaurants: genau so viele mit Details, wie genannt werden dürfen. */
export const DETAIL_LIMIT = 5;

export function selectShops(
  data: ShopData,
  question: string,
  now: Date,
  limit = DETAIL_LIMIT,
): { selected: Shop[]; others: Shop[] } {
  const ranked = data.shops
    .map((shop) => ({
      shop,
      score: scoreShop(shop, question, now),
      open: shopStatus(shop, now)?.state === "open" ? 1 : 0,
    }))
    .sort(
      (a, b) => b.score - a.score || b.open - a.open || a.shop.name.localeCompare(b.shop.name, "de"),
    )
    .map((entry) => entry.shop);
  return { selected: ranked.slice(0, limit), others: ranked.slice(limit) };
}

function shopLine(shop: Shop, now: Date): string {
  const status = shopStatus(shop, now);
  const parts = [
    shop.name,
    shop.types.length > 0 && `Art: ${shop.types.join(", ")}`,
    shop.topics.length > 0 && `Themen: ${shop.topics.join(", ")}`,
    shop.description && `Beschreibung: ${truncate(shop.description, 160)}`,
    shop.address && `Adresse: ${shop.address}`,
    shop.hoursLines.length > 0
      ? `Öffnungszeiten: ${shop.hoursLines.join("; ")}`
      : "Öffnungszeiten: nicht angegeben",
    status && `Jetzt: ${statusText(status)}`,
    shop.phone && `Telefon: ${shop.phone}`,
  ];
  return `- ${parts.filter(Boolean).join(" | ")}`;
}

/** Datenblock für den Prompt, ohne Marker — den setzt `embedExternalContent`. */
export function shopPromptData(data: ShopData, now: Date, question = ""): string {
  const { selected, others } = selectShops(data, question, now);
  const lines = [
    `Passend zur Frage ausgewählt (${selected.length} von ${data.shops.length}):`,
    ...selected.map((shop) => shopLine(shop, now)),
  ];
  if (others.length > 0) {
    lines.push("", "Ebenfalls eingetragen, ohne Details:", others.map((shop) => shop.name).join("; "));
  }
  return lines.join("\n");
}
