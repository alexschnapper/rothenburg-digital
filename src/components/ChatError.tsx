"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ReportLink from "@/components/ReportLink";
import { httpStatus } from "@/lib/httpStatus";

export type ChatFailure = {
  /** HTTP-Status der Antwort, `null` ohne Antwort (Netzwerk weg) */
  status: number | null;
  /** Zeitpunkt (ms) aus `Retry-After`, ab dem ein neuer Versuch sinnvoll ist */
  retryAt: number | null;
};

/**
 * Fehler im Chat verständlich anzeigen (Issue #54) — statt nur
 * „Fehler: <Text>". Der Text vom Server (`textError()` in
 * `src/lib/guard/respond.ts`) ist schon deutsch und bleibt; dazu kommen Code,
 * Bezeichnung, bei 429 die Wartezeit und ab 500 der Link „Fehler melden".
 */
export default function ChatError({
  message,
  failure,
  onRetry,
}: {
  message: string;
  failure: ChatFailure | null;
  onRetry: () => void;
}) {
  const code = failure?.status ?? null;
  const retryAt = failure?.retryAt ?? null;
  const [now, setNow] = useState(() => Date.now());

  // Sekündlich weiterzählen, solange eine Wartezeit läuft.
  useEffect(() => {
    if (retryAt === null) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  const wait = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));

  const info = code ? httpStatus(code) : null;
  // Bei 503 kann es das Tagesbudget sein — dann erklärt /kosten, warum.
  const budget = code === 503 && /budget/i.test(message);
  const minutes = Math.ceil(wait / 60);

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-red-700/40 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-300/40 dark:bg-red-950/40 dark:text-red-100"
    >
      <p className="font-bold">
        {info ? `${info.code} · ${info.name}` : "Keine Verbindung"}
      </p>
      <p>
        {info
          ? message
          : "Der Chat ist gerade nicht erreichbar. Bitte Internetverbindung prüfen und erneut versuchen."}
      </p>
      {budget && (
        <p>
          Warum es ein Tagesbudget gibt:{" "}
          <Link href="/kosten" className="underline">
            Kosten des Chats
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={wait > 0}
          className="rounded-md border border-current px-3 py-1 font-medium disabled:opacity-50"
        >
          {wait > 0
            ? `Erneut senden in ${wait > 90 ? `${minutes} Min.` : `${wait} s`}`
            : "Erneut senden"}
        </button>
        {code !== null && code >= 500 && !budget && (
          <ReportLink code={code} message={message} />
        )}
      </div>
    </div>
  );
}
