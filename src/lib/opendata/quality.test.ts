import { describe, expect, it } from "vitest";

import { INVENTORY } from "@/lib/opendata/inventory";
import { CHARGING_DATASET, PARKING_DATASET } from "@/lib/opendata/parking";
import {
  appendHistory,
  checkDataset,
  cleanExample,
  datasetReport,
  diffReports,
  historyEntry,
  reportMarkdown,
  sameContent,
  toDatasetMetas,
  trafficLight,
  type DatasetMeta,
  type QualityReport,
  type RuleId,
  usageText,
} from "@/lib/opendata/quality";

/** Do 5.11.2026 */
const NOW = new Date("2026-11-05T08:00:00Z");

const meta: DatasetMeta = {
  id: "skg-venus-test",
  title: "Test",
  description: "Testdaten",
  modified: "2026-11-01",
  periodicity: "weekly",
  hasContact: true,
  licenses: ["CC BY 4.0", "CC BY 4.0"],
  jsonUrl: "https://opendata.example.de/test.json",
};

const good = {
  id: "a1",
  name: "Rathaus",
  lat: 49.377,
  lon: 10.179,
  geometry_type: "Point",
  street: "Marktplatz 1",
  postal_code: "91541",
  city: "Rothenburg ob der Tauber",
  url: "https://www.rothenburg.de/",
  opening_hours: "Mo, Di 10:00-18:00",
  short_description: "Rathaus am Marktplatz",
  license: "CC BY 4.0",
};

const rules = (findings: { rule: RuleId }[]) => findings.map((finding) => finding.rule);

describe("checkDataset", () => {
  it("findet bei sauberen Daten nichts", () => {
    expect(checkDataset(meta, [good], NOW)).toEqual([]);
  });

  it("meldet nicht abrufbare und leere Datensätze als Fehler", () => {
    expect(rules(checkDataset(meta, null, NOW))).toEqual(["nicht-abrufbar"]);
    expect(rules(checkDataset(meta, [], NOW))).toEqual(["leer"]);
  });

  it("meldet einen Stand, der nicht zur angegebenen Häufigkeit passt", () => {
    const stale = checkDataset({ ...meta, modified: "2026-09-15" }, [good], NOW);
    expect(stale).toMatchObject([{ rule: "veraltet", severity: "warnung" }]);
    expect(stale[0].message).toContain("15.09.2026");
    // Ohne Frequenz gibt es keinen Maßstab.
    expect(checkDataset({ ...meta, modified: "2026-01-01", periodicity: null }, [good], NOW)).toEqual([]);
  });

  it("prüft Lizenzen von Datensatz, Dateiformaten und Einträgen", () => {
    expect(rules(checkDataset({ ...meta, licenses: [] }, [good], NOW))).toContain("lizenz-fehlt");
    expect(rules(checkDataset({ ...meta, licenses: ["CC BY 4.0", "CC0"] }, [good], NOW))).toEqual([
      "lizenz-verteilungen",
    ]);
    const items = [good, { ...good, id: "a2", name: "Turm", license: "CC0 1.0" }, { ...good, id: "a3", name: "Tor", license: "" }];
    const findings = checkDataset(meta, items, NOW);
    expect(findings.find((finding) => finding.rule === "lizenz-eintrag")).toMatchObject({ count: 1, examples: ["Turm"] });
    expect(findings.find((finding) => finding.rule === "lizenz-eintrag-fehlt")).toMatchObject({ count: 1 });
  });

  it("behandelt „CC0 1.0“ und „CC0“ als dieselbe Lizenz", () => {
    expect(checkDataset({ ...meta, licenses: ["CC0"] }, [{ ...good, license: "CC0 1.0" }], NOW)).toEqual([]);
  });

  it("meldet Koordinaten außerhalb von Rothenburg und fehlende Koordinaten", () => {
    const items = [{ ...good, lat: 10.179, lon: 49.377 }, { ...good, id: "x", name: "Ohne", lat: "" }];
    expect(checkDataset(meta, items, NOW)).toMatchObject([{ rule: "koordinaten", severity: "fehler", count: 2 }]);
  });

  it("prüft Postleitzahl und Adresse", () => {
    const findings = checkDataset(meta, [{ ...good, postal_code: "9151" }, { ...good, id: "b", name: "Klingentor", street: "" }], NOW);
    expect(findings).toMatchObject([
      { rule: "adresse", severity: "hinweis", examples: ["Klingentor"] },
      { rule: "postleitzahl", severity: "fehler", examples: ["Rathaus"] },
    ]);
  });

  it("erkennt Dubletten, aber nicht die Tage einer Terminreihe", () => {
    const market = { ...good, id: "m", name: "Reiterlesmarkt", start_date: "2026-11-20", end_date: "2026-11-20" };
    const series = [market, { ...market, start_date: "2026-11-21", end_date: "2026-11-21" }];
    expect(rules(checkDataset(meta, series, NOW))).not.toContain("dublette");
    expect(checkDataset(meta, [...series, market], NOW)).toMatchObject([{ rule: "dublette", count: 2 }]);
    expect(checkDataset(meta, [good, { ...good, id: "z" }], NOW)).toMatchObject([{ rule: "dublette", count: 2 }]);
  });

  it("meldet unlesbare Öffnungszeiten und Webadressen ohne https", () => {
    const findings = checkDataset(
      meta,
      [{ ...good, opening_hours: "Mittelalterliches Kriminalmuseum in Rothenburg" }, { ...good, id: "c", name: "Park", url: "www.rothenburg.de" }],
      NOW,
    );
    expect(rules(findings)).toEqual(["oeffnungszeiten", "webadresse"]);
  });

  it("prüft Termine auf fehlendes und vergangenes Datum", () => {
    const items = [
      { ...good, id: "e1", name: "Theater", start_date: "", end_date: "" },
      { ...good, id: "e2", name: "Herbstmesse", start_date: "2026-10-01", end_date: "2026-10-03" },
      { ...good, id: "e3", name: "Reiterlesmarkt", start_date: "2026-11-20", end_date: "" },
    ];
    expect(checkDataset(meta, items, NOW)).toMatchObject([
      { rule: "termin-ohne-datum", examples: ["Theater"] },
      { rule: "termin-abgelaufen", examples: ["Herbstmesse"] },
    ]);
  });

  it("vergleicht mit der Referenzliste", () => {
    const charging = { ...meta, id: CHARGING_DATASET, licenses: ["CC0"] };
    const kapellenplatz = { ...good, name: "E-Ladesäule Kapellenplatz", license: "CC0 1.0" };
    const findings = checkDataset(charging, [kapellenplatz, { ...kapellenplatz, id: "p1", name: "E-Ladesäule P1" }], NOW);
    expect(findings).toMatchObject([{ rule: "referenz", count: 3 }]);
    expect(findings[0].message).toContain("P4, P5, Bahnhof");
    expect(findings[0].message).not.toContain("P1");
  });
});

