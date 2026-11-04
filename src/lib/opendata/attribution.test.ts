import { describe, expect, it } from "vitest";

import {
  attributionMarkdown,
  mentionedPlaces,
  type PlaceRef,
} from "@/lib/opendata/attribution";
import type { SourceInfo } from "@/lib/opendata/common";

const restaurants: SourceInfo = {
  label: "Restaurants, Cafés und Gastronomie",
  url: "https://rothenburg.bydata.de/datasets/skg-venus-restaurants?locale=de",
  modified: "2026-10-22T08:00:00Z",
  license: { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
};
const sights: SourceInfo = {
  label: "Sehenswürdigkeiten",
  url: "https://rothenburg.bydata.de/datasets/skg-venus-sehenswuerdigkeiten?locale=de",
  modified: "2026-10-16",
  license: null,
};
const heat: SourceInfo = { ...sights, label: "Hitzeorte", url: "https://example.org/hitze" };
const defis: SourceInfo = { ...sights, label: "Defibrillatoren", url: "https://example.org/defi" };
const parking: SourceInfo = { ...sights, label: "Parkplätze", url: "https://example.org/parken" };

const map = (n: number) => `https://www.openstreetmap.org/?mlat=49.3${n}&mlon=10.1${n}`;

const places: PlaceRef[] = [
  { label: "Defibrillator Rathaus", mapUrl: map(1), source: defis },
  { label: "Defibrillator Burggarten (Toilettenanlage Burgtor)", mapUrl: map(2), source: defis },
  { label: "Trinkbrunnen Marktplatz", mapUrl: map(3), source: heat },
  { label: "P4", aliases: ["Parkplatz P4 Rothenburg ob der Tauber"], mapUrl: map(4), source: parking },
  { label: "P5", aliases: ["Parkplatz P5 Bezoldweg"], mapUrl: map(5), source: parking },
  { label: "Konditorei - Café Prezel", mapUrl: map(6), source: restaurants },
  { label: "Ratsstube Rothenburg", mapUrl: map(7), source: restaurants },
  { label: "Brot & Zeit Rothenburg o.d.T.", mapUrl: map(8), source: restaurants },
  { label: "Marktplatz", mapUrl: map(9), source: sights },
  { label: "Rathaus", mapUrl: map(10), source: sights },
];

const labels = (answer: string) => mentionedPlaces(answer, places).map((place) => place.label);

describe("mentionedPlaces", () => {
  it("findet Orte auch ohne Gattungswort und Ortsnamen", () => {
    expect(labels("Probieren Sie das **Café Prezel** oder die Ratsstube.")).toEqual([
      "Konditorei - Café Prezel",
      "Ratsstube Rothenburg",
    ]);
    expect(labels("Frühstück gibt es bei Brot & Zeit.")).toEqual(["Brot & Zeit Rothenburg o.d.T."]);
    // Gedankenstrich im Text, Bindestrich in den Daten
    expect(labels("Probieren Sie das Konditorei – Café Prezel.")).toEqual(["Konditorei - Café Prezel"]);
  });

  it("erkennt Kurznamen wie P4, aber nicht als Teil anderer Wörter", () => {
    expect(labels("Parken Sie auf P4 oder auf dem Parkplatz P5 am Bezoldweg.")).toEqual(["P4", "P5"]);
    expect(labels("Der Code P45 ist kein Parkplatz.")).toEqual([]);
  });

  it("erlaubt Füllwörter zwischen den Namensteilen", () => {
    expect(labels("Wasser gibt es am Trinkbrunnen am Marktplatz.")).toEqual(["Trinkbrunnen Marktplatz"]);
  });

  it("ordnet eine Textstelle nur dem längsten passenden Namen zu", () => {
    // „Marktplatz" steckt im Trinkbrunnen, „Rathaus" im Defibrillator.
    expect(labels("Ein Defibrillator im Rathaus, Wasser am Trinkbrunnen Marktplatz.")).toEqual([
      "Defibrillator Rathaus",
      "Trinkbrunnen Marktplatz",
    ]);
    expect(labels("Vom Marktplatz sehen Sie das Rathaus.")).toEqual(["Marktplatz", "Rathaus"]);
  });

  it("findet Namen mit Klammerzusatz auch ohne den Zusatz", () => {
    expect(labels("Ein Gerät hängt im Burggarten.")).toEqual([
      "Defibrillator Burggarten (Toilettenanlage Burgtor)",
    ]);
  });

  it("sortiert nach erster Nennung und zählt jeden Ort einmal", () => {
    expect(labels("Ratsstube, dann P4, dann noch einmal die Ratsstube.")).toEqual([
      "Ratsstube Rothenburg",
      "P4",
    ]);
  });

  it("nennt auch Orte, die sich in den Daten einen Kartenpunkt teilen", () => {
    const shared: PlaceRef[] = [
      { label: "Christkindlmarkt", mapUrl: map(1), source: restaurants },
      { label: "Geschenkehaus am Markt", mapUrl: map(1), source: restaurants },
    ];
    expect(
      mentionedPlaces("Christkindlmarkt und Geschenkehaus am Markt", shared).map((place) => place.label),
    ).toEqual(["Christkindlmarkt", "Geschenkehaus am Markt"]);
  });
});

describe("attributionMarkdown", () => {
  it("hängt die exakten Kartenlinks und die Quelle im festen Wortlaut an", () => {
    const appendix = attributionMarkdown("Die Ratsstube und das Café Prezel am Markt.", places);
    expect(appendix).toBe(
      [
        `**Auf der Karte:** [Ratsstube Rothenburg](${map(7)}) · [Konditorei - Café Prezel](${map(6)})`,
        "Quelle: Offene Daten / Open Data der Stadt Rothenburg ob der Tauber – " +
          `[Restaurants, Cafés und Gastronomie](${restaurants.url}), Stand 22.10.2026, ` +
          "Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)",
      ].join("\n\n"),
    );
  });

  it("nennt jeden verwendeten Datensatz einmal", () => {
    const appendix = attributionMarkdown("P4, P5 und der Marktplatz.", places);
    expect(appendix).toContain(`[Parkplätze](${parking.url}), Stand 16.10.2026; [Sehenswürdigkeiten](${sights.url})`);
  });

  it("bleibt leer, wenn die Antwort keinen Ort aus den Daten nennt", () => {
    expect(attributionMarkdown("Dazu habe ich leider keine Angaben.", places)).toBe("");
  });
});
