import { describe, expect, it } from "vitest";

import type { Dataset } from "@/lib/opendata/bydata";
import { toEvent, toEventData } from "@/lib/opendata/events";
import { eventFeed, toGeoJson } from "@/lib/opendata/feeds";

/** Gekürzt wie in „Top Events Rothenburg“: ein Eintrag je Tag, gleiche `id`. */
const market = (day: string) => ({
  id: "63bed9886be70d540ec551f5",
  name: "Rothenburger Reiterlesmarkt",
  short_description: "Der Weihnachtsmarkt in der romantischen Altstadt von Rothenburg ob der Tauber",
  description: "",
  street: "Marktplatz",
  postal_code: "91541",
  city: "Rothenburg ob der Tauber",
  lat: 49.377,
  lon: 10.1792474,
  url: "www.rothenburg-tourismus.de",
  start_date: day,
  end_date: day,
});

const theater = {
  ...market(""),
  id: "theater",
  name: "Toppler Theater",
  short_description: "Spielzeit 2027: Juni bis August",
  street: "Klosterhof 6",
  url: "http://www.toppler-theater.de/",
};

const dataset = (items: unknown[]): Dataset => ({
  id: "skg-venus-top-events-rothenburg",
  items,
  modified: "2026-10-30",
  license: { label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  pageUrl: "https://rothenburg.bydata.de/datasets/skg-venus-top-events-rothenburg?locale=de",
  fetchedAt: new Date(),
});

// 20.11.2026, 23:30 Uhr deutscher Zeit — in UTC schon 22:30 desselben Tages.
const NOW = new Date("2026-11-20T22:30:00Z");

describe("Termine aus Top Events (#36)", () => {
  it("macht jeden Tag zu einem eigenen Termin mit eindeutiger Kennung", () => {
    const event = toEvent(market("2026-11-21"))!;
    expect(event.id).toBe("63bed9886be70d540ec551f5-2026-11-21");
    expect(event.start).toBe("2026-11-21");
    expect(event.end).toBe("2026-11-21");
    expect(event.website).toBe("https://www.rothenburg-tourismus.de/");
    expect(event.coordinates).toEqual([10.179247, 49.377]);
  });

  it("behält Einträge ohne Datum, ohne Datum", () => {
    const event = toEvent(theater)!;
    expect(event).toMatchObject({ id: "theater", start: null, end: null, website: "https://www.toppler-theater.de/" });
  });

  it("zeigt nur heutige und kommende Termine, nach deutscher Zeit; ohne Datum am Ende", () => {
    const data = toEventData(dataset([theater, market("2026-11-21"), market("2026-11-19"), market("2026-11-20")]), NOW);
    expect(data.events.map((event) => event.start)).toEqual(["2026-11-20", "2026-11-21", null]);
    expect(data.source.label).toBe("Top Events Rothenburg");
  });

  it("ein Ende vor dem Beginn zählt als eintägig", () => {
    expect(toEvent({ ...market("2026-11-21"), end_date: "2026-11-01" })!.end).toBe("2026-11-21");
  });

  it("GeoJSON nennt Beginn und Ende, auch null bei Einträgen ohne Datum", () => {
    const geojson = toGeoJson(eventFeed(toEventData(dataset([market("2026-11-21"), theater]), NOW)), "https://rothenburg.digital");
    expect(geojson.features.map((feature) => feature.properties)).toEqual([
      expect.objectContaining({ name: "Rothenburger Reiterlesmarkt", start_date: "2026-11-21", end_date: "2026-11-21" }),
      expect.objectContaining({ name: "Toppler Theater", start_date: null, end_date: null }),
    ]);
    expect(geojson.license).toEqual({ name: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" });
  });
});
