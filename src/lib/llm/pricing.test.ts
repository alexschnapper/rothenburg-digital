import { afterEach, describe, expect, it, vi } from "vitest";

import { costEur, priceOf } from "@/lib/llm/pricing";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("priceOf", () => {
  it("findet ein bekanntes Modell in der Preistabelle", () => {
    expect(priceOf("claude-sonnet-5")).toEqual({
      inputUsdPerMTok: 3,
      outputUsdPerMTok: 15,
    });
  });

  it("liefert undefined für ein unbekanntes Modell (keine Rateschätzung)", () => {
    expect(priceOf("ein-modell-das-es-nicht-gibt")).toBeUndefined();
  });

  it("Env-Preis geht vor der Tabelle", () => {
    vi.stubEnv("LLM_PRICE_INPUT_USD_PER_MTOK", "1");
    vi.stubEnv("LLM_PRICE_OUTPUT_USD_PER_MTOK", "2");
    expect(priceOf("claude-sonnet-5")).toEqual({
      inputUsdPerMTok: 1,
      outputUsdPerMTok: 2,
    });
  });

  it("ignoriert einen unbrauchbaren Env-Preis und fällt auf die Tabelle zurück", () => {
    vi.stubEnv("LLM_PRICE_INPUT_USD_PER_MTOK", "-1");
    vi.stubEnv("LLM_PRICE_OUTPUT_USD_PER_MTOK", "abc");
    expect(priceOf("claude-sonnet-5")).toEqual({
      inputUsdPerMTok: 3,
      outputUsdPerMTok: 15,
    });
  });
});

describe("costEur", () => {
  it("ist undefined ohne bekannten Preis", () => {
    expect(
      costEur({ inputTokens: 100, outputTokens: 100 }, undefined),
    ).toBeUndefined();
  });

  it("rechnet Token in Euro um", () => {
    const eur = costEur(
      { inputTokens: 1_000_000, outputTokens: 0 },
      { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
    );
    // usdToEur liest USD_TO_EUR_PERCENT, Default 92 -> 0,92.
    expect(eur).toBeCloseTo(3 * 0.92, 6);
  });

  it("ist 0 bei 0 Token, nicht undefined", () => {
    expect(
      costEur(
        { inputTokens: 0, outputTokens: 0 },
        { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
      ),
    ).toBe(0);
  });
});
