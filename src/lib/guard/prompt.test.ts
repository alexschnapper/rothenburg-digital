import { describe, expect, it } from "vitest";

import { FUNDING_TEXT, systemPrompt } from "@/lib/guard/prompt";

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
