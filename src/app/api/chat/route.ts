import { anthropic } from "@ai-sdk/anthropic";
import { convertToCoreMessages, streamText, type Message } from "ai";

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

  const { messages }: { messages: Message[] } = await req.json();

  const result = streamText({
    model: anthropic(MODEL),
    system: SYSTEM_PROMPT,
    messages: convertToCoreMessages(messages),
    // Claude-5-Modelle lehnen `temperature: 0` ab ("deprecated for this model").
    // AI SDK v4 setzt temperature sonst hart auf 0 (in v5 entfernt), daher hier
    // explizit den API-Default 1 setzen.
    temperature: 1,
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error) => {
      // Server-seitig vollständig loggen, Client nur eine generische Meldung geben.
      console.error("[api/chat]", error);
      return "Es ist ein Fehler bei der Chat-Anfrage aufgetreten.";
    },
  });
}
