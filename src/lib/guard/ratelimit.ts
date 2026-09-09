import { guard } from "@/lib/guard/config";
import { logGuard } from "@/lib/guard/log";

/**
 * Rate-Limit, Tageskontingent und Token-Budget — bewusst prozesslokal.
 *
 * **Warum in-memory:** Diese App läuft auf Plesk/Passenger als *ein*
 * Node-Prozess pro Umgebung (siehe `docs/DEPLOYMENT.md`). Ein Zähler im
 * Speicher ist damit für dev/staging und den Start auf Prod ausreichend und
 * kostet keine zusätzliche Infrastruktur.
 *
 * **Grenzen, die man kennen muss:**
 * - Ein App-Neustart setzt alle Zähler zurück.
 * - Bei mehreren Instanzen (Cluster, Scale-out) zählt jede für sich.
 * - Ein verteilter Angriff über viele IPs wird davon nicht aufgehalten; dafür
 *   ist das Tages-Token-Budget die eigentliche Bremse.
 *
 * Sobald mehr nötig ist, gehört hier ein gemeinsamer Speicher (Redis/Valkey
 * oder eine kleine SQLite-Tabelle) hinter dieselbe Schnittstelle.
 */

type Counters = {
  /** Zeitstempel der letzten Anfragen pro Schlüssel (gleitendes Fenster). */
  hits: Map<string, number[]>;
  /** Kalendertag (Europe/Berlin), auf den sich die Tageszähler beziehen. */
  day: string;
  /** Anfragen pro Schlüssel am aktuellen Tag. */
  requestsToday: Map<string, number>;
  /** Verbrauchte Eingabe-Token am aktuellen Tag, alle Nutzer. */
  inputTokensToday: number;
  /** Verbrauchte Ausgabe-Token am aktuellen Tag, alle Nutzer. */
  outputTokensToday: number;
  /** Zeitstempel auffälliger Anfragen pro Schlüssel. */
  suspicious: Map<string, number[]>;
  /** Befristete Sperren: Schlüssel -> Ablaufzeitpunkt. */
  blockedUntil: Map<string, number>;
  /** Fragen, die die Heuristik heute erreicht haben (vor der Entscheidung). */
  screenedToday: number;
  /** Davon von der Heuristik abgelehnte Fragen heute. */
  blockedToday: number;
  /** Häufigkeit je ausgelöster Regel heute (Issue #17, „Top-Regeln"). */
  blockedRulesToday: Map<string, number>;
  /** Verhindert mehrfache Schwellenwert-Meldungen am selben Tag. */
  budgetWarningLoggedToday: boolean;
};

// `globalThis`, damit die Zähler den Hot-Reload im Dev-Modus überleben —
// sonst hätte man beim Testen bei jeder Codeänderung ein frisches Limit.
const globalForCounters = globalThis as typeof globalThis & {
  __chatGuardCounters?: Counters;
};

const berlinDay = (now: number): string =>
  // "sv-SE" liefert ISO-Format (YYYY-MM-DD), Zeitzone explizit gesetzt.
  new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

function counters(now: number): Counters {
  const state = (globalForCounters.__chatGuardCounters ??= {
    hits: new Map(),
    day: berlinDay(now),
    requestsToday: new Map(),
    inputTokensToday: 0,
    outputTokensToday: 0,
    suspicious: new Map(),
    blockedUntil: new Map(),
    screenedToday: 0,
    blockedToday: 0,
    blockedRulesToday: new Map(),
    budgetWarningLoggedToday: false,
  });

  const today = berlinDay(now);
  if (state.day !== today) {
    state.day = today;
    state.requestsToday.clear();
    state.inputTokensToday = 0;
    state.outputTokensToday = 0;
    state.screenedToday = 0;
    state.blockedToday = 0;
    state.blockedRulesToday.clear();
    state.budgetWarningLoggedToday = false;
  }

  return state;
}

