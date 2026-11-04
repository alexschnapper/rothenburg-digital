import { describe, expect, it } from "vitest";

import { restaurantSection } from "@/lib/guard/prompt";
import type { Dataset } from "@/lib/opendata/bydata";
import {
  isFoodQuestion,
  restaurantPromptData,
  selectRestaurants,
  toRestaurant,
  toRestaurantData,
} from "@/lib/opendata/restaurants";

/** Gekürzte Datensätze im Format von opendata.rothenburg-tourismus.de. */
const trattoria = {
  id: "t1",
  name: "Trattoria Pane e Vino",
  types: "Restaurant",
  cuisine: "Italienisch; Pizza",
  short_description: "",
  description: "Italienische Küche am Plönlein.",
  street: "Untere Schmiedgasse 1",
  postal_code: "91541",
  city: "Rothenburg ob der Tauber",
  lat: 49.3741,
  lon: 10.1782,
  opening_hours: "Di, Mi, Do, Fr, Sa, So 17:00-21:00; Di, Mi, Do, Fr, Sa, So 11:30-14:00",
  contact_phone: "09861 1234",
  url: "www.example-trattoria.de",
};
const ohneZeiten = {
  ...trattoria,
  id: "b1",
  name: "Bronnenmühle _ Unter den Linden",
  types: "Biergarten",
  cuisine: "",
  opening_hours: "",
  contact_phone: "",
  url: "",
};

