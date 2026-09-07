import { envInt, envList, isTruthy } from "@/lib/env";
import { chatEnabled } from "@/lib/landing";

/**
 * Grenzwerte der Missbrauchs-Abwehr für `/api/chat`.
 *
 * Alle Prüfungen liegen **serverseitig und provider-unabhängig** vor dem
 * Modellaufruf. Sie greifen also unverändert, wenn der Provider getauscht wird
 * (Issue #12) — kein Schutz hängt daran, dass ein bestimmtes Modell brav ist.
 *
 * Überschreibbar per Env, damit dev/staging/prod unterschiedlich scharf
 * eingestellt werden können, ohne Codeänderung. Werte werden zur Laufzeit
 * gelesen (kein `NEXT_PUBLIC_`, kein Rebuild nötig).
 */
export const guard = {
  /**
   * Not-Aus: schaltet den Chat-Endpoint komplett ab (`CHAT_DISABLED=1`).
   *
   * Zusätzlich aus, wenn die Umgebung im Teaser-Modus läuft
   * (`LANDING_PAGE=teaser`) — eine Umgebung, die das Portal noch nicht zeigt,
   * soll auch keinen offenen, kostenpflichtigen Endpoint dahinter haben.
   * `CHAT_DISABLED=0` hebt das ausdrücklich auf (siehe `src/lib/landing.ts`).
   */
  disabled: !chatEnabled(),

  /** Max. Größe des Roh-Bodys in Bytes, bevor überhaupt geparst wird. */
  maxBodyBytes: envInt(process.env.CHAT_MAX_BODY_BYTES, 64 * 1024),

  /** Max. Zeichen einer einzelnen Nutzernachricht (nach Normalisierung). */
  maxUserChars: envInt(process.env.CHAT_MAX_USER_CHARS, 2000),

  /** Max. Nachrichten im mitgesendeten Verlauf (ältere werden verworfen). */
  maxHistoryMessages: envInt(process.env.CHAT_MAX_HISTORY_MESSAGES, 20),

  /** Max. Zeichen über den gesamten Verlauf — deckelt die Input-Token. */
  maxTotalChars: envInt(process.env.CHAT_MAX_TOTAL_CHARS, 12000),

  /** Obergrenze der Antwortlänge — deckelt die Output-Token (teurer Teil). */
  maxOutputTokens: envInt(process.env.CHAT_MAX_OUTPUT_TOKENS, 800),

  /** Gleitendes Fenster für das Rate-Limit (Millisekunden). */
  rateWindowMs: envInt(process.env.CHAT_RATE_WINDOW_MS, 60_000),

  /**
   * Erlaubte Anfragen pro IP innerhalb des Fensters.
   *
   * 12/Minute ist über dem, was ein Mensch im Gespräch schafft, und deutlich
   * unter dem, was ein Skript versucht. Zu knapp gesetzt trifft es echte
   * Nutzer: das eigentliche Kostenlimit sind Tageskontingent und Token-Budget,
   * nicht dieses Fenster.
   */
  rateMaxRequests: envInt(process.env.CHAT_RATE_MAX_REQUESTS, 12),

  /** Erlaubte Anfragen pro IP und Tag (0 = aus). */
  maxRequestsPerDay: envInt(process.env.CHAT_MAX_REQUESTS_PER_DAY, 150),

  /** Tages-Token-Budget über alle Nutzer (0 = aus). Schutz gegen Kostenlawine. */
  dailyTokenBudget: envInt(process.env.CHAT_DAILY_TOKEN_BUDGET, 300_000),

  /** Auffällige Anfragen pro IP, ab denen befristet gesperrt wird. */
  suspiciousLimit: envInt(process.env.CHAT_SUSPICIOUS_LIMIT, 5),

  /** Dauer der Sperre nach zu vielen auffälligen Anfragen (Millisekunden). */
  suspiciousBlockMs: envInt(process.env.CHAT_SUSPICIOUS_BLOCK_MS, 15 * 60_000),

  /**
   * Nur Anfragen mit passendem `Origin`-Header annehmen.
   *
   * Kein echter Schutz (der Header ist fälschbar), aber er sperrt den Endpoint
   * für unbedachte Skripte und fremde Seiten aus, die ihn als kostenlosen
   * LLM-Proxy einbinden wollen.
   */
  requireSameOrigin: !isTruthy(process.env.CHAT_ALLOW_ANY_ORIGIN),

  /** Zusätzlich erlaubte Origins (z. B. für ein späteres Embed-Widget, #8). */
  allowedOrigins: envList(process.env.CHAT_ALLOWED_ORIGINS),

  /**
   * Canary-Token, das in den System-Prompt eingebaut wird.
   *
   * Leer = aus (Default, auch auf Prod). Für Red-Team-Läufe lokal setzen:
   * taucht der Wert in einer Antwort auf, wurde der System-Prompt geleakt.
   */
  promptCanary: process.env.CHAT_PROMPT_CANARY ?? "",
} as const;
