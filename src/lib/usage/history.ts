import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

/**
 * Verbrauchsverlauf für die Kostenseite (Issue #48).
 *
 * Die Zähler in `guard/ratelimit.ts` leben nur im Speicher und beginnen bei
 * jedem Neustart und jeden Tag bei null — für Wochen- und Monatswerte fehlt
 * damit die Historie. Mistral bietet per API-Key keine Verbrauchsabfrage an
 * (`/v1/billing/usage` gibt 404, geprüft am 04.11.2026), die Werte müssen also
 * hier mitgeschrieben werden.
 *
 * Gespeichert werden nur Tagessummen: Anfragen, Token, geschätzte Kosten. Nichts
 * davon lässt sich einer Person zuordnen.
 *
 * Bewusst eine JSON-Datei statt einer Datenbank: ein Passenger-Prozess pro
 * Umgebung, wenige hundert Zeilen pro Jahr. Der Pfad kommt aus
 * `USAGE_HISTORY_FILE`; auf dem Server je Umgebung außerhalb des Document Root
 * (siehe `docs/DEPLOYMENT.md`, „Kostenseite").
 */

export type DayUsage = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  /** Geschätzte Kosten in Euro, zum Listenpreis am Tag der Anfrage. */
  costEur: number;
};

type HistoryFile = { version: 1; days: Record<string, DayUsage> };

const FLUSH_DELAY_MS = 5000;

const historyPath = () =>
  process.env.USAGE_HISTORY_FILE?.trim() ||
  join(process.cwd(), ".data", "usage-history.json");

let days: Record<string, DayUsage> | null = null;
/** Änderungszeit der Datei beim letzten Lesen oder Schreiben, `null` = keine Datei. */
let loadedMtime: number | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pathLogged = false;

function fileMtime(): number | null {
  try {
    return statSync(/*turbopackIgnore: true*/ historyPath()).mtimeMs;
  } catch {
    return null;
  }
}

/** Kalendertag in deutscher Zeit, z. B. `2026-11-04`. */
export const berlinDay = (date: Date): string =>
  date.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

/**
 * Stand aus der Datei, neu gelesen, sobald sie sich geändert hat.
 *
 * Next lädt dieses Modul im Produktionsbuild mehrfach: Chat-Route und
 * Kostenseite haben je eine eigene Instanz mit eigenem Speicher. Nur die Route
 * schreibt; die Seite sieht ihre Zahlen nur über die Datei. Ohne den Vergleich
 * der Änderungszeit bliebe die Seite beim Stand ihres ersten Aufrufs stehen.
 * Ungespeicherte eigene Änderungen (Timer läuft) haben Vorrang.
 */
function load(): Record<string, DayUsage> {
  const mtime = fileMtime();
  if (days && (flushTimer || mtime === loadedMtime)) return days;
  if (!pathLogged) {
    // Zeigt im Server-Log, ob USAGE_HISTORY_FILE angekommen ist.
    console.info(`[usage] Verlauf: ${historyPath()}`);
    pathLogged = true;
  }
  loadedMtime = mtime;
  try {
    // Laufzeitpfad, kein Build-Inhalt — ohne den Kommentar zieht Turbopacks
    // Dateiverfolgung das ganze Projekt in die Server-Ausgabe.
    const parsed = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ historyPath(), "utf8"),
    ) as HistoryFile;
    days = parsed.version === 1 && parsed.days ? parsed.days : {};
  } catch (error) {
    // Fehlende Datei ist der Normalfall beim ersten Start.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[usage] Verlauf nicht lesbar, beginne leer:", error);
    }
    days = {};
  }
  return days;
}

/** Schreibt über eine temporäre Datei, damit ein Absturz nichts halb hinterlässt. */
function flush(): void {
  flushTimer = null;
  if (!days) return;
  const path = historyPath();
  try {
    mkdirSync(/*turbopackIgnore: true*/ dirname(path), { recursive: true });
    const file: HistoryFile = { version: 1, days };
    writeFileSync(/*turbopackIgnore: true*/ `${path}.tmp`, JSON.stringify(file, null, 1));
    renameSync(/*turbopackIgnore: true*/ `${path}.tmp`, path);
    loadedMtime = fileMtime();
  } catch (error) {
    console.error("[usage] Verlauf nicht speicherbar:", error);
  }
}

/** Eine beantwortete Chat-Anfrage verbuchen. */
export function recordUsage(
  usage: { inputTokens: number; outputTokens: number; costEur?: number },
  now = new Date(),
): void {
  const all = load();
  const key = berlinDay(now);
  const day = (all[key] ??= { requests: 0, inputTokens: 0, outputTokens: 0, costEur: 0 });
  day.requests += 1;
  day.inputTokens += Math.max(0, usage.inputTokens);
  day.outputTokens += Math.max(0, usage.outputTokens);
  day.costEur += Math.max(0, usage.costEur ?? 0);

  // Gebündelt schreiben statt bei jeder Anfrage; `unref`, damit der Timer
  // den Prozess nicht am Beenden hindert.
  if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
    flushTimer.unref?.();
  }
}

export type UsageTotals = DayUsage & { tokens: number };

const sum = (entries: DayUsage[]): UsageTotals => {
  const total = entries.reduce(
    (acc, day) => ({
      requests: acc.requests + day.requests,
      inputTokens: acc.inputTokens + day.inputTokens,
      outputTokens: acc.outputTokens + day.outputTokens,
      costEur: acc.costEur + day.costEur,
    }),
    { requests: 0, inputTokens: 0, outputTokens: 0, costEur: 0 },
  );
  return { ...total, tokens: total.inputTokens + total.outputTokens };
};

const shiftDays = (date: Date, offset: number) =>
  new Date(date.getTime() + offset * 86_400_000);

export type UsageSummary = {
  today: UsageTotals;
  last7Days: UsageTotals;
  thisMonth: UsageTotals;
  total: UsageTotals;
  /** Erster Tag mit Daten, `null` wenn noch keine. */
  since: string | null;
  /** Die letzten 30 Tage, ältester zuerst, auch Tage ohne Nutzung. */
  daily: (UsageTotals & { day: string })[];
  /** Alle Monate mit Daten, neuester zuerst, z. B. `2026-11`. */
  monthly: (UsageTotals & { month: string })[];
};

export function usageSummary(now = new Date()): UsageSummary {
  const all = load();
  const entries = Object.entries(all).sort(([a], [b]) => a.localeCompare(b));
  const today = berlinDay(now);
  const weekStart = berlinDay(shiftDays(now, -6));
  const month = today.slice(0, 7);

  const daily = Array.from({ length: 30 }, (_, index) => {
    const day = berlinDay(shiftDays(now, index - 29));
    return { day, ...sum(all[day] ? [all[day]] : []) };
  });

  const months = new Map<string, DayUsage[]>();
  for (const [day, usage] of entries) {
    const key = day.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), usage]);
  }

  return {
    today: sum(all[today] ? [all[today]] : []),
    last7Days: sum(entries.filter(([day]) => day >= weekStart && day <= today).map(([, u]) => u)),
    thisMonth: sum(entries.filter(([day]) => day.startsWith(month)).map(([, u]) => u)),
    total: sum(entries.map(([, usage]) => usage)),
    since: entries[0]?.[0] ?? null,
    daily,
    monthly: [...months]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, usages]) => ({ month: key, ...sum(usages) })),
  };
}

/** Nur für Tests: Zustand verwerfen, ohne zu schreiben. */
export function resetUsageHistory(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  days = null;
  loadedMtime = null;
}

/** Nur für Tests: sofort schreiben. */
export function flushUsageHistory(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flush();
}
