/**
 * Normalisierung von Nutzertext, bevor er an ein Modell geht.
 *
 * Hintergrund: Ein großer Teil der Prompt-Injection-Tricks steckt nicht im
 * sichtbaren Text, sondern in Zeichen, die der Mensch nicht sieht und das
 * Modell trotzdem liest:
 *
 * - **Unicode-Tag-Block** (U+E0000-U+E007F): eine komplette unsichtbare Kopie
 *   des ASCII-Zeichensatzes. Damit lässt sich ein ganzer Angriffs-Prompt in
 *   einen harmlos aussehenden Satz schmuggeln.
 * - **Zero-Width- und Bidi-Zeichen**: zerlegen Schlüsselwörter, sodass
 *   Mustererkennung sie nicht mehr findet ("ig[ZWSP]noriere").
 * - **Kompatibilitätszeichen**: Fullwidth-Buchstaben, mathematische Alphabete,
 *   Ligaturen — vom Modell wie normale Buchstaben gelesen, von naiven Filtern
 *   nicht.
 *
 * Reihenfolge: erst NFKC (macht Kompatibilitätsvarianten zu normalen Zeichen),
 * dann Unsichtbares und Steuerzeichen entfernen. Erst danach greifen die
 * Heuristiken in `screen.ts` — und zwar auf genau dem Text, den auch das
 * Modell sieht.
 *
 * Die Zeichenmengen stehen absichtlich als Code-Point-Bereiche und nicht als
 * Regex mit Literalzeichen: so bleibt die Datei lesbar und diffbar, ohne
 * unsichtbare Bytes im Quellcode.
 */

type Range = readonly [number, number];

/** Unsichtbare bzw. richtungssteuernde Zeichen. */
const INVISIBLE_RANGES: readonly Range[] = [
  [0x00ad, 0x00ad], // Soft Hyphen
  [0x034f, 0x034f], // Combining Grapheme Joiner
  [0x061c, 0x061c], // Arabic Letter Mark
  [0x180e, 0x180e], // Mongolian Vowel Separator
  [0x200b, 0x200f], // Zero Width Space … Right-to-Left Mark
  [0x202a, 0x202e], // Bidi-Embedding und -Override
  [0x2060, 0x2064], // Word Joiner … Invisible Plus
  [0x2066, 0x2069], // Bidi-Isolates
  [0xfe00, 0xfe0f], // Variation Selectors
  [0xfeff, 0xfeff], // BOM / Zero Width No-Break Space
  [0xe0000, 0xe007f], // Unicode-Tag-Block (unsichtbare ASCII-Kopie)
];

/** Steuerzeichen — ohne Tab (0x09), LF (0x0a) und CR (0x0d). */
const CONTROL_RANGES: readonly Range[] = [
  [0x0000, 0x0008],
  [0x000b, 0x000c],
  [0x000e, 0x001f],
  [0x007f, 0x007f],
];

const inRanges = (codePoint: number, ranges: readonly Range[]): boolean =>
  ranges.some(([from, to]) => codePoint >= from && codePoint <= to);

export type SanitizedText = {
  /** Bereinigter Text — dieser geht ans Modell und in die Heuristik. */
  text: string;
  /**
   * Anzahl entfernter unsichtbarer/steuernder Zeichen.
   *
   * Ein Wert > 0 ist kein Beweis für einen Angriff (Copy-und-Paste aus Word
   * bringt gern Soft Hyphens mit), aber ein brauchbares Signal fürs Log.
   */
  removed: number;
};

export function sanitizeText(input: string): SanitizedText {
  let stripped = "";
  let removed = 0;

  // Iteration über Code Points (nicht über UTF-16-Einheiten), damit der
  // Tag-Block oberhalb von U+FFFF korrekt erkannt wird.
  for (const char of input.normalize("NFKC")) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (
      inRanges(codePoint, INVISIBLE_RANGES) ||
      inRanges(codePoint, CONTROL_RANGES)
    ) {
      removed += 1;
      continue;
    }
    stripped += char;
  }

  const text = stripped
    .replace(/\r\n?/g, "\n")
    // Mehr als eine Leerzeile hat keinen Informationswert, kostet aber Token.
    .replace(/\n{3,}/g, "\n\n")
    // Lange Leerzeichen-/Tab-Ketten ebenso (klassischer Token-Füller).
    .replace(/[ \t]{4,}/g, " ")
    .trim();

  return { text, removed };
}

/** Kürzt harte Overlängen und markiert die Kürzung sichtbar. */
export function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`;
}
