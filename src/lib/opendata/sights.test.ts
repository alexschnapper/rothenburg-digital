import { describe, expect, it } from "vitest";

import { sightSection } from "@/lib/guard/prompt";
import type { Dataset } from "@/lib/opendata/bydata";
import {
  isSightQuestion,
  selectSights,
  sightPromptData,
  toSight,
  toSightData,
} from "@/lib/opendata/sights";

/** Gekürzte Einträge im Format von opendata.rothenburg-tourismus.de. */
const base = {
  types: "Sehenswürdigkeit/Historisches Gebäude",
  topics: "Highlight; Mittelalter",
  description: "",
  street: "",
  postal_code: "91541",
  city: "Rothenburg ob der Tauber",
  lat: 49.377,
  lon: 10.179,
  opening_hours: "",
  price_info: "",
  license: "CC0 1.0",
  license_holder: "Stadt Rothenburg ob der Tauber",
};
const items = [
  { ...base, id: "rt", name: "Rathausturm Rothenburg ob der Tauber", short_description: "Vom Rathausturm hat man einen weiten Blick über die Altstadt.", opening_hours: "April bis Oktober\ntäglich 9:30 bis 17:00 Uhr", price_info: "Erwachsene: 4 €" },
  { ...base, id: "km", name: "Mittelalterliches Kriminalmuseum", types: "Museum; Sehenswürdigkeit/Historisches Gebäude", topics: "Top 10 Rothenburg; Schlechtwettertipp", short_description: "Deutschlands bedeutendstes Rechtskundemuseum.", opening_hours: "Mittelalterliches Kriminalmuseum in Rothenburg o. b. Tauber" },
  { ...base, id: "pt", name: "Pulverturm", short_description: "Der Pulverturm wurde um 1408 erbaut.", license: "CC BY 4.0", license_holder: "Max Muster" },
  { ...base, id: "kt", name: "Klingentor", topics: "Mittelalter", short_description: "Eines der Stadttore der Stadtbefestigung." },
  { ...base, id: "ae", name: "Aussichtspunkt An der Eich", topics: "", short_description: "Blick auf die Stadtsilhouette." },
  { ...base, id: "gs", name: "Gedenkstele Zur bitteren Klage im Burggarten von Rothenburg ob der Tauber", topics: "Jüdisches Rothenburg", short_description: "Gedenkstele." },
  { ...base, id: "jr", name: "Jüdisches Rothenburg _ Glasfenster Ostchor St. Jakob", topics: "Jüdisches Rothenburg", short_description: "Glasfenster." },
  { id: "kaputt" },
];
const dataset: Dataset = {
  id: "skg-venus-sehenswuerdigkeiten",
  items,
  modified: "2026-10-16",
  pageUrl: "https://rothenburg.bydata.de/datasets/skg-venus-sehenswuerdigkeiten?locale=de",
  fetchedAt: new Date(),
};
const data = toSightData(dataset);
const byId = (id: string) => data.sights.find((sight) => sight.id === id)!;

describe("toSight", () => {
  it("kürzt Namen, aber nicht nach „von“ und nicht vor einem Gedankenstrich", () => {
    expect(byId("rt").name).toBe("Rathausturm");
    expect(byId("gs").name).toBe("Gedenkstele Zur bitteren Klage im Burggarten von Rothenburg ob der Tauber");
    expect(byId("jr").name).toBe("Jüdisches Rothenburg – Glasfenster Ostchor St. Jakob");
  });

  it("teilt in Gruppen ein", () => {
    expect(byId("kt").group).toBe("befestigung");
    expect(byId("pt").group).toBe("befestigung");
    expect(byId("rt").group).toBe("gebaeude");
    expect(byId("km").group).toBe("gebaeude");
    expect(byId("ae").group).toBe("aussicht");
    expect(byId("gs").group).toBe("juedisch");
  });

  it("übernimmt Öffnungszeiten und Preis, verwirft ein Feld, das nur den Namen wiederholt", () => {
    expect(byId("rt")).toMatchObject({ openingHours: expect.stringContaining("April bis Oktober"), price: "Erwachsene: 4 €" });
    expect(byId("km").openingHours).toBeNull();
  });

  it("nennt eine abweichende Lizenz, bei CC0 keine", () => {
    expect(byId("pt").attribution).toBe("CC BY 4.0, Max Muster");
    expect(byId("kt").attribution).toBeNull();
  });

  it("überspringt kaputte Einträge", () => {
    expect(toSight({ id: "kaputt" })).toBeNull();
    expect(data.sights).toHaveLength(7);
  });
});

describe("isSightQuestion", () => {
  it.each([
    "Was kann man in Rothenburg unternehmen?",
    "Welche Sehenswürdigkeiten gibt es?",
    "Gibt es ein Museum?",
    "Wo hat man die beste Aussicht?",
    "Was mache ich bei Regen?",
    "What are the main sights?",
    "Was muss man unbedingt gesehen haben?",
    "Wie komme ich zum Plönlein?",
  ])("erkennt „%s“", (question) => expect(isSightQuestion(question)).toBe(true));

  it.each(["Wo kann ich parken?", "Welches Café hat offen?"])("ignoriert „%s“", (question) =>
    expect(isSightQuestion(question)).toBe(false),
  );
});

describe("selectSights", () => {
  const first = (question: string) => selectSights(data, question, 1).selected[0].id;

  it("findet Orte über Namen, Art, Thema und Beschreibung", () => {
    expect(first("Wann hat der Rathausturm offen?")).toBe("rt");
    expect(first("Gibt es ein Museum?")).toBe("km");
    expect(first("Was kann man bei Regen machen?")).toBe("km");
    expect(first("Wo ist ein schöner Aussichtspunkt?")).toBe("ae");
    expect(first("Spuren jüdischen Lebens?")).toMatch(/gs|jr/);
  });

  it("nennt die übrigen nur mit Namen", () => {
    const text = sightPromptData(data, "Gibt es ein Museum?");
    expect(text).toContain("Passend zur Frage ausgewählt (5 von 7):");
    expect(text).toContain("Ebenfalls eingetragen, ohne Details:");
    expect(text.match(/Karte: /g)).toHaveLength(5);
  });
});

describe("sightSection", () => {
  it("regelt fehlende bekannte Orte und verlinkt die Seite", () => {
    const section = sightSection(data, "n1", "Gibt es ein Museum?");
    expect(section).toContain('<fremdquelle id="n1"');
    expect(section).toContain("Plönlein");
    expect(section).toContain("**ohne** Öffnungszeiten");
    expect(section).toContain("(/sehenswuerdigkeiten)");
    expect(section).toContain("Stand 16.10.2026");
  });

  it("verbietet bei Ausfall Angaben aus eigenem Wissen", () => {
    expect(sightSection(null, "n1")).not.toContain("<fremdquelle");
  });
});
