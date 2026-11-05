import { z } from "zod";

import { cleanDescription } from "@/lib/guard/external";
import type { PlaceRef } from "@/lib/opendata/attribution";
import { loadDataset } from "@/lib/opendata/bydata";
import {
  address,
  coordinates,
  osmUrl,
  sourceOf,
  text,
  type Coordinates,
  type SourceInfo,
} from "@/lib/opendata/common";
import {
  formatOpeningHours,
  openStatus,
  parseOpeningHours,
  statusText,
  type OpenStatus,
} from "@/lib/opendata/openingHours";
import { normalize } from "@/lib/opendata/query";

/**
 * Defibrillatoren und Hitzeorte aus den offenen Daten der Stadt (Issue #61).
 *
 * Beide Datensätze sind klein (Stand November 2026: 4 Defibrillatoren, 5
 * Hitzeorte) — keine Vorauswahl, alles geht in den Prompt.
 *
 * Wichtig bei den Defibrillatoren: Die Daten sagen nicht, **wann** ein Gerät
 * zugänglich ist. Eines hängt im Rathaus — vermutlich nur zu dessen
 * Öffnungszeiten erreichbar. Chat und Seite sagen das ausdrücklich.
 */

export const DEFIBRILLATOR_DATASET = "skg-venus-defibrillatoren";
export const HEAT_DATASET = "skg-venus-hitzeorte";

const recordSchema = z.object({
  id: z.string(),
  name: text,
  types: text,
  short_description: text,
  description: text,
  street: text,
  postal_code: text,
  city: text,
  lat: z.number(),
  lon: z.number(),
  opening_hours: text,
});

export type Spot = {
  id: string;
  name: string;
  /** „Defibrillator", „Trinkbrunnen" oder „Kühler Ort" */
  kind: "Defibrillator" | "Trinkbrunnen" | "Kühler Ort";
  description: string;
  address: string;
  mapUrl: string;
  /** Für die Feeds (#81); `null`, wenn der Punkt nicht taugt. */
  coordinates: Coordinates | null;
  /** Lesbare Öffnungszeiten, leer wenn nicht angegeben oder unlesbar */
  hoursLines: string[];
  status: OpenStatus | null;
};

export type EmergencyData = {
  defibrillators: Spot[];
  heat: Spot[];
  sources: SourceInfo[];
};

/** „Defibrillator Rathaus Rothenburg ob der Tauber" → „Defibrillator Rathaus" */
const cleanName = (name: string) =>
  name
    .replace(/\s+_\s+/g, " – ")
    .replace(/\s+Rothenburg( ob der Tauber)?(?=$|\s+\()/g, "")
    .trim();

function kindOf(name: string, dataset: string): Spot["kind"] {
  if (dataset === DEFIBRILLATOR_DATASET) return "Defibrillator";
  return /trinkbrunnen|brunnen/i.test(name) ? "Trinkbrunnen" : "Kühler Ort";
}

export function toSpot(raw: unknown, dataset: string, now: Date): Spot | null {
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.name) return null;
  const record = parsed.data;
  const name = cleanName(record.name);
  const description = cleanDescription(
    record.short_description || record.description,
    `${dataset} ${record.id}`,
  );
  const hours = parseOpeningHours(record.opening_hours);
  return {
    id: record.id,
    name,
    kind: kindOf(record.name, dataset),
    // Manche Einträge wiederholen als Beschreibung nur den Namen.
    description: normalize(description).startsWith(normalize(name)) ? "" : description,
    address: address(record.street, record.postal_code, record.city),
    mapUrl: osmUrl(record.lat, record.lon),
    coordinates: coordinates(record.lat, record.lon),
    hoursLines: hours ? formatOpeningHours(hours) : [],
    status: hours ? openStatus(hours, now) : null,
  };
}

const spots = (items: unknown[], dataset: string, now: Date) =>
  items
    .map((item) => toSpot(item, dataset, now))
    .filter((spot): spot is Spot => spot !== null);

export async function loadEmergencyData(now = new Date()): Promise<EmergencyData | null> {
  try {
    const [defibrillators, heat] = await Promise.all([
      loadDataset(DEFIBRILLATOR_DATASET),
      loadDataset(HEAT_DATASET),
    ]);
    return {
      defibrillators: spots(defibrillators.items, DEFIBRILLATOR_DATASET, now),
      heat: spots(heat.items, HEAT_DATASET, now).sort(
        (a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "de") : a.kind === "Trinkbrunnen" ? -1 : 1),
      ),
      sources: [
        sourceOf(defibrillators, "Defibrillatoren"),
        sourceOf(heat, "Hitzeorte"),
      ],
    };
  } catch {
    return null;
  }
}

/**
 * Notfall, Defibrillator, Hitze, Trinkwasser? Bewusst breit — im Notfall ist
 * ein verpasster Treffer viel teurer als ein paar Token.
 */
