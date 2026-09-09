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
  recordBlocked,
  recordScreened,
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
import {
  appendSessionTurn,
  loadSession,
  sessionCookieHeader,
  type SessionTurn,
} from "@/lib/guard/session";
import { costEur } from "@/lib/llm/pricing";
import {
  LlmConfigError,
  llmConfig,
  llmModel,
  logLlmConfigOnce,
} from "@/lib/llm/provider";

export const runtime = "nodejs";
export const maxDuration = 30;

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

  // Serverseitige Sitzung (Issue #14): für den Modellkontext zählt ab hier
  // nur noch `session.turns` — der vom Client mitgeschickte Verlauf dient
  // ausschließlich dazu, die *neue* Frage zu finden (letzte Nachricht mit
  // Inhalt). Ältere Einträge im Client-Verlauf werden dafür gar nicht erst
  // gelesen — ein untergeschobener `assistant`-Turn hat dadurch keine
  // Wirkung mehr, er kann nie Teil dessen werden, was das Modell sieht.
  const session = loadSession(req);

  // Dieselbe Toleranz wie zuvor: `useChat` lässt nach einem Fehler eine
  // leere Assistenz-Nachricht im Verlauf zurück, die beim nächsten Versuch
  // mitkommt. Inhaltsleere Nachrichten werden übersprungen, nicht als
  // „keine Frage" gewertet.
  const nonEmptyClientMessages = parsed.data.messages.filter(
    (message) => textOf(message).trim().length > 0,
  );
  const rawLast = nonEmptyClientMessages.at(-1);

  if (!rawLast || rawLast.role !== "user") {
    logGuard("warn", {
      event: "no-user-turn",
      client,
      turns: nonEmptyClientMessages.length,
    });
    return textError(
      "Die Anfrage enthält keine Frage. Bitte Text eingeben und erneut senden.",
      400,
    );
  }

  const { text: userText, removed } = sanitizeText(textOf(rawLast));
  if (userText.length === 0) {
    logGuard("warn", { event: "no-user-turn", client, turns: 0 });
    return textError(
      "Die Anfrage enthält keine Frage. Bitte Text eingeben und erneut senden.",
      400,
    );
  }

  if (userText.length > guard.maxUserChars) {
    return textError(
      `Die Nachricht ist zu lang (${userText.length} von maximal ${guard.maxUserChars} Zeichen). Bitte kürzer fassen.`,
      413,
    );
  }

  const screening = screenUserText(userText);
  const hiddenChars = removed >= HIDDEN_CHAR_THRESHOLD;
  // Vor der Entscheidung zählen (Issue #17) — sonst verzerrt jede Ablehnung
  // die Blockrate, weil der Nenner fehlt.
  recordScreened();
  // `Secure` an NODE_ENV statt am Request-Protokoll: nginx terminiert TLS
  // vor Passenger, `req.url` sieht intern also selbst auf dev/staging/prod
  // wie http aus. Application Mode `production` setzt NODE_ENV=production
  // (siehe docs/DEPLOYMENT.md) — dort läuft nginx immer mit TLS davor.
  const cookie = {
    "Set-Cookie": sessionCookieHeader(
      session.id,
      process.env.NODE_ENV === "production",
    ),
  };

  if (screening.blocked || hiddenChars) {
    const rules = hiddenChars
      ? [...screening.rules, "hidden-characters"]
      : screening.rules;
    recordSuspicious(key);
    recordBlocked(rules);
    logGuard("warn", {
      event: "blocked",
      client,
      rules,
      chars: userText.length,
      removed,
    });
    // Feste Ablehnung ohne Modellaufruf: 0 Token, 0 Kosten. Der blockierte
    // Text wird bewusst nicht in die Sitzung übernommen — er soll nie Teil
    // des vertrauten Verlaufs werden, auch nicht als abgelehnter Versuch.
    return cannedMessageResponse(REFUSAL_TEXT, cookie);
  }

  // Pro Anfrage neue Kennung für die Datenmarkierung — nicht vorhersagbar,
  // also nicht durch Nutzertext nachahmbar.
  const nonce = randomUUID();
  const newContent = truncate(userText, guard.maxUserChars);

  // Ältere Sitzungs-Turns waren, als sie angehängt wurden, jeweils selbst die
  // „neue" Nachricht und haben dieselbe Prüfung schon durchlaufen — sie
  // müssen beim Wiederverwenden nicht erneut gescreent werden.
  const includedPrior: SessionTurn[] = [];
  let budget = guard.maxTotalChars - newContent.length;
  for (let index = session.turns.length - 1; index >= 0; index -= 1) {
    const turn = session.turns[index];
    if (turn.text.length > budget) break;
    budget -= turn.text.length;
    includedPrior.unshift(turn);
  }

  const modelMessages: ModelMessage[] = [
    ...includedPrior.map(
      (turn): ModelMessage =>
        turn.role === "user"
          ? { role: "user", content: spotlight(turn.text, nonce) }
          : { role: "assistant", content: turn.text },
    ),
    { role: "user", content: spotlight(newContent, nonce) },
  ];

  appendSessionTurn(
    session.id,
    { role: "user", text: newContent },
    guard.maxHistoryMessages,
  );

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
    // Vervollständigt die Sitzung um die Antwort — erst hier liegt der volle
    // Text vor (`messageMetadata` unten bekommt beim „finish"-Event nur die
    // Usage, keinen Text). Feuert nicht bei einem Fehler/Abbruch, dann bleibt
    // die Sitzung einfach bei der neuen Frage stehen.
    onFinish: ({ text }) => {
      if (text.length > 0) {
        appendSessionTurn(
          session.id,
          { role: "assistant", text },
          guard.maxHistoryMessages,
        );
      }
    },
  });

  return result.toUIMessageStreamResponse<ChatMessage>({
    headers: cookie,
    // Token-Usage und Kosten für die Anzeige im Footer an den Client
    // durchreichen. Wird bei `start` und `finish` aufgerufen — Usage gibt es
    // nur bei `finish`.
    messageMetadata: ({ part }) => {
      if (part.type !== "finish") return undefined;

      const inputTokens = part.totalUsage.inputTokens ?? 0;
      const outputTokens = part.totalUsage.outputTokens ?? 0;
      // Verbrauch aufs Tagesbudget buchen — hier liegt die einzige Stelle, an
      // der die echten Zahlen des Providers vorliegen.
      recordTokens(inputTokens, outputTokens);

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
