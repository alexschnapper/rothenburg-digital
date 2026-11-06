import { describe, expect, it } from "vitest";

import { DATA_REPORTS_URL, dataReportUrl, ideaUrl } from "@/lib/dataReport";

describe("Datenfehler melden (#10)", () => {
  const url = new URL(dataReportUrl({ dataset: "Restaurants", path: "/essen-trinken?q=pizza#karte" }));
  const param = (name: string) => url.searchParams.get(name);

  it("füllt das Formular datenfehler.yml vor", () => {
    expect(url.origin + url.pathname).toBe("https://github.com/alexschnapper/rothenburg-digital/issues/new");
    expect(param("template")).toBe("datenfehler.yml");
    expect(param("datensatz")).toBe("Restaurants");
    expect(param("title")).toBe("Datenfehler in „Restaurants“: ");
  });

  it("schickt den Pfad ohne Query-String und Anker mit", () => {
    expect(param("seite")).toBe("/essen-trinken");
    expect(url.toString()).not.toContain("pizza");
  });

  it("geht auch ohne Datensatz", () => {
    const plain = new URL(dataReportUrl());
    expect(plain.searchParams.get("title")).toBe("Datenfehler: ");
    expect(plain.searchParams.has("datensatz")).toBe(false);
  });

  it("Idee und Liste der Meldungen", () => {
    expect(new URL(ideaUrl()).searchParams.get("template")).toBe("idee.yml");
    expect(decodeURIComponent(DATA_REPORTS_URL)).toContain("label:datenmeldung");
  });
});
