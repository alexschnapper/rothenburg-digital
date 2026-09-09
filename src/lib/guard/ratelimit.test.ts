import { describe, expect, it } from "vitest";

import {
  isBudgetExhausted,
  recordBlocked,
  recordScreened,
  recordTokens,
  usageSnapshot,
} from "@/lib/guard/ratelimit";

/**
 * Jeder Test nutzt einen eigenen, nie wiederverwendeten Kalendertag
 * (Europe/Berlin) als `now` — die Tagesumschaltung in `ratelimit.ts` sorgt so
 * für saubere, voneinander unabhängige Zähler, ohne den Modul-Singleton
 * manuell zurücksetzen zu müssen. Setzt sequenzielle Ausführung innerhalb
 * dieser Datei voraus (Vitest-Standardverhalten pro Testdatei).
 */
const day = (n: number) => new Date(2020, 0, n, 12, 0, 0).getTime();

describe("usageSnapshot", () => {
  it("startet einen neuen Tag bei null", () => {
    const snapshot = usageSnapshot(day(1));
    expect(snapshot.tokensToday).toBe(0);
    expect(snapshot.screenedToday).toBe(0);
    expect(snapshot.blockedToday).toBe(0);
    expect(snapshot.blockRate).toBe(0);
    expect(snapshot.topBlockedRules).toEqual([]);
  });

  it("summiert Ein- und Ausgabe-Token getrennt und zusammen", () => {
    const now = day(2);
    recordTokens(100, 50, now);
    recordTokens(30, 10, now);
    const snapshot = usageSnapshot(now);
    expect(snapshot.inputTokensToday).toBe(130);
    expect(snapshot.outputTokensToday).toBe(60);
    expect(snapshot.tokensToday).toBe(190);
  });

  it("zählt geprüfte/abgelehnte Fragen und berechnet die Blockrate", () => {
    const now = day(3);
    recordScreened(now);
    recordScreened(now);
    recordScreened(now);
    recordBlocked(["instruction-override"], now);
    const snapshot = usageSnapshot(now);
    expect(snapshot.screenedToday).toBe(3);
    expect(snapshot.blockedToday).toBe(1);
    expect(snapshot.blockRate).toBeCloseTo(1 / 3, 5);
  });

  it("zählt die häufigsten Regeln absteigend", () => {
    const now = day(4);
    recordBlocked(["a"], now);
    recordBlocked(["a"], now);
    recordBlocked(["b"], now);
    recordBlocked(["a", "b"], now);
    const snapshot = usageSnapshot(now);
    expect(snapshot.topBlockedRules[0]).toEqual({ rule: "a", count: 3 });
    expect(snapshot.topBlockedRules[1]).toEqual({ rule: "b", count: 2 });
  });

  it("berechnet budgetPercent auf Basis des konfigurierten Tagesbudgets", () => {
    const now = day(5);
    const budget = usageSnapshot(now).budget;
    expect(budget).toBeGreaterThan(0);
    recordTokens(budget, 0, now);
    expect(usageSnapshot(now).budgetPercent).toBe(100);
  });
});

describe("isBudgetExhausted", () => {
  it("ist erst erschöpft, wenn Ein- plus Ausgabe-Token das Budget erreichen", () => {
    const now = day(6);
    const budget = usageSnapshot(now).budget;
    recordTokens(Math.floor(budget / 2), Math.floor(budget / 2) - 10, now);
    expect(isBudgetExhausted(now)).toBe(false);
    recordTokens(20, 0, now);
    expect(isBudgetExhausted(now)).toBe(true);
  });
});
