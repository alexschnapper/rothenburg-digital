import { describe, expect, it } from "vitest";

import { shoppingSection } from "@/lib/guard/prompt";
import type { Dataset } from "@/lib/opendata/bydata";
import {
  isShoppingQuestion,
  selectShops,
  shopPlaces,
  shopPromptData,
  toShopData,
} from "@/lib/opendata/shopping";

/** Gekürzte Einträge im Format von opendata.rothenburg-tourismus.de. */
const base = {
  short_description: "",
  description: "",
  topics: "",
  street: "Herrngasse 1",
  postal_code: "91541",
  city: "Rothenburg ob der Tauber",
  lat: 49.377,
  lon: 10.179,
  opening_hours: "Mo, Di, Mi, Do, Fr, Sa 10:00-18:00",
  contact_phone: "",
  url: "",
};
const weihnacht = { ...base, id: "w1", name: "Kleiner Weihnachtsladen", types: "Geschäft/Einzelhandel; Souvenirladen" };
const kerzen = {
  ...base,
  id: "k1",
  name: "Dini Collection",
  types: "Dekorationsladen",
  topics: "Handmade",
  short_description: "Handgemachte Duftkerzen aus Rapswachs",
  opening_hours: "",
};
const baeckerei = { ...base, id: "b1", name: "Bäckerei Hachtel", types: "Direktvermarkter; Lebensmittelgeschäft" };
const schmuck = { ...base, id: "s1", name: "Jutta Korn Goldschmiede", types: "Schmuckgeschäft" };
const buch = { ...base, id: "d1", name: "Deine Buchhandlung", types: "Buchhandel" };
const kaffee = { ...base, id: "g1", name: "Gusto Kaffeemanufaktur", types: "Café" };
const workshop = { ...base, id: "p1", name: "Corina Strauß DIY-Workshops", types: "Lokales Unternehmen", topics: "Direktvermarkter Popup Rothenburg" };

const dataset = (id: string, items: unknown[], license: string): Dataset => ({
  id,
  items,
  modified: "2026-10-13",
  pageUrl: `https://rothenburg.bydata.de/datasets/${id}?locale=de`,
  license: { label: license, url: null },
  fetchedAt: new Date(),
});

const data = toShopData([
  { dataset: dataset("skg-venus-einkaufsmoeglichkeiten", [weihnacht, kerzen, baeckerei, schmuck, buch, { id: "kaputt" }], "CC BY-SA 4.0"), label: "Einkaufsmöglichkeiten" },
  { dataset: dataset("skg-venus-einzelhandel", [], "CC BY-SA 4.0"), label: "Einzelhandel" },
  { dataset: dataset("skg-venus-handmade", [{ ...kerzen, name: "Dublette" }, kaffee], "CC BY 4.0"), label: "Handmade" },
  { dataset: dataset("skg-venus-direktvermarkter-popup-rothenburg", [workshop], "CC0"), label: "Direktvermarkter Pop-up" },
]);

/** Mi 4.11.2026, 12:00 deutsche Zeit */
const NOON = new Date("2026-11-04T12:00+01:00");

describe("toShopData", () => {
  it("führt Datensätze zusammen, der erste gewinnt bei gleicher ID", () => {
    expect(data.shops.map((shop) => shop.name)).toContain("Dini Collection");
    expect(data.shops.map((shop) => shop.name)).not.toContain("Dublette");
    expect(data.shops.find((shop) => shop.id === "p1")?.source.label).toBe("Direktvermarkter Pop-up");
  });

  it("lässt Gastronomie weg, die steht auf /essen-trinken", () => {
    expect(data.shops.map((shop) => shop.id)).not.toContain("g1");
  });

  it("nennt nur Datensätze, aus denen ein Eintrag stammt", () => {
    expect(data.sources.map((source) => source.label)).toEqual(["Einkaufsmöglichkeiten", "Direktvermarkter Pop-up"]);
  });

  it("ordnet die Geschäfte Gruppen zu", () => {
    const group = (id: string) => data.shops.find((shop) => shop.id === id)?.group;
    expect(group("w1")).toBe("souvenir");
    expect(group("k1")).toBe("handmade");
    expect(group("b1")).toBe("lebensmittel");
    expect(group("s1")).toBe("mode");
    expect(group("d1")).toBe("weitere");
    expect(group("p1")).toBe("handmade");
  });
});

