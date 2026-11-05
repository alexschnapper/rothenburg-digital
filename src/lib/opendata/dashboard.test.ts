import { describe, expect, it } from "vitest";

import {
  axisMax,
  csvCell,
  filterDatasets,
  filterQuery,
  findingsCsv,
  matrixColumns,
  parseFilter,
  xPositions,
  type ChartBox,
} from "@/lib/opendata/dashboard";
import type { DatasetReport, Finding, QualityReport } from "@/lib/opendata/quality";

const finding = (rule: Finding["rule"], severity: Finding["severity"], count = 0): Finding => ({
  rule,
  severity,
  message: `Befund ${rule}`,
  count,
  examples: count > 0 ? ["Rathaus"] : [],
});

const dataset = (id: string, status: DatasetReport["status"], findings: Finding[]): DatasetReport => ({
  id,
  title: id.toUpperCase(),
  pageUrl: `https://rothenburg.bydata.de/datasets/${id}`,
  modified: "2026-09-11",
  periodicity: "weekly",
  license: "CC0",
  items: 4,
  status,
  findings,
  usage: null,
});

const report: QualityReport = {
  generatedAt: "2026-11-05T10:49:56.057Z",
  catalog: "rothenburg-import",
  datasets: [
    dataset("b", "gelb", [finding("veraltet", "warnung"), finding("beschreibung", "hinweis", 4)]),
    dataset("a", "gruen", [finding("beschreibung", "hinweis", 2)]),
    dataset("c", "rot", [finding("leer", "fehler"), finding("veraltet", "warnung")]),
  ],
};

describe("parseFilter", () => {
  it("übernimmt gültige Werte und verwirft unbekannte", () => {
    expect(parseFilter({ schwere: "warnung", regel: "veraltet", datensatz: "a" }, report)).toEqual({
      schwere: "warnung",
      regel: "veraltet",
      datensatz: "a",
    });
    expect(parseFilter({ schwere: "kritisch", regel: "gibt-es-nicht", datensatz: "z" }, report)).toEqual({});
  });

  it("nimmt bei mehrfachen Parametern den ersten", () => {
    expect(parseFilter({ regel: ["leer", "veraltet"] }, report)).toEqual({ regel: "leer" });
  });

  it("baut daraus wieder eine Adresse in fester Reihenfolge", () => {
    expect(filterQuery({ datensatz: "a", regel: "veraltet" })).toBe("?regel=veraltet&datensatz=a");
    expect(filterQuery({})).toBe("");
  });
});

describe("filterDatasets", () => {
  it("sortiert nach Ampel, rot zuerst", () => {
    expect(filterDatasets(report, {}).map((d) => d.id)).toEqual(["c", "b", "a"]);
  });

  it("lässt bei Regel-Filter nur Datensätze mit passendem Befund", () => {
    const result = filterDatasets(report, { regel: "veraltet" });
    expect(result.map((d) => d.id)).toEqual(["c", "b"]);
    expect(result.every((d) => d.findings.every((f) => f.rule === "veraltet"))).toBe(true);
  });

  it("zeigt einen gewählten Datensatz auch ohne Befunde", () => {
    const result = filterDatasets(
      { ...report, datasets: [dataset("leer-ok", "gruen", [])] },
      { datensatz: "leer-ok" },
    );
    expect(result).toHaveLength(1);
  });
});

describe("matrixColumns", () => {
  it("nur Regeln mit Befund, schwere und häufige zuerst", () => {
    expect(matrixColumns(filterDatasets(report, {}))).toEqual([
      { rule: "leer", severity: "fehler", datasets: 1 },
      { rule: "veraltet", severity: "warnung", datasets: 2 },
      { rule: "beschreibung", severity: "hinweis", datasets: 2 },
    ]);
  });
});

describe("CSV", () => {
  it("entschärft Formeln und setzt Anführungszeichen nur bei Bedarf", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("Café; Bar")).toBe('"Café; Bar"');
    expect(csvCell("Rathaus")).toBe("Rathaus");
    expect(csvCell(null)).toBe("");
  });

  it("eine Zeile je Befund, mit BOM und Kopfzeile", () => {
    const csv = findingsCsv(report, filterDatasets(report, {}));
    expect(csv.startsWith("﻿Datensatz-ID;Datensatz;Ampel;")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(1 + 5);
    expect(lines[1]).toBe(
      "c;C;rot;leer;Leer;Fehler;;Befund leer;;11.09.2026;05.11.2026;https://rothenburg.bydata.de/datasets/c",
    );
    expect(csv).toContain(";beschreibung;Beschreibung Einträge;Hinweis;4;Befund beschreibung;Rathaus;");
  });
});

describe("Verlauf", () => {
  const box: ChartBox = { width: 200, height: 100, padLeft: 20, padRight: 20, padTop: 10, padBottom: 10 };
  it("rundet die Achse auf glatte Werte", () => {
    expect(axisMax([2])).toBe(5);
    expect(axisMax([7])).toBe(10);
    expect(axisMax([29])).toBe(30);
    expect(axisMax([51])).toBe(100);
  });

  it("stellt einen einzelnen Lauf mittig, mehrere über die Breite", () => {
    expect(xPositions(1, box)).toEqual([100]);
    expect(xPositions(3, box)).toEqual([20, 100, 180]);
  });
});