const dataset: Dataset = {
  id: "skg-venus-restaurants",
  items: [trattoria, ohneZeiten, { id: "kaputt" }],
  modified: "2026-10-22",
  pageUrl: "https://rothenburg.bydata.de/datasets/skg-venus-restaurants?locale=de",
  license: { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  fetchedAt: new Date(),
};

/** Mi 4.11.2026, 12:00 deutsche Zeit */
const NOON = new Date("2026-11-04T12:00+01:00");

describe("toRestaurant", () => {
  it("bildet Art, Küche, Öffnungszeiten und Webseite", () => {
    expect(toRestaurant(trattoria)).toMatchObject({
      types: ["Restaurant"],
      cuisine: ["Italienisch", "Pizza"],
      description: "Italienische Küche am Plönlein.",
      phone: "09861 1234",
      website: "https://www.example-trattoria.de/",
      hoursLines: ["Mo geschlossen", "Di–So 11:30–14:00 und 17:00–21:00 Uhr"],
    });
  });

  it("räumt Namen auf und kommt ohne Öffnungszeiten aus", () => {
    expect(toRestaurant(ohneZeiten)).toMatchObject({
      name: "Bronnenmühle – Unter den Linden",
      hours: null,
      hoursLines: [],
      phone: null,
      website: null,
    });
  });
});

describe("toRestaurantData", () => {
  it("überspringt kaputte Einträge und sortiert nach Name", () => {
    const data = toRestaurantData(dataset);
    expect(data.restaurants.map((restaurant) => restaurant.id)).toEqual(["b1", "t1"]);
    expect(data.source.modified).toBe("2026-10-22");
  });
});

describe("isFoodQuestion", () => {
  it.each([
    "Wo kann ich gut essen?",
    "Welches Restaurant hat jetzt noch offen?",
    "Gibt es ein Café am Marktplatz?",
    "Wo bekomme ich Schneeballen?",
    "Where can I have dinner tonight?",
    "Waar kan ik eten?",
    "おすすめのレストランは？",
  ])("erkennt „%s“", (question) => {
    expect(isFoodQuestion(question)).toBe(true);
  });

  it.each([
    "Wo kann ich parken?",
    "Wann tagt der Stadtrat?",
    "Wie wird das Wetter morgen?",
  ])("ignoriert „%s“", (question) => {
    expect(isFoodQuestion(question)).toBe(false);
  });
});

describe("restaurantPromptData", () => {
  it("nennt den vom Server berechneten Status und Lücken", () => {
    const lines = restaurantPromptData(toRestaurantData(dataset), NOON);
    expect(lines).toContain("Jetzt: jetzt geöffnet bis 14:00 Uhr");
    expect(lines).toContain("Öffnungszeiten: nicht angegeben");
    expect(lines).toContain("Karte: https://www.openstreetmap.org/?mlat=");
  });
});

describe("restaurantSection", () => {
  it("packt die Daten in einen fremdquelle-Marker mit Quelle und Stand", () => {
    const section = restaurantSection(toRestaurantData(dataset), "n1", NOON);
    expect(section).toContain(
      '<fremdquelle id="n1" herkunft="Offene Daten / Open Data der Stadt Rothenburg ob der Tauber (bydata)">',
    );
    expect(section).toContain("Stand 22.10.2026");
    expect(section).toContain("nicht vollständig");
    expect(section).toContain("Rechne nicht selbst nach");
  });

  it("verbietet bei Ausfall Angaben aus eigenem Wissen", () => {
    const section = restaurantSection(null, "n1", NOON);
    expect(section).toContain("gerade nicht");
    expect(section).not.toContain("<fremdquelle");
  });
});

describe("selectRestaurants", () => {
  const base = { ...trattoria, description: "", url: "", contact_phone: "" };
  const many: Dataset = {
    ...dataset,
    items: [
      { ...base, id: "it", name: "Trattoria Pane e Vino" },
      { ...base, id: "gr", name: "Restaurant Delphi", cuisine: "Griechisch", opening_hours: "Mo, Di, Mi, Do, Fr, Sa, So 11:30-14:30" },
      { ...base, id: "ak", name: "Gasthaus Alter Keller", cuisine: "Fränkisch", description: "Fränkische Küche: Schnitzel, Schäufele", opening_hours: "Sa, So ab 11:30; Mi, Do, Fr ab 17:30" },
      { ...base, id: "pu", name: "Weinstube Zum Pulverer", cuisine: "Fränkisch", opening_hours: "Mi, Do, Fr 17:00-23:00" },
      { ...base, id: "ca", name: "Café Einzigartig", types: "Café", cuisine: "", opening_hours: "Di, Mi, Do, Fr, Sa, So 09:00-17:00" },
      { ...base, id: "ba", name: "Brot & Zeit", types: "Bäckerei; Café", cuisine: "", opening_hours: "So 07:30-19:00; Mo, Di, Mi, Do, Fr, Sa 07:00-19:00" },
      { ...base, id: "le", name: "Café Lebenslust", types: "Café", cuisine: "", opening_hours: "Do, Fr, Sa, So 09:00-17:30" },
      { ...base, id: "ro", name: "Roma Rothenburg", cuisine: "Italienisch", opening_hours: "Mo, Di, Do, Fr, Sa, So 11:30-22:30" },
    ],
  };
  const data = toRestaurantData(many);
  const ids = (question: string, limit = 3) =>
    selectRestaurants(data, question, NOON, limit).selected.map((restaurant) => restaurant.id);

  it("findet einen genannten Betrieb über den Namen", () => {
    expect(ids("Hat die Trattoria heute offen?", 1)).toEqual(["it"]);
  });

  it("findet ein Gericht aus der Beschreibung genau dieses Betriebs", () => {
    expect(ids("Wo gibt es Schäufele?", 1)).toEqual(["ak"]);
  });

  it("bevorzugt die gefragte Küche", () => {
    expect(ids("Ich hätte Lust auf italienisch")).toEqual(expect.arrayContaining(["it", "ro"]));
  });

  it("bevorzugt bei „jetzt“ geöffnete Betriebe", () => {
    // Mi 12:00: Lebenslust (Do–So) und Pulverer (ab 17 Uhr) sind zu
    const selected = ids("Welches Café hat jetzt offen?", 2);
    expect(selected).toEqual(expect.arrayContaining(["ca", "ba"]));
  });

  it("bevorzugt Betriebe, die am gefragten Tag öffnen", () => {
    // Montag: Lebenslust, Café Einzigartig, Trattoria und Pulverer sind zu
    expect(ids("Welches Café hat am Montag offen?", 1)).toEqual(["ba"]);
  });

  it("nennt die übrigen Betriebe nur mit Namen", () => {
    const text = restaurantPromptData(data, NOON, "Wo gibt es Schäufele?");
    expect(text).toContain("Passend zur Frage ausgewählt (5 von 8):");
    expect(text).toContain("Ebenfalls eingetragen, ohne Details:");
    expect(text.match(/Karte: /g)).toHaveLength(5);
  });
});
