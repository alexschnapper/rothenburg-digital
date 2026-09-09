import { randomUUID } from "node:crypto";

/**
 * Serverseitige Chat-Sitzung (Issue #14).
 *
 * Löst „Bekannte Lücke 1": bisher glaubte der Server dem Verlauf, den der
 * Client mitschickte — auch die `assistant`-Turns darin waren frei erfunden
 * (Prefill-Angriff: „Du hast mir schon zugesagt, dass …"). Jetzt hält der
 * Server den Verlauf selbst; der Client bekommt nur eine Sitzungs-ID als
 * `httpOnly`-Cookie und schickt sie mit. Ein per Request erfundener
 * `assistant`-Turn hat dadurch keine Wirkung mehr — er fließt nie in den
 * Kontext ein, den das Modell sieht (siehe `src/app/api/chat/route.ts`, das
 * für den Modellkontext ausschließlich `session.turns` liest, nie den
 * Client-Verlauf).
 *
 * Bewusst **in-process** wie schon die Zähler in `ratelimit.ts` (siehe
 * „Bekannte Lücke 2" in `docs/SICHERHEIT-PROMPTS.md`): kein Redis/SQLite
 * nötig, ein Neustart setzt Sitzungen zurück — für einen Chat mit kurzer
 * Lebensdauer und einen Passenger-Prozess pro Umgebung reicht das. Der
 * saubere nächste Schritt ist ein gemeinsamer Speicher, sobald es den ohnehin
 * für die Zähler braucht (#20).
 */

export const SESSION_COOKIE = "chat_session";

/** Wie lange eine Sitzung ohne neue Anfrage gültig bleibt. */
const TTL_MS = 2 * 60 * 60 * 1000; // 2 Stunden

export type SessionTurn = { role: "user" | "assistant"; text: string };

type Session = { turns: SessionTurn[]; expiresAt: number };

const sessions = new Map<string, Session>();

/** Verhindert unbegrenztes Wachstum der Map bei vielen Besucher:innen. */
function prune(now: number): void {
  if (sessions.size <= 2000) return;

  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

/**
 * Verlauf der aktuellen Sitzung, samt (ggf. neuer) ID.
 *
 * Fehlt das Cookie, ist die ID unbekannt oder die Sitzung abgelaufen, beginnt
 * eine leere Sitzung mit frischer ID — nie ein Fehler. Ein verlorener Verlauf
 * ist kein Sicherheitsproblem, nur ein vergessenes Gespräch.
 */
export function loadSession(req: Request): { id: string; turns: SessionTurn[] } {
  const now = Date.now();
  prune(now);

  const id = parseCookie(req.headers.get("cookie"), SESSION_COOKIE);
  const session = id ? sessions.get(id) : undefined;

  if (session && session.expiresAt > now) {
    return { id: id!, turns: session.turns };
  }
  return { id: randomUUID(), turns: [] };
}

/** Hängt einen Turn an, kürzt auf `maxMessages` und verlängert die TTL. */
export function appendSessionTurn(
  id: string,
  turn: SessionTurn,
  maxMessages: number,
): void {
  const now = Date.now();
  const existing = sessions.get(id)?.turns ?? [];
  sessions.set(id, {
    turns: [...existing, turn].slice(-maxMessages),
    expiresAt: now + TTL_MS,
  });
}

/** `Set-Cookie`-Wert, um eine Sitzung zu setzen bzw. ihre TTL zu verlängern. */
export function sessionCookieHeader(id: string, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${id}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(TTL_MS / 1000)}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}
