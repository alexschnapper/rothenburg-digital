import { streamText, type ModelMessage } from "ai";
import { randomUUID } from "node:crypto";

import type { ChatMessage } from "@/lib/chat";
import { guard } from "@/lib/guard/config";
import { logGuard, pseudonym } from "@/lib/guard/log";
import { REFUSAL_TEXT, spotlight, systemPrompt } from "@/lib/guard/prompt";
import {
  checkRateLimit,
  clientKey,
  isBudgetExhausted,
  recordSuspicious,
  recordTokens,
} from "@/lib/guard/ratelimit";
import { cannedMessageResponse, textError } from "@/lib/guard/respond";
import { sanitizeText, truncate } from "@/lib/guard/sanitize";
import {
  chatRequestSchema,
  deniedPartTypes,
  textOf,
} from "@/lib/guard/schema";
import { HIDDEN_CHAR_THRESHOLD, screenUserText } from "@/lib/guard/screen";
import { costEur } from "@/lib/llm/pricing";
import {
  LlmConfigError,
  llmConfig,
  llmModel,
  logLlmConfigOnce,
} from "@/lib/llm/provider";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Platzhalter für Verlaufsnachrichten, deren Inhalt aussortiert wurde. */
const REMOVED_PLACEHOLDER = "[Inhalt durch die Sicherheitsprüfung entfernt]";

/**
 * Ist die Anfrage von der eigenen Seite gestartet?
 *
 * Kein Sicherheitsmerkmal (der Header ist fälschbar), aber wirksam gegen
 * fremde Seiten und Skripte, die den Endpoint als kostenlosen LLM-Proxy
 * einbinden. Browser senden `Origin` bei POST immer mit.
 */
