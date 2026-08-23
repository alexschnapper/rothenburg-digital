import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText } from "ai";

import type { ChatMessage } from "@/lib/chat";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const SYSTEM_PROMPT = `Du bist der digitale Assistent der Stadt Rothenburg.
Antworte präzise, freundlich und in einfacher Sprache. Nutze bei Bedarf
Aufzählungen. Wenn du etwas nicht sicher weißt, sage das offen.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY ist nicht gesetzt. Bitte .env.local konfigurieren.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages }: { messages: ChatMessage[] } = await req.json();

  // Kein `temperature`: Claude-5-Modelle lehnen abweichende Sampling-Parameter
  // ab. Das AI SDK setzt seit v5 keinen Default mehr, der Parameter wird also
  // nur gesendet, wenn er hier gesetzt ist — weglassen ist korrekt.
  const result = streamText({
    model: anthropic(MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse<ChatMessage>({
    // Token-Usage für die Kostenanzeige im Footer an den Client durchreichen.
    // Wird bei `start` und `finish` aufgerufen — Usage gibt es nur bei `finish`.
    messageMetadata: ({ part }) =>
      part.type === "finish"
        ? {
            inputTokens: part.totalUsage.inputTokens ?? 0,
            outputTokens: part.totalUsage.outputTokens ?? 0,
          }
        : undefined,
    onError: (error) => {
      // Server-seitig vollständig loggen, Client nur eine generische Meldung geben.
      console.error("[api/chat]", error);
      return "Es ist ein Fehler bei der Chat-Anfrage aufgetreten.";
    },
  });
}
