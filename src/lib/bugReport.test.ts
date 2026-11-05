import { describe, expect, it } from "vitest";

import { bugReportUrl } from "@/lib/bugReport";

describe("bugReportUrl", () => {
  const url = new URL(
    bugReportUrl({
      code: 500,
      path: "/parken?suche=meine-adresse#x",
      reference: "1940433151",
      message: "Es ist ein Fehler aufgetreten.",
      now: new Date("2026-11-04T14:00:00+01:00"),
    }),
  );
  const param = (name: string) => url.searchParams.get(name);

  it("füllt das Formular fehlermeldung.yml vor", () => {
    expect(url.origin + url.pathname).toBe(
      "https://github.com/alexschnapper/rothenburg-digital/issues/new",
    );
    expect(param("template")).toBe("fehlermeldung.yml");
    expect(param("fehlercode")).toBe("500");
    expect(param("kennung")).toBe("1940433151");
    expect(param("zeitpunkt")).toBe("4.11.2026, 14:00:00");
    expect(param("beschreibung")).toContain("Es ist ein Fehler aufgetreten.");
  });

  it("schickt den Pfad ohne Query-String und Anker mit", () => {
    expect(param("seite")).toBe("/parken");
    expect(url.toString()).not.toContain("meine-adresse");
  });
});
