import { feedAttribution, feedLicense, type Feed } from "@/lib/opendata/feeds";
import { SITE } from "@/lib/site";

/**
 * Termin-Feed als iCalendar (RFC 5545, Issue #36), zum Abonnieren in jedem
 * Kalender. Ein `VEVENT` je Eintrag mit Datum, ganztägig: Die Quelle nennt
 * keine Uhrzeiten. Einträge ohne Datum fehlen hier, stehen aber im GeoJSON.
 *
 * Was RFC 5545 verlangt und hier sicher sein muss:
 * - Zeilenende CRLF, Zeilen höchstens 75 Byte (UTF-8), Fortsetzung mit
 *   führendem Leerzeichen — ohne ein Zeichen in der Mitte zu teilen.
 * - In Texten `\`, `;`, `,` und Zeilenumbrüche maskieren.
 * - `DTEND` bei ganztägigen Terminen ist der Tag **nach** dem letzten Tag.
 */

/** Text für eine Eigenschaft maskieren (RFC 5545, 3.3.11). */
export const escapeText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/** Zeile auf höchstens 75 Byte falten, ohne UTF-8-Zeichen zu zerschneiden. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    // Fortsetzungszeilen beginnen mit einem Leerzeichen, das mitzählt.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** `2026-11-20` → `20261120` */
const basicDate = (iso: string) => iso.replace(/-/g, "");

/** Tag danach, für das ausschließende `DTEND`. */
function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** `2026-11-06T09:30:00.000Z` → `20261106T093000Z` */
const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const host = new URL(SITE.url).hostname;

export function toICalendar(feed: Feed, origin: string, now: Date): string {
  const stamp = utcStamp(now);
  const license = feedLicense(feed.sources);
  const attribution = feedAttribution(feed);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE.name}//Termine//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(feed.title)}`,
    `X-WR-CALDESC:${escapeText(`${feed.description} ${attribution}`)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    // Kalender-Apps fragen einmal täglich nach; die Quelle ändert sich höchstens wöchentlich.
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
  ];

  for (const entry of feed.entries) {
    const start = entry.dates?.start;
    if (!start) continue;
    const end = entry.dates?.end ?? start;
    const description = [
      entry.description,
      `Quelle: ${entry.source.label} (${entry.source.url})${license ? `, Lizenz ${license.label}` : ""}. Feed: ${origin}/daten`,
    ]
      .filter(Boolean)
      .join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${basicDate(start)}`,
      `DTEND;VALUE=DATE:${basicDate(nextDay(end))}`,
      `SUMMARY:${escapeText(entry.name)}`,
      `DESCRIPTION:${escapeText(description)}`,
      ...(entry.address ? [`LOCATION:${escapeText(entry.address)}`] : []),
      ...(entry.coordinates ? [`GEO:${entry.coordinates[1]};${entry.coordinates[0]}`] : []),
      ...(entry.website ? [`URL:${entry.website}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
