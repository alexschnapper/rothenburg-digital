import { describe, expect, it } from "vitest";

import { embedExternalContent } from "@/lib/guard/external";

describe("embedExternalContent", () => {
  it("packt den Text in einen fremdquelle-Marker mit Herkunftsangabe", () => {
    const result = embedExternalContent("Feinstaub: 12 Mikrogramm", "Sensor.Community", "abc123");
    expect(result).toBe(
      '<fremdquelle id="abc123" herkunft="Sensor.Community">\nFeinstaub: 12 Mikrogramm\n</fremdquelle>',
    );
  });

  it("entfernt unsichtbare Zeichen wie bei Nutzertext (sanitizeText)", () => {
    const zeroWidthSpace = String.fromCodePoint(0x200b);
    const result = embedExternalContent(
      `Öffnungszeit${zeroWidthSpace}en: 9–17 Uhr`,
      "Testquelle",
      "n1",
    );
    expect(result).toContain("Öffnungszeiten: 9–17 Uhr");
    expect(result).not.toContain(zeroWidthSpace);
  });

  it("kürzt lange Inhalte auf das Zeichenlimit", () => {
    const long = "A".repeat(50);
    const result = embedExternalContent(long, "Testquelle", "n1", 10);
    expect(result).toContain("A".repeat(10) + "…");
    expect(result).not.toContain("A".repeat(11));
  });

  it("nutzt ein Standardlimit ohne explizites maxChars", () => {
    const long = "B".repeat(5000);
    const result = embedExternalContent(long, "Testquelle", "n1");
    expect(result.length).toBeLessThan(2100);
  });
});
