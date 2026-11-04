import { berlinParts } from "@/lib/touristInfo";

/**
 * Bausteine, um aus einer Frage die passenden Einträge offener Daten
 * vorauszuwählen (Issue #44).
 *
 * Hintergrund: Ein Datensatz komplett im Prompt kostet bei 28 Restaurants rund
 * 9.500 Token pro Frage, und das Modell nennt dann mehr Treffer als erlaubt.
 * Der Server wählt deshalb vorher aus, das Modell sieht nur noch die besten
 * Kandidaten mit Details. Bewusst einfache Stichwortsuche statt Embeddings:
 * nachvollziehbar, kostenlos, ohne weiteren Dienst.
 */

/** Kleinbuchstaben, ohne Satzzeichen — Umlaute bleiben erhalten. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Wörter, die beim Abgleich mit Beschreibungen nichts aussagen. */
const STOPWORDS = new Set([
  "aber", "abend", "abends", "alle", "allem", "auch", "bitte", "dass", "denn",
  "diese", "dieser", "dort", "einen", "einem", "einer", "eines", "etwas",
  "gerade", "geöffnet", "gibt", "haben", "heute", "hier", "jetzt", "kann",
  "kannst", "können", "machen", "mittag", "mittags", "morgen", "noch", "nicht",
  "oder", "offen", "rothenburg", "schon", "sind", "tauber", "welche", "welcher",
  "welches", "wann", "warum", "werden", "wieder", "wird", "woher", "wohin",
  "möchte", "würde", "where", "which", "what", "there", "today", "tonight",
  // Gattungswörter: sagen über einen einzelnen Betrieb nichts aus.
  "restaurant", "restaurants", "essen", "trinken", "lokal", "gaststätte",
  "café", "cafés", "cafe",
]);

/** Aussagekräftige Wörter der Frage (mindestens 4 Buchstaben). */
export function keywords(question: string): string[] {
  return normalize(question)
    .split(" ")
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

/** Fragt jemand nach dem jetzigen Moment („hat jetzt noch offen")? */
const NOW_PATTERN =
  /\b(jetzt|gerade|momentan|aktuell|noch (offen|geöffnet|auf)|now|right now|currently|open now|nu)\b/i;

export function asksForNow(question: string): boolean {
  return NOW_PATTERN.test(question);
}

const WEEKDAYS: [RegExp, number][] = [
  [/\b(montag|monday|maandag)/i, 0],
  [/\b(dienstag|tuesday|dinsdag)/i, 1],
  [/\b(mittwoch|wednesday|woensdag)/i, 2],
  [/\b(donnerstag|thursday|donderdag)/i, 3],
  [/\b(freitag|friday|vrijdag)/i, 4],
  [/\b(samstag|sonnabend|saturday|zaterdag)/i, 5],
  [/\b(sonntag|sunday|zondag)/i, 6],
];

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/**
 * Nach welchem Wochentag wird gefragt (0 = Montag)? „heute" und „morgen"
 * werden in deutscher Zeit aufgelöst. `null`, wenn kein Tag genannt ist.
 */
export function askedWeekday(question: string, now: Date): number | null {
  for (const [pattern, day] of WEEKDAYS) {
    if (pattern.test(question)) return day;
  }
  const today = WEEKDAY_INDEX[berlinParts(now).weekday];
  // Kein `\b` vor „ü": JavaScript zählt Umlaute nicht als Wortzeichen.
  if (/übermorgen/i.test(question)) return (today + 2) % 7;
  if (/\b(morgen|tomorrow)\b/i.test(question)) return (today + 1) % 7;
  if (/\b(heute|today|tonight|heute abend)\b/i.test(question)) return today;
  return null;
}
