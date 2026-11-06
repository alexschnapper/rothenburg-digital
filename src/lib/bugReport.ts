import { buildSha } from "@/lib/buildInfo";
import { SITE } from "@/lib/site";

/**
 * Link „Fehler melden" zu einem vorausgefüllten GitHub-Issue (Issue #54).
 *
 * Bewusst nur ein Link: Die Person meldet mit ihrem eigenen GitHub-Konto, der
 * Server schreibt nichts und braucht keinen Token. Eine Meldung ohne Konto
 * (Server legt das Issue an) gehört zu #10.
 *
 * Mitgeschickt wird nur, was die Seite ohnehin zeigt: Code, Pfad ohne
 * Query-String (dort könnten Eingaben stehen), Zeitpunkt, Build und die
 * Fehlerkennung. Kein Browser, keine Fragen aus dem Chat.
 */

const NEW_ISSUE = SITE.newIssue;

export type BugReport = {
  code: number;
  /** Pfad der Seite, z. B. `/parken` */
  path?: string;
  /** `digest` aus Next oder eine andere Kennung */
  reference?: string;
  /** Kurzer Text des Fehlers, z. B. die Meldung des Servers */
  message?: string;
  now?: Date;
};

export function bugReportUrl({ code, path: rawPath, reference, message, now = new Date() }: BugReport): string {
  // Nur der Pfad — im Query-String oder Anker könnten Eingaben stehen.
  const path = rawPath?.split(/[?#]/)[0];
  const params = new URLSearchParams({
    template: "fehlermeldung.yml",
    title: `Fehler ${code}${path ? ` auf ${path}` : ""}`,
    fehlercode: String(code),
    zeitpunkt: now.toLocaleString("de-DE", { timeZone: "Europe/Berlin" }),
    build: buildSha,
  });
  if (path) params.set("seite", path);
  if (reference) params.set("kennung", reference);
  if (message) params.set("beschreibung", `Meldung auf der Seite: „${message.slice(0, 300)}“\n\n`);
  return `${NEW_ISSUE}?${params.toString()}`;
}
