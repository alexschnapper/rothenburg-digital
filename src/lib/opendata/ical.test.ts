import { describe, expect, it } from "vitest";

import type { SourceInfo } from "@/lib/opendata/common";
import { FEED_INFO, type Feed, type FeedEntry } from "@/lib/opendata/feeds";
import { escapeText, foldLine, toICalendar } from "@/lib/opendata/ical";

const source: SourceInfo = {
  label: "Top Events Rothenburg",
  url: "https://rothenburg.bydata.de/datasets/skg-venus-top-events-rothenburg?locale=de",
  modified: "2026-10-30",
  license: { label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
};

const entry = (overrides: Partial<FeedEntry>): FeedEntry => ({
  id: "markt-2026-11-21",
  name: "Rothenburger Reiterlesmarkt",
  category: "Veranstaltung",
  schemaType: "Event",
  description: "Der Weihnachtsmarkt in der Altstadt",
  address: "Marktplatz, 91541 Rothenburg ob der Tauber",
  coordinates: [10.179247, 49.377],
  website: "https://www.rothenburg-tourismus.de/",
  openingHours: [],
  attribution: null,
  dates: { start: "2026-11-21", end: "2026-11-21" },
  source,
  ...overrides,
});

const feed = (entries: FeedEntry[]): Feed => ({ name: "termine", ...FEED_INFO.termine, entries, sources: [source] });

const NOW = new Date("2026-11-06T09:30:00Z");

describe("iCalendar (#36)", () => {
  const ics = toICalendar(
    feed([entry({}), entry({ id: "theater", name: "Toppler Theater", dates: { start: null, end: null } })]),
    "https://rothenburg.digital",
    NOW,
  );
  const lines = ics.split("\r\n");

  it("ist ein Kalender mit CRLF und abschließendem Zeilenende", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("ganztägig: DTEND ist der Tag nach dem letzten Tag", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261121\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261122\r\n");
    expect(ics).toContain("DTSTAMP:20261106T093000Z\r\n");
    expect(ics).toContain("UID:markt-2026-11-21@rothenburg.digital\r\n");
  });

  it("lässt Einträge ohne Datum weg", () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).not.toContain("Toppler");
  });

  it("nennt Quelle und Lizenz in der Beschreibung", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("Quelle: Top Events Rothenburg");
    expect(unfolded).toContain("Lizenz CC0 1.0");
    expect(unfolded).toContain("GEO:49.377;10.179247");
  });

  it("keine Zeile länger als 75 Byte", () => {
    for (const line of lines) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});

describe("Hilfen für iCalendar", () => {
  it("maskiert Backslash, Semikolon, Komma und Zeilenumbruch", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("faltet nach Bytes und zerschneidet keine Umlaute", () => {
    const folded = foldLine(`DESCRIPTION:${"ä".repeat(100)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(Buffer.byteLength(part)).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((part) => part.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`DESCRIPTION:${"ä".repeat(100)}`);
  });
});