/** Verhindert unbegrenztes Wachstum der Maps bei vielen unterschiedlichen IPs. */
function prune(state: Counters, now: number): void {
  if (state.hits.size <= 5000) return;

  for (const [key, timestamps] of state.hits) {
    if (timestamps.every((at) => now - at > guard.rateWindowMs)) {
      state.hits.delete(key);
    }
  }
  for (const [key, until] of state.blockedUntil) {
    if (until <= now) state.blockedUntil.delete(key);
  }
  for (const [key, timestamps] of state.suspicious) {
    if (timestamps.every((at) => now - at > guard.suspiciousBlockMs)) {
      state.suspicious.delete(key);
    }
  }
}

const within = (timestamps: number[], now: number, windowMs: number): number[] =>
  timestamps.filter((at) => now - at < windowMs);

/**
 * Anfragende Gegenstelle bestimmen.
 *
 * Reihenfolge ist hier sicherheitsrelevant:
 *
 * 1. `X-Real-IP` — setzt nginx (Plesk) selbst und überschreibt dabei einen
 *    mitgeschickten Wert. Deshalb die erste Wahl.
 * 2. **Letzter** Eintrag aus `X-Forwarded-For` — nginx hängt die tatsächliche
 *    Gegenstelle hinten an (`$proxy_add_x_forwarded_for`). Der *erste* Eintrag
 *    stammt dagegen vom Client und wäre frei erfindbar: wer ihn auswertet,
 *    verschenkt das Rate-Limit, weil jede Anfrage einen neuen Zähler bekommt.
 * 3. Sonst alles in einen Topf ("unknown") — im Zweifel zu streng, nicht zu
 *    locker.
 *
 * Das gilt für genau einen vertrauenswürdigen Proxy davor (die Plesk-Ablage
 * aus `docs/DEPLOYMENT.md`). Kommt eine weitere Schicht dazu (CDN, WAF), muss
 * die Auswertung entsprechend angepasst werden. Lokal ohne Proxy sind beide
 * Header frei setzbar — praktisch für `npm run redteam`, aber kein
 * Identitätsnachweis. Die IP ist hier Kostenschutz, keine Authentifizierung.
 */
export function clientKey(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = req.headers.get("x-forwarded-for")?.split(",") ?? [];
  return forwarded.at(-1)?.trim() || "unknown";
}

export type LimitDecision =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; message: string; reason: string };

/** Prüft Sperre, gleitendes Fenster und Tageskontingent — in dieser Reihenfolge. */
export function checkRateLimit(key: string, now = Date.now()): LimitDecision {
  const state = counters(now);
  prune(state, now);

  const blockedUntil = state.blockedUntil.get(key);
  if (blockedUntil !== undefined && blockedUntil > now) {
    return {
      ok: false,
      reason: "temporarily-blocked",
      retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000),
      message:
        "Zu viele auffällige Anfragen von dieser Verbindung. Bitte später erneut versuchen.",
    };
  }

  const recent = within(state.hits.get(key) ?? [], now, guard.rateWindowMs);
  if (recent.length >= guard.rateMaxRequests) {
    const oldest = recent[0] ?? now;
    return {
      ok: false,
      reason: "rate-limited",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((guard.rateWindowMs - (now - oldest)) / 1000),
      ),
      message:
        "Zu viele Anfragen in kurzer Zeit. Bitte einen Moment warten und erneut senden.",
    };
  }

  const today = state.requestsToday.get(key) ?? 0;
  if (guard.maxRequestsPerDay > 0 && today >= guard.maxRequestsPerDay) {
    return {
      ok: false,
      reason: "daily-quota",
      retryAfterSeconds: 3600,
      message:
        "Das Tageskontingent für diese Verbindung ist erreicht. Bitte morgen wieder.",
    };
  }

  recent.push(now);
  state.hits.set(key, recent);
  state.requestsToday.set(key, today + 1);
  return { ok: true };
}

/** Auffällige Anfrage vermerken; ab `suspiciousLimit` folgt eine Sperre. */
export function recordSuspicious(key: string, now = Date.now()): void {
  const state = counters(now);
  const recent = within(
    state.suspicious.get(key) ?? [],
    now,
    guard.suspiciousBlockMs,
  );
  recent.push(now);
  state.suspicious.set(key, recent);

  if (guard.suspiciousLimit > 0 && recent.length >= guard.suspiciousLimit) {
    state.blockedUntil.set(key, now + guard.suspiciousBlockMs);
    state.suspicious.delete(key);
  }
}

