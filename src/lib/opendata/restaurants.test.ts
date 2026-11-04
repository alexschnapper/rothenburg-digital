import { describe, expect, it } from "vitest";

import { restaurantSection } from "@/lib/guard/prompt";
import type { Dataset } from "@/lib/opendata/bydata";
import {
  isFoodQuestion,
  restaurantPromptData,
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
      '<fremdquelle id="n1" herkunft="Offene Daten der Stadt Rothenburg ob der Tauber (bydata)">',
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
