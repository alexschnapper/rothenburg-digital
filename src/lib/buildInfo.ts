/**
 * Commit-Kurzhash des laufenden Builds.
 *
 * Beantwortet „läuft hier wirklich der neueste Stand?", ohne SSH oder
 * File-Manager — sichtbar im Footer und im Server-Log
 * (`logLlmConfigOnce()` in `src/lib/llm/provider.ts`). Der Wert kommt aus
 * `NEXT_PUBLIC_BUILD_SHA`, das `next.config.mjs` vor jedem Build per
 * `git rev-parse --short HEAD` setzt.
 */
export const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA || "unbekannt";