describe("Kartenlinks bei geteilten Koordinaten", () => {
  const shared = { lat: 49.37672, lon: 10.17829 };
  const merged = toShopData([
    {
      dataset: dataset("skg-venus-einkaufsmoeglichkeiten", [
        { ...weihnacht, ...shared, id: "a", street: "Herrngasse 2" },
        { ...weihnacht, ...shared, id: "b", name: "Geschenkehaus am Markt", street: "Marktplatz 7" },
        { ...kerzen, id: "c", lat: 49.377, lon: 10.18134, street: "Rödergasse 2 - 4" },
        { ...kerzen, id: "d", name: "Zaubervoll", lat: 49.377, lon: 10.18134, street: "Rödergasse 2" },
      ], "CC BY-SA 4.0"),
      label: "Einkaufsmöglichkeiten",
    },
  ]);
  const url = (id: string) => merged.shops.find((shop) => shop.id === id)?.mapUrl;

  it("sucht nach der Adresse, wenn verschiedene Straßen auf einem Punkt liegen", () => {
    expect(url("b")).toBe(
      "https://www.openstreetmap.org/search?query=Marktplatz%207%2C%2091541%20Rothenburg%20ob%20der%20Tauber",
    );
    expect(url("a")).toContain("/search?query=Herrngasse%202");
  });

  it("behält den Punkt bei mehreren Läden in derselben Straße", () => {
    expect(url("c")).toBe("https://www.openstreetmap.org/?mlat=49.37700&mlon=10.18134#map=18/49.37700/10.18134");
    expect(url("d")).toBe(url("c"));
  });
});

describe("isShoppingQuestion", () => {
  it.each([
    "Wo kann ich Souvenirs kaufen?",
    "Gibt es einen Weihnachtsladen?",
    "Wo finde ich regionale Produkte?",
    "Where can I buy gifts?",
    "Welche Geschäfte haben am Sonntag offen?",
  ])("erkennt „%s“", (question) => {
    expect(isShoppingQuestion(question)).toBe(true);
  });

  it.each([
    "Wo kann ich mein E-Auto laden?",
    "Gibt es Stadtführungen?",
    "Welches Restaurant hat offen?",
  ])("ignoriert „%s“", (question) => {
    expect(isShoppingQuestion(question)).toBe(false);
  });
});

describe("selectShops", () => {
  it("bevorzugt die gefragte Art", () => {
    expect(selectShops(data, "Wo gibt es Schmuck?", NOON, 1).selected[0].id).toBe("s1");
    expect(selectShops(data, "Ich suche handgemachte Kerzen", NOON, 1).selected[0].id).toBe("k1");
  });

  it("nennt die übrigen nur mit Namen", () => {
    const text = shopPromptData(data, NOON, "Souvenir");
    expect(text).toContain("Passend zur Frage ausgewählt (5 von 6):");
    expect(text).toContain("Ebenfalls eingetragen, ohne Details:");
    expect(text).toContain("Jetzt: jetzt geöffnet bis 18:00 Uhr");
    expect(text).not.toContain("openstreetmap.org");
  });
});

describe("shoppingSection", () => {
  it("packt die Daten in einen fremdquelle-Marker, Quelle hängt der Server an", () => {
    const section = shoppingSection(data, "n1", NOON, "Souvenir");
    expect(section).toContain('<fremdquelle id="n1"');
    expect(section).toContain("**höchstens fünf**");
    expect(section).toContain("fügt der Server");
    expect(section).toContain("(/einkaufen)");
  });

  it("verbietet bei Ausfall Angaben aus eigenem Wissen", () => {
    expect(shoppingSection(null, "n1", NOON)).not.toContain("<fremdquelle");
  });

  it("liefert Kartenlinks mit der Quelle des jeweiligen Datensatzes", () => {
    const places = shopPlaces(data);
    expect(places.find((place) => place.label === "Corina Strauß DIY-Workshops")?.source.license?.label).toBe("CC0");
  });
});