function isAllowedOrigin(req: Request): boolean {
  if (!guard.requireSameOrigin) return true;

  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (guard.allowedOrigins.includes(origin)) return true;

  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const key = clientKey(req);
  const client = pseudonym(key);

  if (guard.disabled) {
    return textError(
      "Der Chat ist derzeit deaktiviert. Bitte später erneut versuchen.",
      503,
    );
  }

  // Provider und Modell kommen aus der Umgebung (Issue #12). Ein unbekannter
  // Wert in `LLM_PROVIDER` ist ein Konfigurationsfehler, kein Fallback-Anlass.
  let llm;
  try {
    llm = llmConfig();
  } catch (error) {
    if (!(error instanceof LlmConfigError)) throw error;
    console.error("[api/chat]", error.message);
    return textError(
      "Der Chat ist falsch konfiguriert. Bitte an die Administration wenden.",
      503,
    );
  }

  logLlmConfigOnce(llm);

  if (!llm.hasApiKey) {
    // Wie beim LlmConfigError oben: das Detail (welche Variable, welcher
    // Provider) ist nur für die Administration interessant und gehört nicht
    // in eine öffentlich sichtbare Fehlermeldung — sonst verrät die Antwort
    // fremden Besucher:innen etwas über die Server-Konfiguration.
    console.error(
      `[api/chat] ${llm.apiKeyEnv} ist nicht gesetzt (Provider: ${llm.provider}).`,
    );
    return textError(
      "Der Chat ist falsch konfiguriert. Bitte an die Administration wenden.",
      503,
    );
  }

  if (!isAllowedOrigin(req)) {
    logGuard("warn", { event: "origin-rejected", client });
    return textError("Anfrage von dieser Herkunft ist nicht erlaubt.", 403);
  }

  const limit = checkRateLimit(key);
  if (!limit.ok) {
    logGuard("warn", { event: limit.reason, client });
    return textError(limit.message, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  if (isBudgetExhausted()) {
    logGuard("warn", { event: "budget-exhausted", client });
    return textError(
      "Das Tagesbudget des Assistenten ist ausgeschöpft. Bitte morgen wieder.",
      503,
      { "Retry-After": "3600" },
    );
  }

  // Roh-Body zuerst nach Größe prüfen, damit ein Megabyte-Payload nicht erst
  // geparst wird.
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > guard.maxBodyBytes) {
    logGuard("warn", { event: "body-too-large", client, bytes: raw.length });
    return textError("Die Anfrage ist zu groß.", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return textError("Ungültige Anfrage.", 400);
  }

  const parsed = chatRequestSchema.safeParse(payload);
  if (!parsed.success) {
    logGuard("warn", {
      event: "invalid-body",
      client,
      // Nur Pfad und Fehlerart, nie der beanstandete Wert — sonst landet
      // Nachrichtentext im Log.
      issues: parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "(root)"}:${issue.code}`),
    });
    return textError("Ungültige Anfrage.", 400);
  }

  // Datei-, Tool- und Data-Parts werden abgelehnt statt ignoriert: sie kommen
  // nie von dieser UI, kosten im Zweifel Geld (Vision) und wären ein weiterer
  // Injection-Kanal. Nur die Typnamen ins Log, keine Inhalte.
  const denied = deniedPartTypes(parsed.data);
  if (denied.length > 0) {
    logGuard("warn", { event: "denied-parts", client, parts: denied });
    return textError("Diese Anfrage enthält nicht erlaubte Inhalte.", 400);
  }

  // Verlauf normalisieren und inhaltsleere Nachrichten verwerfen. Der Verlauf
  // kommt vom Client und ist damit nicht vertrauenswürdig — auch die
  // `assistant`-Turns darin sind frei erfundene Vorgaben, solange es keine
  // serverseitige Sitzung gibt (siehe Issue #13, „Bekannte Lücken").
  const turns = parsed.data.messages
    .map((message) => ({ role: message.role, ...sanitizeText(textOf(message)) }))
    .filter((turn) => turn.text.length > 0)
    // Nur der jüngste Teil des Verlaufs geht ans Modell.
    .slice(-guard.maxHistoryMessages);

  const lastUser = turns.at(-1);
  if (!lastUser || lastUser.role !== "user") {
    logGuard("warn", { event: "no-user-turn", client, turns: turns.length });
    return textError(
      "Die Anfrage enthält keine Frage. Bitte Text eingeben und erneut senden.",
      400,
    );
  }

  if (lastUser.text.length > guard.maxUserChars) {
    return textError(
      `Die Nachricht ist zu lang (${lastUser.text.length} von maximal ${guard.maxUserChars} Zeichen). Bitte kürzer fassen.`,
      413,
    );
  }

  const screening = screenUserText(lastUser.text);
  const hiddenChars = lastUser.removed >= HIDDEN_CHAR_THRESHOLD;

  if (screening.blocked || hiddenChars) {
    const rules = hiddenChars
      ? [...screening.rules, "hidden-characters"]
      : screening.rules;
    recordSuspicious(key);
    logGuard("warn", {
      event: "blocked",
      client,
      rules,
      chars: lastUser.text.length,
      removed: lastUser.removed,
    });
    // Feste Ablehnung ohne Modellaufruf: 0 Token, 0 Kosten.
    return cannedMessageResponse(REFUSAL_TEXT);
  }

  // Pro Anfrage neue Kennung für die Datenmarkierung — nicht vorhersagbar,
  // also nicht durch Nutzertext nachahmbar.
  const nonce = randomUUID();

  const modelMessages: ModelMessage[] = [];
  let budget = guard.maxTotalChars;

  // Von hinten nach vorn füllen: die aktuelle Frage hat Vorrang, ältere
  // Nachrichten fallen weg, wenn das Zeichenbudget erschöpft ist.
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const isCurrentTurn = index === turns.length - 1;

    // Ältere Nachrichten werden nicht abgelehnt (das würde eine Sitzung
    // dauerhaft blockieren), ihr Inhalt wird bei einem Treffer aber ersetzt —
    // die Payload erreicht das Modell nie.
    const suspicious =
      !isCurrentTurn &&
      turn.role === "user" &&
      (screenUserText(turn.text).blocked ||
        turn.removed >= HIDDEN_CHAR_THRESHOLD);

    const content = suspicious
      ? REMOVED_PLACEHOLDER
      : truncate(turn.text, guard.maxUserChars);

    if (content.length > budget) break;
    budget -= content.length;

    modelMessages.unshift(
      turn.role === "user"
        ? { role: "user", content: spotlight(content, nonce) }
        : { role: "assistant", content },
    );
  }

  // Kein `temperature`: Claude-5-Modelle lehnen abweichende Sampling-Parameter
  // ab. Das AI SDK setzt seit v5 keinen Default mehr, der Parameter wird also
  // nur gesendet, wenn er hier gesetzt ist — weglassen ist korrekt und passt
  // auch für Mistral, das den Default des Modells verwendet.
  const result = streamText({
    model: llmModel(llm),
    system: systemPrompt(nonce),
    messages: modelMessages,
    // Deckel auf die Antwortlänge: begrenzt die teuren Output-Token und
    // verhindert, dass jemand den Assistenten als Textgenerator ausnutzt.
    maxOutputTokens: guard.maxOutputTokens,
    // Bricht den Modellaufruf ab, wenn der Client die Verbindung schließt —
    // sonst läuft die Abrechnung weiter, obwohl niemand mehr zuhört.
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse<ChatMessage>({
    // Token-Usage und Kosten für die Anzeige im Footer an den Client
    // durchreichen. Wird bei `start` und `finish` aufgerufen — Usage gibt es
    // nur bei `finish`.
    messageMetadata: ({ part }) => {
      if (part.type !== "finish") return undefined;

      const inputTokens = part.totalUsage.inputTokens ?? 0;
      const outputTokens = part.totalUsage.outputTokens ?? 0;
      // Verbrauch aufs Tagesbudget buchen — hier liegt die einzige Stelle, an
      // der die echten Zahlen des Providers vorliegen.
      recordTokens(inputTokens + outputTokens);

      // Kosten serverseitig rechnen: Preise gehören zum Provider, nicht in den
      // Client. Ohne hinterlegten Preis bleibt `costEur` leer — dann zeigt die
      // UI bewusst keine Schätzung statt einer falschen.
      return {
        inputTokens,
        outputTokens,
        model: llm.modelId,
        costEur: costEur({ inputTokens, outputTokens }, llm.price),
        price: llm.price
          ? { ...llm.price, usdToEur: llm.usdToEur }
          : undefined,
      };
    },
    onError: (error) => {
      // Server-seitig vollständig loggen, Client nur eine generische Meldung geben.
      console.error("[api/chat]", error);
      return "Es ist ein Fehler bei der Chat-Anfrage aufgetreten.";
    },
  });
}