describe("Einträge auf demselben Punkt (#66)", () => {
  it("meldet verschiedene Straßen auf exakt demselben Punkt", () => {
    const point = { lat: 49.37672, lon: 10.17829 };
    const items = [
      { ...good, ...point, id: "s1", name: "Spielzeugladen", street: "Obere Schmiedgasse 29" },
      { ...good, ...point, id: "s2", name: "Christkindlmarkt", street: "Herrngasse 2" },
      { ...good, ...point, id: "s3", name: "Weihnachtsdorf", street: "Herrngasse 1" },
    ];
    expect(checkDataset(meta, items, NOW)).toMatchObject([{ rule: "gleicher-punkt", severity: "warnung", count: 3 }]);
  });

  it("lässt mehrere Läden an derselben Straße in Ruhe", () => {
    const items = [
      { ...good, id: "r1", name: "Laden A", street: "Rödergasse 2" },
      { ...good, id: "r2", name: "Laden B", street: "Rödergasse 4" },
    ];
    expect(checkDataset(meta, items, NOW)).toEqual([]);
  });
});

describe("Bestandsaufnahme (#66)", () => {
  it("meldet Datensätze, die noch nicht bewertet sind", () => {
    const unknown = datasetReport(meta, [good], NOW);
    expect(unknown.usage).toBeNull();
    expect(unknown.findings).toMatchObject([{ rule: "nicht-bewertet", severity: "hinweis" }]);
    expect(unknown.status).toBe("gruen");

    const parking = datasetReport({ ...meta, id: PARKING_DATASET }, [good], NOW);
    expect(parking.findings).toEqual([]);
    expect(parking.usage?.status).toBe("genutzt");
  });

  it("begründet jeden nicht oder nur teilweise genutzten Datensatz", () => {
    expect(Object.keys(INVENTORY)).toHaveLength(18);
    for (const usage of Object.values(INVENTORY)) {
      if (usage.status !== "genutzt") expect(usage.note).not.toBe("");
    }
  });

  it("fasst die Nutzung in einer Zeile zusammen", () => {
    expect(usageText(INVENTORY[PARKING_DATASET])).toBe("Genutzt: Parken & E-Laden, Chat");
    expect(usageText(INVENTORY["skg-venus-stadtfuehrungen"])).toBe("Nicht genutzt");
    expect(usageText(null)).toBe("Noch nicht bewertet");
  });
});

describe("cleanExample", () => {
  it("entfernt Markdown und Erwähnungen aus fremden Namen", () => {
    expect(cleanExample("[Klick](https://evil.example) @octocat **fett**")).toBe("Klickhttps://evil.example octocat fett");
    expect(cleanExample("   ")).toBe("(ohne Name)");
  });
});