const EMERGENCY_PATTERN = new RegExp(
  [
    "defi", "\\baed\\b", "notfall", "notruf", "notarzt", "rettungsdienst",
    "\\b112\\b", "herz", "bewusstlos", "umgekippt", "zusammengebrochen",
    "kollabiert", "atmet nicht", "wiederbeleb", "reanimation", "erste hilfe",
    "hitze", "\\bheiß", "\\bwarm", "sonne", "schatten", "\\bkühl", "abkühl",
    "trinkwasser", "trinkbrunnen", "brunnen", "wasser auffüllen", "flasche",
    "durst",
    "emergency", "cardiac", "\\bcpr\\b", "heat", "\\bhot\\b", "drinking water",
    "fountain", "collaps", "unconscious", "not breathing", "stopped breathing",
    "heart attack", "ambulance", "fainted", "passed out", "\\bhelp\\b",
    "noodgeval", "bewusteloos", "ademt niet", "ambulance", "hartaanval",
    "hitte", "救急", "熱中症", "意識", "心停止", "倒れ", "brustschmerz",
  ].join("|"),
  "i",
);

/**
 * Enger als `EMERGENCY_PATTERN` (#74): nur Fragen, vor deren Antwort der
 * Server den Notruf-Satz setzt — Defibrillator oder ein akuter Notfall, nicht
 * Hitze, Trinkbrunnen oder Schatten.
 */
const ACUTE_EMERGENCY_PATTERN = new RegExp(
  [
    "defi", "\\baed\\b", "notfall", "notruf", "notarzt", "rettungsdienst",
    "\\b112\\b", "bewusstlos", "umgekippt", "zusammengebrochen", "kollabiert",
    "atmet nicht", "wiederbeleb", "reanimation", "herzinfarkt",
    "herzstillstand", "brustschmerz", "erste hilfe", "erste-hilfe",
    "emergency", "cardiac", "\\bcpr\\b", "unconscious", "not breathing",
    "stopped breathing", "heart attack", "ambulance", "collaps", "fainted",
    "passed out",
    "noodgeval", "bewusteloos", "ademt niet", "hartaanval", "reanimatie",
    "救急", "意識", "心停止", "倒れ",
  ].join("|"),
  "i",
);

export function isAcuteEmergencyQuestion(question: string): boolean {
  return ACUTE_EMERGENCY_PATTERN.test(question);
}

export type QuestionLanguage = "de" | "en" | "nl" | "ja";

/** Häufige kurze Wörter, an denen sich die Sprache einer Frage zeigt. */
const LANGUAGE_WORDS: [QuestionLanguage, RegExp][] = [
  ["de", /\b(wo|gibt|ist|der|die|das|ein|eine|einen|mein|meine|nicht|hat|es|jemand|hilfe|und|ich)\b/gi],
  ["en", /\b(where|is|are|the|there|my|not|what|help|nearest|does|have|someone|and|i)\b/gi],
  ["nl", /\b(waar|het|een|mijn|niet|heeft|iemand|hulp|en|ik|er)\b/gi],
];

/**
 * Sprache der Frage für den Notruf-Satz (#74) — grob, aber ohne Modell.
 * `null`, wenn sie sich nicht eindeutig bestimmen lässt.
 */
export function questionLanguage(question: string): QuestionLanguage | null {
  if (/[぀-ヿ一-龯]/.test(question)) return "ja";
  const scores = LANGUAGE_WORDS.map(
    ([language, words]) => [language, question.match(words)?.length ?? 0] as const,
  ).sort((a, b) => b[1] - a[1]);
  const [best, second] = scores;
  return best[1] > 0 && best[1] > second[1] ? best[0] : null;
}

/** Orte für die Kartenlinks unter der Antwort (#63). */
export function emergencyPlaces(data: EmergencyData): PlaceRef[] {
  const refs = (spots: Spot[], source: SourceInfo) =>
    spots.map((spot) => ({ label: spot.name, mapUrl: spot.mapUrl, source }));
  return [...refs(data.defibrillators, data.sources[0]), ...refs(data.heat, data.sources[1])];
}

export function isEmergencyQuestion(question: string): boolean {
  return EMERGENCY_PATTERN.test(question);
}

function spotLine(spot: Spot): string {
  const parts = [
    spot.name,
    `Art: ${spot.kind}`,
    spot.description && `Beschreibung: ${spot.description}`,
    spot.address && `Adresse: ${spot.address}`,
    spot.hoursLines.length > 0 && `Öffnungszeiten: ${spot.hoursLines.join("; ")}`,
    spot.status && `Jetzt: ${statusText(spot.status)}`,
    spot.kind === "Defibrillator" && "Zugänglichkeit: nicht in den Daten angegeben",
  ];
  return `- ${parts.filter(Boolean).join(" | ")}`;
}

/** Datenblock für den Prompt, ohne Marker — den setzt `embedExternalContent`. */
export function emergencyPromptData(data: EmergencyData): string {
  return [
    "Defibrillatoren (AED):",
    ...(data.defibrillators.length > 0 ? data.defibrillators.map(spotLine) : ["- keine Einträge"]),
    "",
    "Hitzeorte (Trinkbrunnen und kühle Orte):",
    ...(data.heat.length > 0 ? data.heat.map(spotLine) : ["- keine Einträge"]),
  ].join("\n");
}
