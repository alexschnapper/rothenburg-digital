import { z } from "zod";

import { guard } from "@/lib/guard/config";

/**
 * Schema für den Request-Body von `/api/chat`.
 *
 * Grundhaltung: **streng bei dem, was gefährlich ist — tolerant bei dem, was
 * nur Beiwerk ist.**
 *
 * Der Client schickt `UIMessage`s des AI SDK zurück, und deren Parts sind
 * nicht vorhersagbar: neben `text` und `step-start` entstehen je nach Modell
 * und SDK-Version auch `reasoning`, `source-url`, `custom` und weitere. Eine
 * Allowlist bekannter Part-Typen wirkt sauber, macht aber jede Sitzung kaputt,
 * sobald das Modell einmal etwas anderes liefert (Claude 5 sendet bei längeren
 * Antworten einen `reasoning`-Part) — und sie hängt damit am Provider, was
 * genau diese Schicht nicht darf (Issue #12).
 *
 * Deshalb:
 *
 * - Verarbeitet wird ausschließlich `text`; alle anderen Parts werden beim
 *   Aufbau der Modellnachrichten **ignoriert**.
 * - Abgelehnt wird nur, was sicherheitsrelevant ist: Datei-/Bild-Parts (Vision
 *   Kosten und Text-im-Bild als Injection-Medium), Tool-Parts (der Client darf
 *   keine Tool-Ergebnisse erfinden) und eigene Data-Parts.
 * - Die Rolle `system` ist nicht zugelassen: der System-Prompt kommt
 *   ausschließlich vom Server.
 *
 * Unbekannte Zusatzfelder entfernt Zod stillschweigend (Default `strip`) — das
 * AI SDK schickt je nach Version Felder wie `state` oder `trigger` mit, die
 * hier niemanden interessieren.
 */

const partSchema = z.object({
  type: z.string().min(1).max(64),
  // Nur bei `text`-Parts gesetzt. Harte Payload-Grenze; die eigentliche,
  // nutzerfreundliche Längenprüfung passiert nach der Normalisierung in der
  // Route.
  text: z
    .string()
    .max(Math.max(guard.maxUserChars * 4, 4000))
    .optional(),
});

const messageSchema = z.object({
  id: z.string().max(128).optional(),
  role: z.enum(["user", "assistant"]),
  // Kein `min(1)`: `useChat` lässt nach einer fehlgeschlagenen Anfrage (429,
  // 503, Abbruch) eine Assistenz-Nachricht **ohne Parts** im Verlauf zurück
  // und schickt sie beim nächsten Versuch mit. Würde das Schema sie ablehnen,
  // wäre die Sitzung dauerhaft kaputt — jede weitere Frage bekäme „Ungültige
  // Anfrage", auch eine harmlose. Leere Nachrichten werden in der Route
  // verworfen, statt die Anfrage abzuweisen.
  parts: z.array(partSchema).max(64),
});

export const chatRequestSchema = z.object({
  id: z.string().max(128).optional(),
  messages: z
    .array(messageSchema)
    .min(1)
    // Großzügiger als `maxHistoryMessages`: zu lange Verläufe werden gekürzt,
    // nicht abgelehnt. Erst weit darüber ist es kein Chat mehr, sondern ein
    // Versuch, den Kontext zu fluten.
    .max(Math.max(guard.maxHistoryMessages * 5, 50)),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Part-Typen, die der Client nicht schicken darf. */
const isDeniedPart = (type: string): boolean =>
  type === "file" ||
  type === "reasoning-file" ||
  type === "dynamic-tool" ||
  type.startsWith("tool-") ||
  type.startsWith("data-");

/**
 * Namen der unerlaubten Part-Typen in der Anfrage (leer = alles in Ordnung).
 *
 * Nur Typnamen, keine Inhalte — damit sie gefahrlos ins Log dürfen.
 */
export function deniedPartTypes(request: ChatRequest): string[] {
  const found = new Set<string>();
  for (const message of request.messages) {
    for (const part of message.parts) {
      if (isDeniedPart(part.type)) found.add(part.type);
    }
  }
  return [...found];
}

/** Sichtbarer Text einer validierten Nachricht; alles andere wird ignoriert. */
export const textOf = (message: z.infer<typeof messageSchema>): string =>
  message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
