import { describe, expect, it } from "vitest";

import { parkingSection } from "@/lib/guard/prompt";
import type { Dataset } from "@/lib/opendata/bydata";
import { germanDate, osmUrl } from "@/lib/opendata/common";
import {
  isParkingQuestion,
  parkingPromptData,
  toParkingData,
  toPlace,
  toPlaces,
} from "@/lib/opendata/parking";

/** Gekürzte Datensätze im Format von opendata.rothenburg-tourismus.de. */
const p4 = {
  id: "p4",
  name: "Parkplatz P4 Rothenburg ob der Tauber",
  types: "Parkplatz",
  short_description: "Liegt direkt vor dem Würzburger Tor.",
  url: "www.rothenburg.de",
  street: "Galgengasse",
  postal_code: "91541",
  city: "Rothenburg ob der Tauber",
  lat: 49.37961149515428,
  lon: 10.184449654531392,
  features: "Parkplatz/Stellplatz; Kinderspielplatz; Toiletten",
  payment: "",
  updated_at: "2026-09-09",
};
const p2 = {
  ...p4,
  id: "p2",
  name: "Parkplatz P2 Rothenburg ob der Tauber",
  types: "Wohnmobilstellplatz; Parkplätze/-einrichtungen",
  payment: "EC-Karte; Bar",
};
const schrannenplatz = { ...p4, id: "s", name: "Schrannenplatz", url: "" };
const ladesaeule = {
  ...p4,
  id: "e1",
  name: "E-Ladesäule Kapellenplatz",
  types: "Service Station; E-Auto Ladestation",
  short_description: "1 Ladesäule mit max. 2 x 22 kW Leistung (2 Ladepunkte)",
  url: "https://example.com/laden",
};

const dataset = (id: string, items: unknown[], modified: string): Dataset => ({
  id,
  items,
  modified,
  pageUrl: `https://rothenburg.bydata.de/datasets/${id}?locale=de`,
  fetchedAt: new Date(),
});

describe("toPlace", () => {
  it("bildet Kurzname, Adresse, Listen und Kartenlink", () => {
    const place = toPlace(p4);
    expect(place).toMatchObject({
      label: "P4",
      address: "Galgengasse, 91541 Rothenburg ob der Tauber",
      camper: false,
      features: ["Parkplatz/Stellplatz", "Kinderspielplatz", "Toiletten"],
      payment: [],
      website: "https://www.rothenburg.de/",
    });
    expect(place?.mapUrl).toBe(osmUrl(p4.lat, p4.lon));
    expect(place?.mapUrl).toContain("mlat=49.37961&mlon=10.18445");
  });

  it("erkennt Wohnmobilstellplätze", () => {
    expect(toPlace(p2)?.camper).toBe(true);
  });

  it("verlinkt keine Webseiten außerhalb der Allowlist", () => {
    expect(toPlace(ladesaeule)?.website).toBeNull();
  });

  it("überspringt Einträge ohne Koordinaten statt zu werfen", () => {
    expect(toPlace({ ...p4, lat: undefined })).toBeNull();
  });
});

describe("toPlaces", () => {
  it("sortiert P1–P5 nach Nummer, danach die übrigen", () => {
    const labels = toPlaces([schrannenplatz, p4, p2]).map((place) => place.label);
    expect(labels).toEqual(["P2", "P4", "Schrannenplatz"]);
  });
});

describe("toParkingData", () => {
  it("nennt beide Quellen mit eigenem Datenstand", () => {
    const data = toParkingData(
      dataset("skg-venus-parkplaetze", [p4], "2026-10-22"),
      dataset("skg-venus-e-ladesaeulen", [ladesaeule], "2026-09-15"),
    );
    expect(data.sources.map((source) => source.modified)).toEqual([
      "2026-10-22",
      "2026-09-15",
    ]);
    expect(data.sources.map((source) => source.url)).toEqual([
      "https://rothenburg.bydata.de/datasets/skg-venus-parkplaetze?locale=de",
      "https://rothenburg.bydata.de/datasets/skg-venus-e-ladesaeulen?locale=de",
    ]);
  });
});

describe("isParkingQuestion", () => {
  it.each([
    "Wo kann ich parken?",
    "Gibt es einen Parkplatz in der Nähe vom Marktplatz?",
    "Darf ich mit dem Wohnmobil über Nacht stehen?",
    "Wo ist eine Ladesäule für mein E-Auto?",
    "Hat P3 Toiletten?",
    "Where can I charge my car?",
    "Waar kan ik parkeren?",
    "駐車場はどこですか？",
  ])("erkennt „%s“", (question) => {
    expect(isParkingQuestion(question)).toBe(true);
  });

  it.each([
    "Wann hat die Tourist-Information geöffnet?",
    "Gibt es einen Laden für Weihnachtsschmuck?",
    "Welche Fraktionen gibt es im Stadtrat?",
  ])("ignoriert „%s“", (question) => {
    expect(isParkingQuestion(question)).toBe(false);
  });
});

describe("germanDate", () => {
  it("formatiert ISO-Datum deutsch", () => {
    expect(germanDate("2026-10-22")).toBe("22.10.2026");
    expect(germanDate(null)).toBeNull();
  });
});

describe("parkingSection", () => {
  const data = toParkingData(
    dataset("skg-venus-parkplaetze", [p4, p2], "2026-10-22"),
    dataset("skg-venus-e-ladesaeulen", [ladesaeule], "2026-10-22"),
  );

  it("packt die Daten in einen fremdquelle-Marker und nennt den Stand je Quelle", () => {
    const section = parkingSection(data, "n1");
    expect(section).toContain(
      '<fremdquelle id="n1" herkunft="Offene Daten / Open Data der Stadt Rothenburg ob der Tauber (bydata)">',
    );
    expect(section).toContain(
      "- E-Ladesäulen (Stand 22.10.2026): https://rothenburg.bydata.de/datasets/skg-venus-e-ladesaeulen?locale=de",
    );
    expect(section).toContain(parkingPromptData(data));
    expect(section).toContain("Karte: https://www.openstreetmap.org/?mlat=");
  });

  it("stellt die Daten nicht als vollständig dar und verweist beim Laden auf Apps", () => {
    const section = parkingSection(data, "n1");
    expect(section).toContain("unvollständig oder veraltet");
    expect(section).toContain("Lade-App");
    expect(section).toContain("Gewähr");
    expect(section).toContain("https://www.rothenburg.de/besuchen/mobilitaet/e-tankstellen");
  });

  it("verweist auch bei Ausfall auf die offizielle Ladesäulen-Übersicht", () => {
    expect(parkingSection(null, "n1")).toContain(
      "https://www.rothenburg.de/besuchen/mobilitaet/e-tankstellen",
    );
  });

  it("verbietet bei Ausfall Angaben aus eigenem Wissen", () => {
    const section = parkingSection(null, "n1");
    expect(section).toContain("gerade nicht");
    expect(section).not.toContain("<fremdquelle");
  });
});
