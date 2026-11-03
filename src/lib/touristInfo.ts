/**
 * Ist die Tourist-Information gerade geöffnet? (Issue #34)
 *
 * Das Modell bekommt zwar Datum und Uhrzeit, vergleicht sie aber nicht
 * verlässlich mit den Öffnungszeiten — es hat um 17:50 Uhr noch „geöffnet bis
 * 17:00 Uhr" geantwortet. Deshalb rechnet der Server den Status aus und der
 * Prompt nennt nur noch das Ergebnis.
 *
 * Grundlage sind dieselben Zeiten wie im System-Prompt (`prompt.ts`, Quelle
 * https://www.rothenburg.de/kontakt). Wo die Regel nicht eindeutig ist, kommt
 * `null` zurück und der Prompt fällt auf die allgemeine Beschreibung zurück —
 * lieber kein Status als ein falscher:
 * - Wochenenden und Feiertage im Dezember eines Jahres ohne hinterlegte
 *   Reiterlesmarkt-Termine (`CHRISTMAS_MARKET`).
 * - Totensonntag während des Markts: der Markt ist zu, ob die
 *   Tourist-Information öffnet, sagt die Quelle nicht.
 * - 24. bis 31. Dezember: die Quelle nennt für die Zeit nach dem
 *   Weihnachtsmarkt bis Neujahr gar keine Öffnungszeiten.
 */

/**
 * Reiterlesmarkt (Weihnachtsmarkt) je Jahr — währenddessen gelten am
 * Wochenende und an Feiertagen 10–17 Uhr. Quelle:
 * https://www.rothenburg-tourismus.de/detail/id=63bed9886be70d540ec551f5
 * Jedes Jahr neu eintragen; fehlt ein Jahr, gibt es im Dezember am
 * Wochenende keinen Status.
 */
const CHRISTMAS_MARKET: Record<
  number,
  { from: [number, number]; to: [number, number]; closed: [number, number][] }
> = {
  2026: { from: [11, 20], to: [12, 23], closed: [[11, 22]] },
};

export type OpeningToday =
  | { open: true; from: number; to: number }
  | { open: false };

/** Minuten seit Mitternacht. */
const hm = (h: number, m = 0) => h * 60 + m;

/** Ostersonntag nach der anonymen gregorianischen Osterformel. */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Tage seit 1.1.1970 (UTC) — nur zum Vergleichen von Kalendertagen. */
const dayNumber = (year: number, month: number, day: number) =>
  Math.round(Date.UTC(year, month - 1, day) / 86_400_000);

/**
 * Gesetzliche Feiertage in Bayern, die in Rothenburg gelten. Mariä
 * Himmelfahrt (15.8.) ist nur in Gemeinden mit überwiegend katholischer
 * Bevölkerung Feiertag — Rothenburg ist überwiegend evangelisch, der Tag
 * fehlt deshalb bewusst. Buß- und Bettag ist in Bayern kein Feiertag.
 */
function isHoliday(year: number, month: number, day: number): boolean {
  const fixed = ["1-1", "1-6", "5-1", "10-3", "11-1", "12-25", "12-26"];
  if (fixed.includes(`${month}-${day}`)) return true;

  const easter = easterSunday(year);
  const offset =
    dayNumber(year, month, day) - dayNumber(year, easter.month, easter.day);
  // Karfreitag, Ostermontag, Christi Himmelfahrt, Pfingstmontag, Fronleichnam
  return [-2, 1, 39, 50, 60].includes(offset);
}

/** Datum und Uhrzeit in deutscher Zeit, unabhängig von der Server-Zeitzone. */
function berlinParts(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday as string,
    minutes: hm(Number(parts.hour), Number(parts.minute)),
  };
}

/** Öffnungszeit für den heutigen Tag, `null` wenn unklar. */
export function openingToday(now: Date): OpeningToday | null {
  const { year, month, day, weekday } = berlinParts(now);
  const holiday = isHoliday(year, month, day);
  const weekend = weekday === "Sat" || weekday === "Sun";

  const easter = easterSunday(year);
  const fromEaster =
    dayNumber(year, month, day) - dayNumber(year, easter.month, easter.day);
  // Karfreitag bis Ostermontag gilt immer 10–15 Uhr (Ausnahmeregel).
  if (fromEaster >= -2 && fromEaster <= 1) {
    return { open: true, from: hm(10), to: hm(15) };
  }

  if (month === 12 && day >= 24) return null; // von der Quelle nicht abgedeckt
  if (!weekend && !holiday) return { open: true, from: hm(9), to: hm(17) };

  // Ab hier: Wochenende oder Feiertag, je nach Saison.
  const market = CHRISTMAS_MARKET[year];
  if (market) {
    const today = dayNumber(year, month, day);
    const during =
      today >= dayNumber(year, ...market.from) &&
      today <= dayNumber(year, ...market.to);
    if (market.closed.some(([m, d]) => m === month && d === day)) return null;
    if (during) return { open: true, from: hm(10), to: hm(17) };
  }
  if (month === 12) return null; // Reiterlesmarkt-Termine nicht hinterlegt
  if (month === 4) return { open: true, from: hm(10), to: hm(15) };
  if (month >= 5 && (month < 9 || (month === 9 && day <= 6))) {
    return { open: true, from: hm(10), to: hm(17) };
  }
  if (month >= 9 && month <= 10) return { open: true, from: hm(10), to: hm(15) };

  // November sowie Januar bis März
  if (weekday === "Sat" && !holiday) {
    return { open: true, from: hm(10), to: hm(13) };
  }
  return { open: false };
}

const clock = (minutes: number) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Fertiger Satz für den System-Prompt, oder `null`, wenn der Status für heute
 * nicht sicher bestimmbar ist.
 */
export function touristInfoStatus(now: Date): string | null {
  const today = openingToday(now);
  if (!today) return null;
  if (!today.open) return "Heute ist die Tourist-Information geschlossen.";

  const { minutes } = berlinParts(now);
  const hours = `heute ${clock(today.from)}–${clock(today.to)} Uhr`;
  if (minutes < today.from) {
    return `Öffnungszeit ${hours}. Gerade ist noch geschlossen, sie öffnet heute um ${clock(today.from)} Uhr.`;
  }
  if (minutes < today.to) {
    return `Öffnungszeit ${hours}. Gerade ist geöffnet.`;
  }
  return `Öffnungszeit ${hours}. Für heute ist bereits geschlossen.`;
}