/** Anteil des Tagesbudgets, ab dem einmal täglich eine Log-Warnung folgt. */
const BUDGET_WARNING_THRESHOLD = 0.8;

/**
 * Ein- und Ausgabe-Token getrennt buchen (Issue #17 braucht beide, um Kosten
 * korrekt zu schätzen — Input und Output kosten je nach Provider
 * unterschiedlich, siehe `src/lib/llm/pricing.ts`).
 */
export function recordTokens(
  inputTokens: number,
  outputTokens: number,
  now = Date.now(),
): void {
  if (inputTokens <= 0 && outputTokens <= 0) return;
  const state = counters(now);
  state.inputTokensToday += Math.max(0, inputTokens);
  state.outputTokensToday += Math.max(0, outputTokens);
  warnIfBudgetThresholdReached(state);
}

/** Tagesbudget erschöpft? Dann wird gar kein Modell mehr aufgerufen. */
export function isBudgetExhausted(now = Date.now()): boolean {
  if (guard.dailyTokenBudget <= 0) return false;
  const state = counters(now);
  return state.inputTokensToday + state.outputTokensToday >= guard.dailyTokenBudget;
}

/**
 * Loggt einmal pro Tag eine Warnung, sobald `BUDGET_WARNING_THRESHOLD`
 * erreicht ist — **vor** der 503-Sperre bei 100 %, nicht erst danach.
 */
function warnIfBudgetThresholdReached(state: Counters): void {
  if (guard.dailyTokenBudget <= 0 || state.budgetWarningLoggedToday) return;

  const used = state.inputTokensToday + state.outputTokensToday;
  if (used / guard.dailyTokenBudget < BUDGET_WARNING_THRESHOLD) return;

  state.budgetWarningLoggedToday = true;
  logGuard("warn", {
    event: "budget-warning",
    day: state.day,
    tokensToday: used,
    budget: guard.dailyTokenBudget,
    percent: Math.round((used / guard.dailyTokenBudget) * 100),
  });
}

/** Eine Frage hat die Heuristik erreicht — vor der Ablehnen-Entscheidung aufrufen. */
export function recordScreened(now = Date.now()): void {
  counters(now).screenedToday += 1;
}

/** Von der Heuristik abgelehnte Frage samt ausgelöster Regeln vermerken. */
export function recordBlocked(rules: string[], now = Date.now()): void {
  const state = counters(now);
  state.blockedToday += 1;
  for (const rule of rules) {
    state.blockedRulesToday.set(rule, (state.blockedRulesToday.get(rule) ?? 0) + 1);
  }
}

/** Momentaufnahme für Logs und den Monitoring-Endpoint (Issue #17). */
export function usageSnapshot(now = Date.now()): {
  day: string;
  inputTokensToday: number;
  outputTokensToday: number;
  tokensToday: number;
  budget: number;
  /** Ganzzahliger Prozentwert, 0 wenn kein Budget konfiguriert ist. */
  budgetPercent: number;
  trackedKeys: number;
  screenedToday: number;
  blockedToday: number;
  /** Anteil 0..1, 0 wenn noch keine Frage gescreent wurde. */
  blockRate: number;
  /** Bis zu fünf häufigste Regeln des Tages, absteigend sortiert. */
  topBlockedRules: { rule: string; count: number }[];
} {
  const state = counters(now);
  const tokensToday = state.inputTokensToday + state.outputTokensToday;
  const topBlockedRules = [...state.blockedRulesToday.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rule, count]) => ({ rule, count }));

  return {
    day: state.day,
    inputTokensToday: state.inputTokensToday,
    outputTokensToday: state.outputTokensToday,
    tokensToday,
    budget: guard.dailyTokenBudget,
    budgetPercent:
      guard.dailyTokenBudget > 0
        ? Math.round((tokensToday / guard.dailyTokenBudget) * 100)
        : 0,
    trackedKeys: state.hits.size,
    screenedToday: state.screenedToday,
    blockedToday: state.blockedToday,
    blockRate: state.screenedToday > 0 ? state.blockedToday / state.screenedToday : 0,
    topBlockedRules,
  };
}
