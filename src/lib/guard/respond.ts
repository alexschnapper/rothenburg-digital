import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import type { ChatMessage } from "@/lib/chat";

/**
 * Antwortformen für abgelehnte Anfragen.
 *
 * Zwei Fälle, absichtlich unterschiedlich behandelt:
 *
 * - **Technische Ablehnung** (zu groß, zu häufig, abgeschaltet): HTTP-Fehler
 *   mit Klartext im Body. `useChat` wirft daraus einen Fehler, dessen
 *   `message` genau dieser Body ist — die Chat-UI zeigt also einen lesbaren
 *   deutschen Satz und keinen JSON-Rumpf.
 * - **Inhaltliche Ablehnung** (Injection-Heuristik): normale 200-Antwort im
 *   UI-Message-Stream-Format mit der festen Ablehnungsformel. Für die Person
 *   am Bildschirm sieht das wie eine gewöhnliche Antwort aus, es wurde aber
 *   kein Modell aufgerufen — die Anfrage kostet null Token.
 */

export function textError(
  message: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}

/** Feste Antwort ohne Modellaufruf, im Streamformat des AI SDK. */
export function cannedMessageResponse(text: string): Response {
  const stream = createUIMessageStream<ChatMessage>({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: "0" });
      writer.write({ type: "text-delta", id: "0", delta: text });
      writer.write({ type: "text-end", id: "0" });
      // Usage-Metadaten wie bei einer echten Antwort, damit die Kostenanzeige
      // im Footer die 0 Token dieser Anfrage korrekt ausweist.
      writer.write({
        type: "finish",
        messageMetadata: { inputTokens: 0, outputTokens: 0 },
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
