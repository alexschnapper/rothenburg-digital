import { sanitizeText, truncate } from "@/lib/guard/sanitize";

/**
 * Markiert eingebundene Fremdinhalte als Daten, nie als Anweisung (Issue #16).
 *
 * Dieselbe Technik wie `spotlight()` für Nutzertext (`prompt.ts`) — eigener
 * Marker-Tag `<fremdquelle>` statt `<buergerfrage>`, mit Herkunftsangabe, damit
 * die Antwort zitieren statt den Inhalt als eigenes Wissen ausgeben kann.
 *
 * Noch von keinem echten Tool genutzt — die Funktion existiert, damit die
 * erste Integration (Kandidaten: #5 Sensor.Community, #7 GitHub-Roadmap, #29
 * OSM-Geokodierung) diese Regeln einfach aufruft statt sie neu zu erfinden.
 * `systemPrompt()` erklärt das `<fremdquelle>`-Format bereits generisch.
 */

const DEFAULT_MAX_CHARS = 2000;

/**
 * Bereitet Text aus einer externen Quelle fürs Modell auf: normalisiert
 * (`sanitizeText` — derselbe Schritt wie bei Nutzertext, der Unicode-Tag-Block
 * funktioniert in einer Webseite genauso wie im Chatfeld), kürzt hart auf ein
 * Zeichenlimit pro Quelle und packt das Ergebnis in den `<fremdquelle>`-Marker
 * mit Herkunftsangabe.
 */
export function embedExternalContent(
  text: string,
  source: string,
  nonce: string,
  maxChars: number = DEFAULT_MAX_CHARS,
): string {
  const { text: cleaned } = sanitizeText(text);
  const truncated = truncate(cleaned, maxChars);
  return `<fremdquelle id="${nonce}" herkunft="${source}">\n${truncated}\n</fremdquelle>`;
}
