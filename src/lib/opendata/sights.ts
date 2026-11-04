import { z } from "zod";

import { cleanDescription } from "@/lib/guard/external";
import { truncate } from "@/lib/guard/sanitize";
import { loadDataset, type Dataset } from "@/lib/opendata/bydata";
import { address, list, osmUrl, text } from "@/lib/opendata/common";
import { keywords, normalize } from "@/lib/opendata/query";

/**
 * Sehenswürdigkeiten aus den offenen Daten der Stadt (Issue #44).
 *
 * Ein Datensatz reicht: `skg-venus-sehenswuerdigkeiten` enthält auch alle
 * Einträge aus „Top 10", „Museum" und „Jüdisches Rothenburg" (Stand November
 * 2026: 37 Orte, die anderen Datensätze sind Teilmengen; „Stadtführungen" ist
 * leer). Die Zugehörigkeit steht in `topics`.
 *
 * Bekannte Orte fehlen (z. B. Plönlein, Burggarten, St. Jakob als Kirche) —
 * der Prompt behandelt das ausdrücklich.
 */

export const SIGHTS_DATASET = "skg-venus-sehenswuerdigkeiten";

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
  opening_hours: z.string().nullish(),
  price_info: text,
  license: text,
  license_holder: text,
});

export type SightGroup = "befestigung" | "gebaeude" | "aussicht" | "juedisch";

export type Sight = {
  id: string;
  name: string;
  types: string[];
  topics: string[];
  group: SightGroup;
  /** Laut Themen ein Highlight oder Top 10 — zählt bei der Vorauswahl */
  highlight: boolean;
  description: string;
  address: string;
  /** Freitext aus den Daten, oft nach Jahreszeit gegliedert — nicht auswertbar */
  openingHours: string | null;
  price: string | null;
  mapUrl: string;
  /** Lizenz, wenn nicht CC0 — dann mit Namensnennung */
  attribution: string | null;
};

export type SightData = {
  sights: Sight[];
  source: { label: string; url: string; modified: string | null };
};

/**
 * „Rathaus Rothenburg ob der Tauber" → „Rathaus", „… _ Rabbi …" → „… – Rabbi …".
 * Nicht nach „von"/„in": „… im Burggarten von Rothenburg ob der Tauber" bleibt.
 */
function cleanName(name: string): string {
  return name
    .replace(/\s+_\s+/g, " – ")
    .replace(/(?<!\b(?:von|in|im))\s+Rothenburg( ob der Tauber)?(?=$|:|\s+\()/g, "")
    .trim();
}

/**
 * Einteilung für die Seite. Die Themen der Daten taugen dafür nur zum Teil:
 * „Highlight" tragen 25 von 37 Orten.
 */
function groupOf(name: string, topics: string[]): SightGroup {
  if (topics.includes("Jüdisches Rothenburg")) return "juedisch";
  if (/aussichtspunkt|taubertal/i.test(name)) return "aussicht";
  if (/rathaus/i.test(name)) return "gebaeude";
  if (/turm|tor\b|tor$|bastei|ruckesser|stern|bogen/i.test(name)) return "befestigung";
  return "gebaeude";
}

/** Öffnungszeiten-Feld, das nur den Namen wiederholt, zählt nicht. */
function hoursOf(raw: string | null | undefined, name: string): string | null {
  const value = (raw ?? "").trim();
  if (!value || normalize(value).startsWith(normalize(name).slice(0, 20))) return null;
  return value;
}

export function toSight(raw: unknown): Sight | null {
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.name) return null;
  const record = parsed.data;
  const topics = list(record.topics).filter(Boolean);
  const description = cleanDescription(
    record.short_description || record.description,
    `Sehenswürdigkeit ${record.id}`,
  );
  const cc0 = record.license.toUpperCase().startsWith("CC0");
  return {
    id: record.id,
    name: cleanName(record.name),
    types: list(record.types),
    topics,
    group: groupOf(record.name, topics),
    highlight: topics.some((topic) => /top 10|highlight/i.test(topic)),
    description,
    address: address(record.street, record.postal_code, record.city),
    openingHours: hoursOf(record.opening_hours, record.name),
    price: record.price_info || null,
    mapUrl: osmUrl(record.lat, record.lon),
    attribution: cc0
      ? null
      : [record.license, record.license_holder].filter(Boolean).join(", ") || null,
  };
}

const GROUP_ORDER: SightGroup[] = ["befestigung", "gebaeude", "aussicht", "juedisch"];

export function toSightData(dataset: Dataset): SightData {
  return {
    sights: dataset.items
      .map(toSight)
      .filter((sight): sight is Sight => sight !== null)
      .sort(
        (a, b) =>
          GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
          a.name.localeCompare(b.name, "de"),
      ),
    source: {
      label: "Sehenswürdigkeiten",
      url: dataset.pageUrl,
      modified: dataset.modified,
    },
  };
}

export async function loadSightData(): Promise<SightData | null> {
  try {
    return toSightData(await loadDataset(SIGHTS_DATASET));
  } catch {
    return null;
  }
}

/**
 * Geht es um Sehenswertes, Geschichte oder „was kann man hier machen"?
 * Wie bei Parken und Essen nur dann Daten in den Prompt; lieber ein Treffer
 * zu viel.
 */
