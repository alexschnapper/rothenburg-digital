import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * Token-Usage, die der Server über `messageMetadata` an den Client streamt.
 *
 * Ab AI SDK v5 liefert der `onFinish`-Callback von `useChat` keine Usage mehr —
 * der Weg läuft über Message-Metadaten: Server setzt sie in
 * `toUIMessageStreamResponse`, Client validiert sie per `messageMetadataSchema`.
 */
export const usageMetadataSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
});

export type UsageMetadata = z.infer<typeof usageMetadataSchema>;

/** UIMessage-Variante dieses Projekts (mit Usage-Metadaten). */
export type ChatMessage = UIMessage<UsageMetadata>;
