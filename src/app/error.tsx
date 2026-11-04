"use client";

import { useEffect } from "react";

import StatusView from "@/components/StatusView";
import { httpStatus } from "@/lib/httpStatus";

/**
 * Unerwarteter Fehler beim Rendern einer Seite (Issue #54). Next zeigt in
 * Produktion keine Details — nur die `digest`-Kennung, unter der der Fehler im
 * Server-Log steht. Die zeigen wir an, damit eine Meldung zuordenbar ist.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusView status={httpStatus(500)}>
      <div className="flex flex-col gap-2 text-sm">
        <button
          type="button"
          onClick={() => retry()}
          className="w-fit rounded-md border border-[color:var(--color-border)] px-4 py-2 font-medium hover:border-brand"
        >
          Erneut versuchen
        </button>
        {error.digest && (
          <p className="opacity-70">
            Fehlerkennung für Rückfragen: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </StatusView>
  );
}