describe("trafficLight", () => {
  it("richtet sich nach dem schwersten Befund", () => {
    const finding = { rule: "leer" as const, message: "", count: 0, examples: [] };
    expect(trafficLight([])).toBe("gruen");
    expect(trafficLight([{ ...finding, severity: "hinweis" }])).toBe("gruen");
    expect(trafficLight([{ ...finding, severity: "warnung" }])).toBe("gelb");
    expect(trafficLight([{ ...finding, severity: "hinweis" }, { ...finding, severity: "fehler" }])).toBe("rot");
  });
});

describe("toDatasetMetas", () => {
  it("liest Titel, Frequenz, Lizenzen und die JSON-Adresse aus der Such-API", () => {
    const raw = {
      result: {
        count: 1,
        results: [
          {
            id: "skg-venus-e-ladesaeulen",
            title: { de: "E-Ladesäulen" },
            description: { de: "Ladesäulen" },
            modified: "2026-09-15",
            accrual_periodicity: { label: "weekly" },
            contact_point: [{ name: "Tourist-Information" }],
            distributions: [
              {
                format: { id: "CSV" },
                download_url: ["https://opendata.example.de/e.csv"],
                license: { label: "Creative Commons CC Zero License (cc-zero)" },
              },
              {
                format: { id: "JSON" },
                download_url: ["http://opendata.example.de/e.json"],
                access_url: ["https://opendata.example.de/e.json"],
                license: { label: "Creative Commons Namensnennung – 4.0 International (CC BY 4.0)" },
              },
            ],
          },
        ],
      },
    };
    expect(toDatasetMetas(raw)).toEqual([
      {
        id: "skg-venus-e-ladesaeulen",
        title: "E-Ladesäulen",
        description: "Ladesäulen",
        modified: "2026-09-15",
        periodicity: "weekly",
        hasContact: true,
        licenses: ["CC0", "CC BY 4.0"],
        jsonUrl: "https://opendata.example.de/e.json",
      },
    ]);
  });
});

describe("Vergleich und Bericht", () => {
  const report = (findings: unknown[][]): QualityReport => ({
    generatedAt: NOW.toISOString(),
    catalog: "rothenburg-import",
    datasets: findings.map((items, index) => datasetReport({ ...meta, id: `d${index}`, title: `D${index}` }, items, NOW)),
  });

  it("findet neue und behobene Befunde", () => {
    const before = report([[good], []]);
    const after = report([[{ ...good, postal_code: "9151" }], [good]]);
    const diff = diffReports(before, after);
    expect(diff.added.map((change) => `${change.dataset}:${change.finding.rule}`)).toEqual(["d0:postleitzahl"]);
    expect(diff.resolved.map((change) => `${change.dataset}:${change.finding.rule}`)).toEqual(["d1:leer"]);
  });

  it("ignoriert den Zeitpunkt des Laufs", () => {
    const a = report([[good]]);
    expect(sameContent(a, { ...a, generatedAt: "2027-01-01T00:00:00Z" })).toBe(true);
    expect(sameContent(null, a)).toBe(false);
    expect(sameContent(a, report([[]]))).toBe(false);
  });

  it("schreibt eine lesbare Fassung mit Übersicht und Befunden", () => {
    const current = report([[good], []]);
    const markdown = reportMarkdown(current, diffReports(null, current), true);
    expect(markdown).toContain("Erster Bericht, noch kein Vergleich.");
    expect(markdown).toContain("| [D0](https://rothenburg.bydata.de/datasets/d0?locale=de) | 01.11.2026 | 1 | CC BY 4.0 | 🟢 in Ordnung |");
    expect(markdown).toContain("### D1\n\n- **Fehler:** Der Datensatz enthält keine Einträge.");
  });
});

describe("Verlauf", () => {
  const report = (date: string, items: unknown[][]): QualityReport => ({
    generatedAt: `${date}T05:00:00Z`,
    catalog: "rothenburg-import",
    datasets: items.map((rows, index) => datasetReport({ ...meta, id: `d${index}` }, rows, NOW)),
  });

  it("fasst einen Bericht in Zahlen zusammen", () => {
    expect(historyEntry(report("2026-11-05", [[good], [], [{ ...good, url: "www.x.de" }]]))).toEqual({
      date: "2026-11-05",
      status: { rot: 1, gelb: 0, gruen: 2 },
      // Je ein Hinweis „noch nicht bewertet“: d0–d2 stehen nicht in der Bestandsliste.
      findings: { fehler: 1, warnung: 0, hinweis: 4 },
      datasets: { d0: "gruen", d1: "rot", d2: "gruen" },
    });
  });

  it("hängt an, sortiert nach Datum und ersetzt einen Lauf vom selben Tag", () => {
    const first = historyEntry(report("2026-11-09", [[good]]));
    const earlier = historyEntry(report("2026-11-02", [[]]));
    const rerun = historyEntry(report("2026-11-09", [[]]));
    expect(appendHistory([first], earlier).map((row) => row.date)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(appendHistory([earlier, first], rerun)).toEqual([earlier, rerun]);
  });
});
