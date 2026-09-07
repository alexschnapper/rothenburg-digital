"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

import {
  usageMetadataSchema,
  type ChatMessage,
  type UsageMetadata,
} from "@/lib/chat";

// Keine Preisliste im Client: welcher Provider und welches Modell laufen,
// entscheidet die Umgebung (Issue #12). Der Server schickt Modellname, Kosten
// und Preisbasis in den Message-Metadaten mit — hier wird nur angezeigt.
// Eine eingebaute Preistabelle wäre nach dem ersten Providerwechsel falsch.

/** Sichtbarer Text einer Nachricht — ab AI SDK v5 stehen Inhalte in `parts`. */
function messageText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

const nfEur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});
const nfInt = new Intl.NumberFormat("de-DE");
/** Preise pro 1 Mio. Token — je nach Modell 0,15 oder 15, daher variable Stellen. */
const nfPrice = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const nfRate = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function Chat() {
  const [input, setInput] = useState("");
  const [lastUsage, setLastUsage] = useState<UsageMetadata | null>(null);
  const [totals, setTotals] = useState({
    inputTokens: 0,
    outputTokens: 0,
    requests: 0,
    /** Summe der gemeldeten Kosten; `null`, solange keine vorlagen. */
    costEur: null as number | null,
  });

  const { messages, sendMessage, status, error, stop } = useChat<ChatMessage>({
    messageMetadataSchema: usageMetadataSchema,
    onFinish: ({ message }) => {
      const usage = message.metadata;
      if (!usage) return;
      setLastUsage(usage);
      setTotals((t) => ({
        inputTokens: t.inputTokens + usage.inputTokens,
        outputTokens: t.outputTokens + usage.outputTokens,
        requests: t.requests + 1,
        // Kosten aufsummieren statt aus Token neu zu rechnen: so bleibt die
        // Summe richtig, auch wenn sich Modell oder Preis während der Sitzung
        // ändern.
        costEur:
          usage.costEur === undefined
            ? t.costEur
            : (t.costEur ?? 0) + usage.costEur,
      }));
    },
  });

  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section
      aria-labelledby="chat-heading"
      className="flex flex-col gap-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4"
    >
      <h2 id="chat-heading" className="sr-only">
        Chat mit dem digitalen Assistenten
      </h2>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Chat-Verlauf"
        className="flex max-h-[60vh] min-h-[240px] flex-col gap-3 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <p className="opacity-70">
            Stellen Sie eine Frage, um das Gespräch zu beginnen.
          </p>
        ) : (
          messages.map((m) => (
            <article
              key={m.id}
              aria-label={
                m.role === "user" ? "Ihre Nachricht" : "Antwort des Assistenten"
              }
              className={
                m.role === "user"
                  ? "self-end rounded-lg bg-brand px-3 py-2 text-brand-fg max-w-[85%]"
                  : "self-start rounded-lg bg-[color:var(--color-bg)] px-3 py-2 border border-[color:var(--color-border)] max-w-[85%]"
              }
            >
              <span className="sr-only">
                {m.role === "user" ? "Sie: " : "Assistent: "}
              </span>
              <p className="whitespace-pre-wrap">{messageText(m)}</p>
            </article>
          ))
        )}
        {isLoading && (
          <p role="status" className="text-sm opacity-70">
            Antwort wird geschrieben…
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            Fehler: {error.message}
          </p>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2"
        aria-label="Nachricht senden"
      >
        <label htmlFor="chat-input" className="sr-only">
          Ihre Nachricht
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ihre Frage… (Eingabetaste = senden, Umschalt+Eingabe = neue Zeile)"
          rows={3}
          disabled={isLoading}
          className="w-full resize-y rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-md bg-brand px-4 py-2 font-semibold text-brand-fg disabled:opacity-50"
          >
            Senden
          </button>
          {isLoading && (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border border-[color:var(--color-border)] px-4 py-2"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>

      <footer
        aria-live="polite"
        className="flex flex-col gap-1 border-t border-[color:var(--color-border)] pt-3 text-xs opacity-70"
      >
        {lastUsage ? (
          <p>
            Letzte Anfrage: {nfInt.format(lastUsage.inputTokens)} Eingabe- +{" "}
            {nfInt.format(lastUsage.outputTokens)} Ausgabe-Token
            {lastUsage.costEur !== undefined
              ? ` ≈ ${nfEur.format(lastUsage.costEur)}`
              : ""}
          </p>
        ) : (
          <p>Noch keine Anfrage gesendet.</p>
        )}
        {totals.requests > 0 && (
          <p>
            Sitzung gesamt ({nfInt.format(totals.requests)}{" "}
            {totals.requests === 1 ? "Anfrage" : "Anfragen"}):{" "}
            {nfInt.format(totals.inputTokens + totals.outputTokens)} Token
            {totals.costEur !== null
              ? ` ≈ ${nfEur.format(totals.costEur)}`
              : ""}
          </p>
        )}
        {/* Fußnote erklärt sich aus den Metadaten der letzten Antwort — kein
            fest eingetragenes Modell, kein fest eingetragener Preis. */}
        {lastUsage?.model && (
          <p className="opacity-60">
            {lastUsage.price
              ? `Schätzung auf Basis der Listenpreise für ${lastUsage.model} (${nfPrice.format(lastUsage.price.inputUsdPerMTok)} $/${nfPrice.format(lastUsage.price.outputUsdPerMTok)} $ pro 1 Mio. Token); Kurs 1 $ ≈ ${nfRate.format(lastUsage.price.usdToEur)} €.`
              : `Modell ${lastUsage.model}: kein Preis hinterlegt, deshalb keine Kostenschätzung.`}
          </p>
        )}
      </footer>
    </section>
  );
}
