import { describe, expect, it } from "vitest";

import {
  formatOpeningHours,
  openStatus,
  parseOpeningHours,
  statusText,
} from "@/lib/opendata/openingHours";

/** November 2026: deutsche Zeit = UTC+1. */
const berlin = (iso: string) => new Date(`${iso}+01:00`);

describe("parseOpeningHours", () => {
  it("liest Tage und Zeiten eines Blocks", () => {
    expect(parseOpeningHours("Do, Fr 09:00-17:30")).toEqual([
      { day: 3, from: 540, to: 1050 },
      { day: 4, from: 540, to: 1050 },
    ]);
  });

  it("liest mehrere Blöcke, „ab“ ohne Schlusszeit und Bereiche", () => {
    expect(parseOpeningHours("Sa ab 11:30; Mo-Mi 17:00-21:00")).toEqual([
      { day: 0, from: 1020, to: 1260 },
      { day: 1, from: 1020, to: 1260 },
      { day: 2, from: 1020, to: 1260 },
      { day: 5, from: 690, to: null },
    ]);
  });

  it("gibt bei unbekanntem Format oder leerem Text null zurück", () => {
    expect(parseOpeningHours("")).toBeNull();
    expect(parseOpeningHours("nach Vereinbarung")).toBeNull();
    expect(parseOpeningHours("Mo 09:00-17:00; Sommer täglich")).toBeNull();
    expect(parseOpeningHours("Mo 25:00-26:00")).toBeNull();
  });
});

describe("openStatus", () => {
  // Fr 16:00–01:00, Sa 12:00–01:00, So 12:00–21:30
  const pub = parseOpeningHours(
    "So 12:00-21:30; Sa 12:00-01:00; Fr 16:00-01:00",
  )!;
  // Mittag und Abend getrennt
  const trattoria = parseOpeningHours(
    "Di, Mi, Do, Fr, Sa, So 17:00-21:00; Di, Mi, Do, Fr, Sa, So 11:30-14:00",
  )!;

  it("erkennt geöffnet mit Schlusszeit", () => {
    // Mi 4.11.2026, 12:00
    expect(openStatus(trattoria, berlin("2026-11-04T12:00"))).toEqual({
      state: "open",
      until: 840,
    });
  });

  it("erkennt die Mittagspause und nennt die nächste Öffnung", () => {
    expect(openStatus(trattoria, berlin("2026-11-04T15:00"))).toEqual({
      state: "opens-later",
      at: 1020,
    });
  });

  it("erkennt Ruhetag und Feierabend", () => {
    // Mo 2.11.2026 ist bei der Trattoria Ruhetag
    expect(openStatus(trattoria, berlin("2026-11-02T12:00")).state).toBe("closed-today");
    expect(openStatus(trattoria, berlin("2026-11-04T22:00")).state).toBe("closed-today");
  });

  it("rechnet über Mitternacht in den nächsten Tag", () => {
    // Sa 7.11. 23:30 → noch Samstag, offen bis 1:00
    expect(openStatus(pub, berlin("2026-11-07T23:30"))).toEqual({ state: "open", until: 60 });
    // So 8.11. 0:30 → Rest vom Samstag
    expect(openStatus(pub, berlin("2026-11-08T00:30"))).toEqual({ state: "open", until: 60 });
    // So 8.11. 1:30 → geschlossen, öffnet um 12:00
    expect(openStatus(pub, berlin("2026-11-08T01:30"))).toEqual({
      state: "opens-later",
      at: 720,
    });
  });

  it("nennt bei „ab“ keine Schlusszeit", () => {
    const keller = parseOpeningHours("Sa, So ab 11:30")!;
    expect(openStatus(keller, berlin("2026-11-07T20:00"))).toEqual({
      state: "open",
      until: null,
    });
  });

  it("gibt an Feiertagen keinen Status, weil die Daten dazu nichts sagen", () => {
    // Fr 25.12.2026
    expect(openStatus(pub, berlin("2026-12-25T18:00")).state).toBe("holiday");
  });
});

describe("statusText", () => {
  it("formuliert jeden Zustand", () => {
    expect(statusText({ state: "open", until: 1290 })).toBe("jetzt geöffnet bis 21:30 Uhr");
    expect(statusText({ state: "open", until: null })).toBe(
      "jetzt geöffnet (Schlusszeit nicht angegeben)",
    );
    expect(statusText({ state: "opens-later", at: 1020 })).toBe(
      "jetzt geschlossen, öffnet heute um 17:00 Uhr",
    );
    expect(statusText({ state: "closed-today" })).toBe("heute geschlossen");
  });
});

describe("formatOpeningHours", () => {
  it("fasst gleiche Tage zusammen und nennt Ruhetage", () => {
    const hours = parseOpeningHours(
      "Di, Mi, Do, Fr, Sa, So 17:00-21:00; Di, Mi, Do, Fr, Sa, So 11:30-14:00",
    )!;
    expect(formatOpeningHours(hours)).toEqual([
      "Mo geschlossen",
      "Di–So 11:30–14:00 und 17:00–21:00 Uhr",
    ]);
  });

  it("schreibt „täglich“ und trennt abweichende Tage", () => {
    expect(formatOpeningHours(parseOpeningHours("Mo, Di, Mi, Do, Fr, Sa, So 12:00-22:00")!)).toEqual([
      "täglich 12:00–22:00 Uhr",
    ]);
    expect(
      formatOpeningHours(parseOpeningHours("So 07:30-19:00; Mo, Di, Mi, Do, Fr, Sa 07:00-19:00")!),
    ).toEqual(["Mo–Sa 7:00–19:00 Uhr", "So 7:30–19:00 Uhr"]);
  });
});