const SIGHT_PATTERN = new RegExp(
  [
    "sehensw", "besichtig", "anschauen", "ansehen", "angucken", "museum",
    "museen", "\\bturm", "türme", "\\btor\\b", "\\btore\\b", "stadtmauer",
    "bastei", "befestigung", "rathaus", "marktplatz", "jüdisch", "juden",
    "synagoge", "friedhof", "geschichte", "historisch", "mittelalter",
    "aussicht", "ausblick", "panorama", "fotospot", "taubertal",
    "schlechtwetter", "\\bregen", "unternehmen", "erleben", "\\bmachen",
    "tipps?\\b", "highlight", "\\btop\\b", "kriminal", "folter",
    "gesehen", "unbedingt",
    // Bekannte Orte, die (noch) nicht in den Daten stehen — auch dann soll
    // die Regel „nennen, aber ohne Details" aus dem Prompt greifen.
    "plönlein", "burggarten", "jakob", "kirche", "rundgang", "spaziergang",
    "nachtwächter",
    "sight", "attraction", "\\bvisit", "tower", "\\bview", "things to do",
    "bezienswaard", "bezoeken", "観光", "博物館", "見どころ",
  ].join("|"),
  "i",
);

export function isSightQuestion(question: string): boolean {
  return SIGHT_PATTERN.test(question);
}

/** Fragewörter → passende Orte (über Themen, Art oder Beschreibung). */
const HINTS: { words: RegExp; match: (sight: Sight) => boolean }[] = [
  { words: /museum|museen|kriminal|folter/, match: (s) => s.types.includes("Museum") },
  { words: /jüdisch|juden|synagoge|friedhof|jewish/, match: (s) => s.group === "juedisch" },
  {
    words: /turm|türme|\btor|stadtmauer|bastei|befestigung|tower|wall/,
    match: (s) => s.group === "befestigung",
  },
  {
    words: /aussicht|ausblick|panorama|foto|\bview/,
    match: (s) => s.group === "aussicht" || /aussicht|blick|panorama/i.test(s.description),
  },
  { words: /regen|schlechtwetter|\brain/, match: (s) => s.topics.includes("Schlechtwettertipp") },
  { words: /hitze|heiß|schatten|abkühl/, match: (s) => s.topics.includes("Hitzeorte") },
  {
    words: /highlight|\btop\b|muss man|must.?see|unbedingt|wichtigst|bekanntest/,
    match: (s) => s.highlight,
  },
];

const GENERIC_NAME_WORDS = new Set(["rothenburg", "tauber", "jüdisches", "ehemaliger"]);

export function scoreSight(sight: Sight, question: string): number {
  const q = normalize(question);
  const name = normalize(sight.name);
  const description = normalize(sight.description);
  let score = 0;

  const nameWords = name
    .split(" ")
    .filter((word) => word.length >= 4 && !GENERIC_NAME_WORDS.has(word));
  if (nameWords.some((word) => q.includes(word))) score += 10;

  for (const hint of HINTS) {
    if (hint.words.test(q) && hint.match(sight)) score += 5;
  }
  for (const word of keywords(question)) {
    if (description.includes(word)) score += 3;
  }
  // Ohne andere Hinweise die Highlights zuerst.
  if (sight.highlight) score += 1;
  return score;
}

/**
 * So viele Orte bekommt das Modell mit Details — gleich der Obergrenze im
 * Prompt. „Höchstens fünf" allein hält das Modell nicht zuverlässig ein (im
 * Test einmal sechs), ohne Details zum sechsten kann es ihn nicht beschreiben.
 */
export const DETAIL_LIMIT = 5;

export function selectSights(
  data: SightData,
  question: string,
  limit = DETAIL_LIMIT,
): { selected: Sight[]; others: Sight[] } {
  const ranked = data.sights
    .map((sight, index) => ({ sight, index, score: scoreSight(sight, question) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.sight);
  return { selected: ranked.slice(0, limit), others: ranked.slice(limit) };
}

function sightLine(sight: Sight): string {
  const parts = [
    sight.name,
    sight.types.length > 0 && `Art: ${sight.types.join(", ")}`,
    sight.topics.length > 0 && `Themen: ${sight.topics.join(", ")}`,
    sight.description && `Beschreibung: ${truncate(sight.description, 220)}`,
    sight.address && `Adresse: ${sight.address}`,
    sight.openingHours &&
      `Öffnungszeiten (wörtlich aus den Daten): ${truncate(sight.openingHours.replace(/\s+/g, " "), 300)}`,
    sight.price && `Preise: ${sight.price}`,
    sight.attribution && `Lizenz: ${sight.attribution} (bei Nennung angeben)`,
    `Karte: ${sight.mapUrl}`,
  ];
  return `- ${parts.filter(Boolean).join(" | ")}`;
}

/** Datenblock für den Prompt — Vorauswahl wie bei den Restaurants. */
export function sightPromptData(data: SightData, question = ""): string {
  const { selected, others } = selectSights(data, question);
  const lines = [
    `Passend zur Frage ausgewählt (${selected.length} von ${data.sights.length}):`,
    ...selected.map(sightLine),
  ];
  if (others.length > 0) {
    lines.push(
      "",
      "Ebenfalls eingetragen, ohne Details:",
      others.map((sight) => sight.name).join("; "),
    );
  }
  return lines.join("\n");
}
