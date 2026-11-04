import { berlinParts, clock, isHoliday } from "@/lib/touristInfo";

/**
 * Öffnungszeiten aus den SKG-Daten der Stadt lesen und auswerten (Issue #27).
 *
 * Dieselbe Lehre wie bei der Tourist-Information (#34): Das Modell vergleicht
 * Uhrzeit und Öffnungszeiten nicht verlässlich. Der Server rechnet deshalb
 * aus, ob gerade geöffnet ist, und der Prompt nennt nur das Ergebnis.
 *
 * Format der Daten, z. B.:
 * - `Mo, Di, Do, Fr, Sa, So 11:30-22:30`
 * - `So 11:00-17:00; Mo, Di, Do 11:00-21:30` (mehrere Blöcke)
 * - `Sa 16:00-02:00` (über Mitternacht)
 * - `Sa, So ab 11:30` (ohne Schlusszeit)
 *
 * Passt ein Block nicht in dieses Muster, gilt der ganze Eintrag als
 * unlesbar (`null`) — lieber kein Status als ein falscher.
 */

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** Wochentag aus `berlinParts` (englisch, kurz) → Index ab Montag. */
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export type Interval = {
  /** 0 = Montag … 6 = Sonntag */
  day: number;
  /** Minuten seit Mitternacht */
  from: number;
  /** `null` bei „ab 11:30"; kleiner als `from` heißt: über Mitternacht. */
  to: number | null;
};

const DAY = "(?:Mo|Di|Mi|Do|Fr|Sa|So)";
const TIME = "(\\d{1,2}):(\\d{2})";
const BLOCK = new RegExp(
  `^(${DAY}(?:\\s*[,–-]\\s*${DAY})*)\\s+(?:${TIME}\\s*[-–]\\s*${TIME}|ab\\s+${TIME})(?:\\s*Uhr)?$`,
);

function dayIndices(spec: string): number[] | null {
  const days = new Set<number>();
  for (const part of spec.split(/\s*,\s*/)) {
    const [start, end] = part.split(/\s*[–-]\s*/);
    const a = DAYS.indexOf(start as (typeof DAYS)[number]);
    const b = end ? DAYS.indexOf(end as (typeof DAYS)[number]) : a;
    if (a < 0 || b < 0 || b < a) return null;
    for (let day = a; day <= b; day += 1) days.add(day);
  }
  return [...days];
}

const minutes = (h: string, m: string) => {
  const value = Number(h) * 60 + Number(m);
  return Number(h) <= 24 && Number(m) < 60 ? value % 1440 : NaN;
};

/** Öffnungszeiten-Text → Liste von Zeitfenstern, `null` wenn nicht lesbar. */
export function parseOpeningHours(raw: string): Interval[] | null {
  const blocks = raw
    .split(";")
    .map((block) => block.trim())
    .filter(Boolean);
  if (blocks.length === 0) return null;

  const intervals: Interval[] = [];
  for (const block of blocks) {
    const match = block.match(BLOCK);
    if (!match) return null;
    const days = dayIndices(match[1]);
    if (!days) return null;
    const from = match[2] ? minutes(match[2], match[3]) : minutes(match[6], match[7]);
    const to = match[4] ? minutes(match[4], match[5]) : null;
    if (Number.isNaN(from) || (to !== null && Number.isNaN(to))) return null;
    for (const day of days) intervals.push({ day, from, to });
  }
  return intervals.sort((a, b) => a.day - b.day || a.from - b.from);
}

export type OpenStatus =
  | { state: "open"; until: number | null }
  | { state: "opens-later"; at: number }
  | { state: "closed-today" }
  /** Feiertag: die Daten sagen nichts über Feiertage. */
  | { state: "holiday" };

const overnight = (interval: Interval) =>
  interval.to !== null && interval.to <= interval.from;

/** Ist jetzt geöffnet? Rechnet in deutscher Zeit. */
export function openStatus(intervals: Interval[], now: Date): OpenStatus {
  const { year, month, day, weekday, minutes: nowMinutes } = berlinParts(now);
  if (isHoliday(year, month, day)) return { state: "holiday" };

  const today = WEEKDAY_INDEX[weekday];
  const yesterday = (today + 6) % 7;

  // Von gestern über Mitternacht in den heutigen Tag hinein.
  for (const interval of intervals) {
    if (interval.day === yesterday && overnight(interval) && nowMinutes < interval.to!) {
      return { state: "open", until: interval.to };
    }
  }

  const todays = intervals.filter((interval) => interval.day === today);
  for (const interval of todays) {
    if (nowMinutes < interval.from) continue;
    if (interval.to === null || overnight(interval) || nowMinutes < interval.to) {
      return { state: "open", until: interval.to };
    }
  }

  const later = todays.find((interval) => interval.from > nowMinutes);
  if (later) return { state: "opens-later", at: later.from };
  return { state: "closed-today" };
}

/** Hat der Betrieb an diesem Wochentag (0 = Montag) überhaupt geöffnet? */
export function opensOnDay(intervals: Interval[], day: number): boolean {
  return intervals.some((interval) => interval.day === day);
}

/** Kurzer Satz für Prompt und Seite. */
export function statusText(status: OpenStatus): string {
  switch (status.state) {
    case "open":
      return status.until === null
        ? "jetzt geöffnet (Schlusszeit nicht angegeben)"
        : `jetzt geöffnet bis ${clock(status.until)} Uhr`;
    case "opens-later":
      return `jetzt geschlossen, öffnet heute um ${clock(status.at)} Uhr`;
    case "closed-today":
      return "heute geschlossen";
    case "holiday":
      return "heute Feiertag – Öffnungszeiten können abweichen";
  }
}

/** `[0,1,2,3,4]` → „Mo–Fr", `[0,2,6]` → „Mo, Mi, So", alle → „täglich". */
function dayLabel(days: number[]): string {
  if (days.length === 7) return "täglich";
  const runs: number[][] = [];
  for (const day of days) {
    const run = runs.at(-1);
    if (run && run.at(-1) === day - 1) run.push(day);
    else runs.push([day]);
  }
  return runs
    .flatMap((run) =>
      run.length >= 3
        ? [`${DAYS[run[0]]}–${DAYS[run.at(-1)!]}`]
        : run.map((day) => DAYS[day]),
    )
    .join(", ");
}

/**
 * Lesbare Zeilen, z. B. „Mo–Fr 11:30–14:30 und 17:00–21:00 Uhr". Tage mit
 * gleichen Zeiten werden zusammengefasst.
 */
export function formatOpeningHours(intervals: Interval[]): string[] {
  const byDay = new Map<number, string>();
  for (let day = 0; day < 7; day += 1) {
    const times = intervals
      .filter((interval) => interval.day === day)
      .map((interval) =>
        interval.to === null
          ? `ab ${clock(interval.from)}`
          : `${clock(interval.from)}–${clock(interval.to)}`,
      );
    if (times.length > 0) byDay.set(day, `${times.join(" und ")} Uhr`);
  }

  const groups = new Map<string, number[]>();
  for (const [day, times] of byDay) {
    groups.set(times, [...(groups.get(times) ?? []), day]);
  }
  const lines = [...groups].map(([times, days]) => ({
    first: days[0],
    line: `${dayLabel(days)} ${times}`,
  }));
  const closed = DAYS.map((_, day) => day).filter((day) => !byDay.has(day));
  if (closed.length > 0) {
    lines.push({ first: closed[0], line: `${dayLabel(closed)} geschlossen` });
  }
  return lines.sort((a, b) => a.first - b.first).map((entry) => entry.line);
}
