"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";

export default function Chat() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    error,
    stop,
  } = useChat({ api: "/api/chat" });

  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit();
      }
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
              <p className="whitespace-pre-wrap">{m.content}</p>
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
        onSubmit={handleSubmit}
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
          onChange={handleInputChange}
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
    </section>
  );
}
