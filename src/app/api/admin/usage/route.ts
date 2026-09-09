import { timingSafeEqual } from "node:crypto";

import { usageSnapshot } from "@/lib/guard/ratelimit";
import { textError } from "@/lib/guard/respond";
import { costEur } from "@/lib/llm/pricing";
import { LlmConfigError, llmConfig } from "@/lib/llm/provider";

export const runtime = "nodejs";

/**
 * Interner Monitoring-Endpoint (Issue #17) — beantwortet „läuft die Abwehr
 * wie erwartet?", ohne im Log wühlen zu müssen.
 *
 * Bewusst kein Dashboard, keine eigene Oberfläche: `scripts/daily-summary.mjs`
 * liest diesen Endpoint einmal täglich per Cron und gibt eine lesbare
 * Zusammenfassung auf stdout aus — mit `MAILTO=` in der Crontab landet die
 * automatisch im Postfach, alternativ per `>> logfile` in eine Datei
 * umleiten. Kein eigener Mail-Versand im Code, keine SMTP-Zugangsdaten nötig.
 *
 * Schutz per geteiltem Geheimnis (`ADMIN_TOKEN`), nicht per Basic-Auth wie
 * dev/staging: die läuft auf Nginx-Ebene vor der App und deckt Prod nicht ab,
 * wo dieser Endpoint aber genauso wenig öffentlich sein soll. Ohne gesetztes
 * `ADMIN_TOKEN` ist der Endpoint komplett abgeschaltet (503) — kein
 * Umgebungsvariable-Vergessen, das ihn versehentlich offen ließe.
 */
function isAuthorized(req: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;

  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  // Längenvergleich zuerst: `timingSafeEqual` verlangt gleiche Länge und
  // würde bei unterschiedlicher Länge selbst werfen statt `false` liefern.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(req: Request) {
  if (!process.env.ADMIN_TOKEN) {
    return textError(
      "Monitoring-Endpoint ist nicht konfiguriert (ADMIN_TOKEN fehlt).",
      503,
    );
  }

  if (!isAuthorized(req)) {
    return textError("Nicht autorisiert.", 401);
  }

  const snapshot = usageSnapshot();

  // Kostenschätzung ergänzen, wenn ein Preis fürs aktive Modell hinterlegt
  // ist — dieselbe Rechnung wie in der Chat-Antwort, hier über den
  // Tagesverbrauch statt eine einzelne Anfrage.
  let costEurToday: number | undefined;
  try {
    const llm = llmConfig();
    costEurToday = costEur(
      {
        inputTokens: snapshot.inputTokensToday,
        outputTokens: snapshot.outputTokensToday,
      },
      llm.price,
    );
  } catch (error) {
    if (!(error instanceof LlmConfigError)) throw error;
    // Fehlkonfigurierter Provider soll die Zusammenfassung nicht sprengen —
    // sie zeigt dann eben keine Kostenschätzung.
  }

  return Response.json({ ...snapshot, costEurToday });
}
