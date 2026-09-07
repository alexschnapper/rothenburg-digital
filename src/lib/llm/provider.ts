import { anthropic } from "@ai-sdk/anthropic";
import { mistral } from "@ai-sdk/mistral";
import type { LanguageModel } from "ai";

import { priceOf, usdToEur, type ModelPrice } from "@/lib/llm/pricing";

/**
 * Auswahl des LLM-Providers zur Laufzeit (Issue #12).
 *
 * **Warum austauschbar und nicht einfach ersetzt:** Anthropic bietet
 * Data-Residency nur für `us` und `global` — kein EU-Pinning. Für eine
 * Stadtverwaltung ist die Verarbeitung außerhalb der EU ein Beschaffungs- und
 * Datenschutzthema. Mistral ist EU-gehostet (Frankreich). Mit dieser Umschaltung
 * kann localhost/dev auf Claude bleiben, während Prod auf Mistral läuft — ohne
 * Codeänderung, nur über `LLM_PROVIDER` in der jeweiligen Umgebung.
 *
 * Die Missbrauchs-Abwehr in `src/lib/guard/` ist davon unabhängig: sie greift
 * vor dem Modellaufruf und verhält sich bei jedem Provider gleich. Was sich beim
 * Wechsel messbar ändert, ist die Prompt-Treue des Modells — dafür gibt es
 * `npm run redteam` (siehe `docs/SICHERHEIT-PROMPTS.md`).
 */

export const PROVIDERS = ["anthropic", "mistral"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

type ProviderSpec = {
  /** Anzeigename für Logs und die Kostenanzeige. */
  label: string;
  /** Env-Variable mit dem API-Key. */
  apiKeyEnv: string;
  /** Env-Variable, die das Modell überschreibt. */
  modelEnv: string;
  /** Modell, wenn nichts gesetzt ist. */
  defaultModel: string;
  /** Ort der Verarbeitung — Grund für die ganze Umschaltung. */
  dataRegion: string;
  create: (modelId: string) => LanguageModel;
};

const SPECS: Record<ProviderId, ProviderSpec> = {
  anthropic: {
    label: "Anthropic",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    defaultModel: "claude-sonnet-5",
    dataRegion: "USA / global (kein EU-Pinning)",
    create: (modelId) => anthropic(modelId),
  },
  mistral: {
    label: "Mistral AI",
    apiKeyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-large-latest",
    dataRegion: "EU (Frankreich)",
    create: (modelId) => mistral(modelId),
  },
};

const isProviderId = (value: string): value is ProviderId =>
  (PROVIDERS as readonly string[]).includes(value);

export type LlmConfig = {
  provider: ProviderId;
  label: string;
  modelId: string;
  apiKeyEnv: string;
  hasApiKey: boolean;
  dataRegion: string;
  price: ModelPrice | undefined;
  usdToEur: number;
};

export class LlmConfigError extends Error {}

/**
 * Aktive Konfiguration lesen.
 *
 * Ein unbekannter Wert in `LLM_PROVIDER` ist ein **Fehler und kein Anlass für
 * einen Fallback**: würde hier stillschweigend auf Anthropic zurückgefallen,
 * liefe eine Umgebung, die ausdrücklich EU-Verarbeitung verlangt, unbemerkt
 * über einen US-Anbieter. Lieber sichtbar kaputt als leise falsch.
 */
export function llmConfig(): LlmConfig {
  const requested = (process.env.LLM_PROVIDER ?? "anthropic").trim().toLowerCase();

  if (!isProviderId(requested)) {
    throw new LlmConfigError(
      `LLM_PROVIDER="${requested}" ist unbekannt. Erlaubt: ${PROVIDERS.join(", ")}.`,
    );
  }

  const spec = SPECS[requested];
  const modelId = process.env[spec.modelEnv]?.trim() || spec.defaultModel;

  return {
    provider: requested,
    label: spec.label,
    modelId,
    apiKeyEnv: spec.apiKeyEnv,
    hasApiKey: Boolean(process.env[spec.apiKeyEnv]?.trim()),
    dataRegion: spec.dataRegion,
    price: priceOf(modelId),
    usdToEur,
  };
}

/** Modellinstanz für `streamText`. Erst aufrufen, wenn der Key geprüft ist. */
export function llmModel(config: LlmConfig): LanguageModel {
  return SPECS[config.provider].create(config.modelId);
}

let logged = false;

/**
 * Aktive Konfiguration einmal pro Prozess ins Log schreiben.
 *
 * Beim Deployment ist das die schnellste Antwort auf „läuft Prod wirklich über
 * Mistral?" — sichtbar im Node-Log der Domain, ohne Testanfrage. Enthält
 * bewusst keinen Key, nur dessen Vorhandensein.
 */
export function logLlmConfigOnce(config: LlmConfig): void {
  if (logged) return;
  logged = true;
  console.info(
    JSON.stringify({
      scope: "llm",
      provider: config.provider,
      model: config.modelId,
      dataRegion: config.dataRegion,
      apiKeySet: config.hasApiKey,
      priceKnown: config.price !== undefined,
    }),
  );
}
