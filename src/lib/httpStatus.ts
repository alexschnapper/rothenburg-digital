/**
 * HTTP-Statuscodes, die Besucher von rothenburg.digital zu sehen bekommen
 * können, mit deutscher Bezeichnung und einer Erklärung in einfacher Sprache
 * (Issue #54).
 *
 * Bezeichnungen nach https://de.wikipedia.org/wiki/HTTP-Statuscode. Bewusst
 * nur die Codes, die hier tatsächlich vorkommen — Seiten (404, 500), der Chat
 * (`/api/chat`: 400, 403, 413, 429, 503) und der Server davor (401 durch die
 * Basic-Auth auf dev/staging, 502/504 wenn die App nicht antwortet).
 */

export type HttpStatusInfo = {
  code: number;
  /** Offizielle deutsche Bezeichnung */
  name: string;
  /** Was das für Besucher heißt, ohne Fachbegriffe */
  explanation: string;
};

const STATUS: Record<number, Omit<HttpStatusInfo, "code">> = {
  400: {
    name: "Ungültige Anfrage",
    explanation: "Die Anfrage war unvollständig oder fehlerhaft und konnte nicht verarbeitet werden.",
  },
  401: {
    name: "Nicht autorisiert",
    explanation: "Für diesen Bereich ist eine Anmeldung nötig.",
  },
  403: {
    name: "Verboten",
    explanation: "Der Zugriff auf diesen Bereich ist nicht erlaubt.",
  },
  404: {
    name: "Nicht gefunden",
    explanation: "Diese Adresse gibt es auf rothenburg.digital nicht – vielleicht ein Tippfehler oder ein veralteter Link.",
  },
  413: {
    name: "Anfrage zu groß",
    explanation: "Die Nachricht ist zu lang. Bitte kürzer fassen.",
  },
  429: {
    name: "Zu viele Anfragen",
    explanation: "In kurzer Zeit kamen zu viele Anfragen. Bitte kurz warten und dann erneut versuchen.",
  },
  500: {
    name: "Interner Serverfehler",
    explanation: "Auf unserer Seite ist etwas schiefgelaufen. Das liegt nicht an Ihnen.",
  },
  502: {
    name: "Fehlerhaftes Gateway",
    explanation: "Die Anwendung hinter der Seite antwortet gerade nicht, etwa während eines Neustarts.",
  },
  503: {
    name: "Dienst nicht verfügbar",
    explanation: "Der Dienst ist vorübergehend nicht erreichbar, zum Beispiel wegen Wartung oder weil das Tagesbudget aufgebraucht ist.",
  },
  504: {
    name: "Gateway-Zeitüberschreitung",
    explanation: "Die Anwendung hat nicht rechtzeitig geantwortet.",
  },
};

/** Angaben zu einem Code; unbekannte Codes bekommen eine allgemeine Erklärung. */
export function httpStatus(code: number): HttpStatusInfo {
  const known = STATUS[code];
  if (known) return { code, ...known };
  return {
    code,
    name: code >= 500 ? "Serverfehler" : "Fehler",
    explanation:
      code >= 500
        ? "Auf unserer Seite ist etwas schiefgelaufen."
        : "Die Anfrage konnte nicht erfüllt werden.",
  };
}

/** Alle beschriebenen Codes, aufsteigend — für eine spätere Übersicht. */
export const KNOWN_STATUS_CODES = Object.keys(STATUS).map(Number);
