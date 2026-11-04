"use client";

import { bugReportUrl, type BugReport } from "@/lib/bugReport";

/**
 * „Fehler melden" (Issue #54). Pfad und Zeitpunkt kommen erst beim Klick dazu:
 * Die 404-Seite wird auf dem Server ohne Pfad gerendert, und so stimmt auch
 * der Zeitpunkt, wenn die Seite länger offen war.
 */
export default function ReportLink({
  code,
  reference,
  message,
  className = "underline",
}: Omit<BugReport, "path" | "now"> & { className?: string }) {
  return (
    <a
      href={bugReportUrl({ code, reference, message })}
      onClick={(event) => {
        event.currentTarget.href = bugReportUrl({
          code,
          reference,
          message,
          path: window.location.pathname,
        });
      }}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      Fehler melden
      <span className="sr-only"> (öffnet GitHub in neuem Tab)</span>
    </a>
  );
}
