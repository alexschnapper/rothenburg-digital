import { describe, expect, it } from "vitest";

import { FUNDING_TEXT, SIMPLE_LANGUAGE_SECTION, systemPrompt } from "@/lib/guard/prompt";

describe("systemPrompt: Betreiber und Finanzierung", () => {
  const prompt = systemPrompt("n1");

  it("gibt sich nicht als Assistent der Stadt aus", () => {
    expect(prompt).not.toContain("Assistent der Stadt");
    expect(prompt).toContain("kein offizielles Angebot");
  });

  it("nennt die private Finanzierung und verbietet Vermutungen", () => {
    expect(prompt).toContain(FUNDING_TEXT);
    expect(FUNDING_TEXT).toContain("Privatperson");
    expect(FUNDING_TEXT).toContain("nicht die Stadt");
    expect(prompt).toContain("keine städtischen Mittel");
  });
});

describe("systemPrompt: eigene Seiten", () => {
  it("nennt die Seiten, auf die der Chat verlinken darf", () => {
    const prompt = systemPrompt("n1");
    for (const path of ["/parken", "/essen-trinken", "/kosten", "/datenschutz"]) {
      expect(prompt).toContain(`](${path})`);
    }
  });
});

describe("systemPrompt: Einfache Sprache (#2)", () => {
  const off = systemPrompt("n1");
  const on = systemPrompt("n1", [], { simpleLanguage: true });

  it("hängt den Block nur bei eingeschaltetem Umschalter an", () => {
    expect(off).not.toContain(SIMPLE_LANGUAGE_SECTION);
    expect(on).toContain(SIMPLE_LANGUAGE_SECTION);
  });

  it("ändert sonst nichts am Prompt", () => {
    expect(on.replace(`\n${SIMPLE_LANGUAGE_SECTION}\n`, "")).toBe(off);
  });

  it("steht vor den festen Grenzen und lässt sie ausdrücklich gelten", () => {
    expect(on.indexOf(SIMPLE_LANGUAGE_SECTION)).toBeLessThan(on.indexOf("## Feste Grenzen"));
    expect(SIMPLE_LANGUAGE_SECTION).toContain("nie, **was** du sagen");
    expect(SIMPLE_LANGUAGE_SECTION).toContain("wörtlich übernehmen");
  });
});

describe("systemPrompt: Barrierefreiheit", () => {
  it("verbietet erfundene barrierefreie Wege und verweist auf Stadt und RTS", () => {
    const prompt = systemPrompt("n1");
    expect(prompt).toContain("## Barrierefreiheit");
    expect(prompt).toContain("Beschreibe dazu\nkeine Wege");
  });
});
