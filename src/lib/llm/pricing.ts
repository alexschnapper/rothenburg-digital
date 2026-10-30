import { envInt } from "@/lib/env";

/**
 * Listenpreise der eingesetzten Modelle — Grundlage der Kostenanzeige im Chat.
 *
 * **Stand: 07.09.2026.** Preise ändern sich; diese Tabelle ist eine Momentaufnahme
 * und keine Abrechnung. Quellen:
 *
 * - Anthropic: <https://claude.com/pricing> (Standardpreise, nicht Batch/Cache)
 * - Mistral: <https://mistral.ai/pricing/api> (Standardpreise; Batch kostet die
 *   Hälfte, regionale Inferenz 10 % mehr — beides hier nicht abgebildet)
 *
 * Ist ein Modell nicht eingetragen, wird **keine** Kostenschätzung angezeigt
 * statt einer falschen. Für ein neues Modell entweder hier ergänzen oder per Env
 * setzen (`LLM_PRICE_INPUT_USD_PER_MTOK`, `LLM_PRICE_OUTPUT_USD_PER_MTOK`) —
 * so lässt sich ein Modellwechsel ohne Codeänderung ausrollen.
 */

export type ModelPrice = {
  /** US-Dollar pro 1 Mio. Eingabe-Token. */
  inputUsdPerMTok: number;
  /** US-Dollar pro 1 Mio. Ausgabe-Token. */
  outputUsdPerMTok: number;
};

const LIST_PRICES: Record<string, ModelPrice> = {
  // Anthropic (Standardpreise; das Einführungsfenster für Sonnet 5 lief bis
  // 31.08.2026 und ist abgelaufen).
  "claude-opus-5": { inputUsdPerMTok: 5, outputUsdPerMTok: 25 },
  "claude-sonnet-5": { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  "claude-haiku-4-5": { inputUsdPerMTok: 1, outputUsdPerMTok: 5 },

  // Mistral (EU-gehostet, siehe Issue #12).
  "mistral-large-latest": { inputUsdPerMTok: 0.5, outputUsdPerMTok: 1.5 },
  "mistral-medium-latest": { inputUsdPerMTok: 1.5, outputUsdPerMTok: 7.5 },
  "mistral-small-latest": { inputUsdPerMTok: 0.15, outputUsdPerMTok: 0.6 },
  "ministral-8b-latest": { inputUsdPerMTok: 0.15, outputUsdPerMTok: 0.15 },
};

/**
 * Wechselkurs USD→EUR. Kein Live-Kurs, bewusst ein fester Wert: die Anzeige
 * ist eine Größenordnung, keine Buchhaltung. Über `USD_TO_EUR` anpassbar
 * (in Hundertstel-Cent, also 92 = 0,92 €).
 */
export const usdToEur = envInt(process.env.USD_TO_EUR_PERCENT, 92) / 100;

/** Preis eines Modells: Env-Vorgabe zuerst, dann Tabelle, sonst unbekannt. */
export function priceOf(modelId: string): ModelPrice | undefined {
  const input = process.env.LLM_PRICE_INPUT_USD_PER_MTOK;
  const output = process.env.LLM_PRICE_OUTPUT_USD_PER_MTOK;

  if (input !== undefined && output !== undefined) {
    const inputUsdPerMTok = Number(input);
    const outputUsdPerMTok = Number(output);
    if (
      Number.isFinite(inputUsdPerMTok) &&
      Number.isFinite(outputUsdPerMTok) &&
      inputUsdPerMTok >= 0 &&
      outputUsdPerMTok >= 0
    ) {
      return { inputUsdPerMTok, outputUsdPerMTok };
    }
  }

  return LIST_PRICES[modelId];
}

/** Kosten einer Anfrage in Euro; `undefined`, wenn kein Preis bekannt ist. */
export function costEur(
  usage: { inputTokens: number; outputTokens: number },
  price: ModelPrice | undefined,
): number | undefined {
  if (!price) return undefined;
  const usd =
    (usage.inputTokens * price.inputUsdPerMTok +
      usage.outputTokens * price.outputUsdPerMTok) /
    1_000_000;
  return usd * usdToEur;
}
