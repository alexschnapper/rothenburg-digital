import { germanDate, OPEN_DATA_SOURCE, type SourceInfo } from "@/lib/opendata/common";
import { normalize as normalizeQuery } from "@/lib/opendata/query";

/**
 * Kartenlinks und Quellenangabe vom Server statt vom Modell (Issue #63).
 *
 * Abgeschrieben vom Modell gingen beide gelegentlich schief: eine falsche
 * Ziffer in der Koordinate (#58), „/ Open Data" fehlte in der Quelle (#59).
 * Das Modell nennt deshalb nur noch die Orte. Der Server sucht danach im
 * fertigen Antworttext, welche Orte aus den eingebundenen Daten genannt sind,
 * und hängt deren Kartenlinks und die Quelle im festen Wortlaut an.
 */

/** Ein Ort aus den offenen Daten, wie er im Antworttext vorkommen kann. */
export type PlaceRef = {
  /** Anzeigename im Anhang, z. B. „P4" oder „Konditorei - Café Prezel". */
  label: string;
  /** Weitere Schreibweisen, z. B. der volle Name „Parkplatz P4 …". */
  aliases?: string[];
  mapUrl: string;
  source: SourceInfo;
};

/**
 * Wie `normalize` aus `query.ts`, zusätzlich Bindestriche als Leerzeichen —
 * das Modell schreibt „Candy Castle – Bonbonmanufaktur" statt „- …".
 */
const normalize = (value: string) => normalizeQuery(value.replace(/-/g, " "));

/** Gattungswörter am Namensanfang, die das Modell oft weglässt. */
const GENERIC_PREFIX =
  /^(defibrillator|restaurant|gasthaus|gasthof|konditorei café|konditorei|café|cafe|weinstube|parkplatz|e ladesäule)\s+/;

/** „… Rothenburg", „… Rothenburg o.d.T.", „… Rothenburg ob der Tauber" am Ende. */
const TOWN_SUFFIX = /\s+rothenburg(\s+o\s*d\s*t|\s+ob der tauber)?$/;

/** Kurze Füllwörter, die zwischen den Wörtern eines Namens stehen dürfen. */
const FILLER = "am|an|der|die|das|im|in|bei|beim|vom|von|zum|zur|at|the|on";

/**
 * Kurzformen, die auch andere Orte meinen können: „Defibrillator Rathaus"
 * wird nicht schon durch „Rathaus" getroffen. Heißt ein Ort selbst so (die
 * Sehenswürdigkeit „Rathaus"), zählt der volle Name weiterhin.
 */
const TOO_GENERIC = new Set(["marktplatz", "rathaus", "trinkbrunnen", "kapellenplatz"]);

const usable = (key: string) => /^p\d$/.test(key) || key.length >= 4;

/** Schreibweisen eines Orts, längste zuerst. */
export function placeKeys(place: PlaceRef): string[] {
  const keys = new Set<string>();
  for (const name of [place.label, ...(place.aliases ?? [])]) {
    const full = normalize(name);
    const withoutBrackets = normalize(name.replace(/\([^)]*\)/g, " "));
    for (const variant of [full, withoutBrackets]) {
      if (usable(variant)) keys.add(variant);
      const core = variant.replace(TOWN_SUFFIX, "").replace(GENERIC_PREFIX, "");
      if (usable(core) && !TOO_GENERIC.has(core)) keys.add(core);
    }
  }
  return [...keys].sort((a, b) => b.length - a.length);
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** „trinkbrunnen marktplatz" passt auch auf „Trinkbrunnen am Marktplatz". */
function keyPattern(key: string): RegExp {
  const words = key.split(" ").map(escape);
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${words.join(`(?:\\s+(?:${FILLER})){0,2}\\s+`)}(?![\\p{L}\\p{N}])`,
    "gu",
  );
}

/**
 * Orte, die im Antworttext genannt sind, in der Reihenfolge ihrer ersten
 * Nennung. Längere Schreibweisen gewinnen: „Trinkbrunnen Marktplatz" belegt
 * die Textstelle, der Ort „Marktplatz" zählt dort nicht mehr.
 */
export function mentionedPlaces(answer: string, places: PlaceRef[]): PlaceRef[] {
  const text = normalize(answer);
  const candidates = places.flatMap((place, order) =>
    placeKeys(place).map((key) => ({ place, order, key })),
  );
  candidates.sort((a, b) => b.key.length - a.key.length || a.order - b.order);

  const taken: [number, number][] = [];
  const firstHit = new Map<PlaceRef, number>();
  for (const { place, key } of candidates) {
    for (const match of text.matchAll(keyPattern(key))) {
      const start = match.index;
      const end = start + match[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      if (!firstHit.has(place) || start < firstHit.get(place)!) {
        firstHit.set(place, start);
      }
    }
  }

  // Nicht nach Kartenlink zusammenfassen: In den Daten teilen sich mitunter
  // verschiedene Orte dieselben Koordinaten (siehe `withReliableMapUrls`).
  return [...firstHit.entries()].sort((a, b) => a[1] - b[1]).map(([place]) => place);
}

/** Höchstens so viele Kartenlinks — mehr Orte nennt das Modell ohnehin nicht. */
const MAX_LINKS = 8;

/** „Restaurants, Stand 28.10.2026, Lizenz CC BY 4.0" mit Link zum Datensatz. */
function sourceLine(source: SourceInfo): string {
  const stand = germanDate(source.modified);
  const license = source.license
    ? source.license.url
      ? `, Lizenz [${source.license.label}](${source.license.url})`
      : `, Lizenz ${source.license.label}`
    : "";
  return `[${source.label}](${source.url})${stand ? `, Stand ${stand}` : ""}${license}`;
}

/**
 * Anhang für die Antwort: Kartenlinks der genannten Orte und die Quelle der
 * Datensätze, aus denen sie stammen. Leer, wenn kein Ort genannt ist — dann
 * hat die Antwort die Daten nicht verwendet.
 */
export function attributionMarkdown(answer: string, places: PlaceRef[]): string {
  const mentioned = mentionedPlaces(answer, places).slice(0, MAX_LINKS);
  if (mentioned.length === 0) return "";

  const sources = [...new Map(mentioned.map((place) => [place.source.url, place.source])).values()];
  const links = mentioned.map((place) => `[${place.label}](${place.mapUrl})`).join(" · ");
  return [
    `**Auf der Karte:** ${links}`,
    `Quelle: ${OPEN_DATA_SOURCE} – ${sources.map(sourceLine).join("; ")}`,
  ].join("\n\n");
}
