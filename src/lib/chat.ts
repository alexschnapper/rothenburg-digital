import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * Token-Usage und Kosten, die der Server über `messageMetadata` an den Client
 * streamt.
 *
 * Ab AI SDK v5 liefert der `onFinish`-Callback von `useChat` keine Usage mehr —
 * der Weg läuft über Message-Metadaten: Server setzt sie in
 * `toUIMessageStreamResponse`, Client validiert sie per `messageMetadataSchema`.
 *
 * Warum die Kosten **serverseitig** berechnet werden (Issue #12): welcher
 * Provider und welches Modell laufen, entscheidet die Umgebung — die Preise
 * liegen deshalb dort, wo auch die Modellauswahl liegt (`src/lib/llm/`). Der
 * Client zeigt nur an, was er bekommt, und hat keine eingebaute Preisliste, die
 * nach einem Providerwechsel falsch wäre.
 *
 * Alle Felder außer den Token-Zahlen sind optional: die feste Ablehnung der
 * Missbrauchs-Abwehr entsteht ohne Modellaufruf und meldet nur `0`/`0`, und für
 * ein Modell ohne hinterlegten Preis wird bewusst *keine* Schätzung angezeigt.
 */
export const usageMetadataSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  /** Modell, das die Antwort erzeugt hat — Grundlage der Fußnote im Chat. */
  model: z.string().optional(),
  /** Geschätzte Kosten dieser Anfrage in Euro. */
  costEur: z.number().optional(),
  /** Preisbasis der Schätzung, damit die Fußnote sich selbst erklärt. */
  price: z
    .object({
      inputUsdPerMTok: z.number(),
      outputUsdPerMTok: z.number(),
      usdToEur: z.number(),
    })
    .optional(),
});

export type UsageMetadata = z.infer<typeof usageMetadataSchema>;

/** UIMessage-Variante dieses Projekts (mit Usage-Metadaten). */
export type ChatMessage = UIMessage<UsageMetadata>;
