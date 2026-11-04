import { describe, expect, it } from "vitest";

import { eventToday, shortText, sightOfDay } from "@/lib/opendata/dailyFact";

const SOURCE = "https://rothenburg.bydata.de/datasets/x?locale=de";
const day = (iso: string) => new Date(`${iso}T12:00:00+01:00`);

const sight = (name: string, license = "CC0 1.0") => ({
  name: `${name} Rothenburg ob der Tauber`,
  short_description: `${name} ist sehenswert. Zweiter Satz. Dritter Satz.`,
  license,
  lat: 49.377,
  lon: 10.179,
});

describe("shortText", () => {
  it("nimmt höchstens zwei Sätze", () => {
    expect(shortText("Eins. Zwei! Drei?")).toBe("Eins. Zwei!");
  });

  it("kürzt einen überlangen Satz mit Auslassungszeichen", () => {
    const text = shortText("A".repeat(400) + ".", 50);
    expect(text).toHaveLength(50);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("sightOfDay", () => {
  const items = [sight("Plönlein"), sight("Markusturm"), sight("Pulverturm", "CC BY 4.0")];

  it("wählt am selben Tag immer dieselbe Sehenswürdigkeit", () => {
    expect(sightOfDay(items, day("2026-11-04"), SOURCE)).toEqual(
      sightOfDay(items, day("2026-11-04"), SOURCE),
    );
  });

  it("nimmt nur CC0-Einträge und kürzt den Ortsnamen", () => {
    for (const iso of ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]) {
      const fact = sightOfDay(items, day(iso), SOURCE);
      expect(fact?.title).not.toContain("Pulverturm");
      expect(fact?.title).not.toContain("Rothenburg ob der Tauber");
      expect(fact?.text).toMatch(/ist sehenswert\. Zweiter Satz\.$/);
    }
  });

  it("gibt ohne passende Einträge null zurück", () => {
    expect(sightOfDay([sight("Pulverturm", "CC BY 4.0")], day("2026-11-04"), SOURCE)).toBeNull();
  });
});

describe("eventToday", () => {
  const events = [
    { name: "Rothenburger Reiterlesmarkt", start_date: "2026-11-20", short_description: "Weihnachtsmarkt." },
  ];

  it("meldet eine Veranstaltung am selben Tag", () => {
    expect(eventToday(events, day("2026-11-20"), SOURCE)).toMatchObject({
      kind: "event",
      title: "Heute in Rothenburg: Rothenburger Reiterlesmarkt",
    });
  });

  it("schweigt an anderen Tagen", () => {
    expect(eventToday(events, day("2026-11-19"), SOURCE)).toBeNull();
  });
});
