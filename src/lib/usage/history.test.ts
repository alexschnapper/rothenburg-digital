import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  berlinDay,
  flushUsageHistory,
  recordUsage,
  resetUsageHistory,
  usageSummary,
} from "@/lib/usage/history";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "usage-"));
  process.env.USAGE_HISTORY_FILE = join(dir, "usage.json");
  resetUsageHistory();
});

afterEach(() => {
  resetUsageHistory();
  delete process.env.USAGE_HISTORY_FILE;
  rmSync(dir, { recursive: true, force: true });
});

/** Mittag deutscher Zeit (November: UTC+1). */
const at = (iso: string) => new Date(`${iso}T12:00:00+01:00`);

describe("berlinDay", () => {
  it("rechnet in deutscher Zeit, nicht in UTC", () => {
    // 23:30 UTC am 4.11. ist in Berlin schon der 5.11.
    expect(berlinDay(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-05");
  });
});

describe("usageSummary", () => {
  it("fasst Tag, 7 Tage, Monat und Gesamt zusammen", () => {
    const now = at("2026-11-04");
    recordUsage({ inputTokens: 1000, outputTokens: 200, costEur: 0.01 }, at("2026-10-20"));
    recordUsage({ inputTokens: 500, outputTokens: 100, costEur: 0.002 }, at("2026-11-01"));
    recordUsage({ inputTokens: 300, outputTokens: 50, costEur: 0.001 }, now);
    recordUsage({ inputTokens: 300, outputTokens: 50 }, now); // ohne Preis

    const summary = usageSummary(now);
    expect(summary.today).toMatchObject({ requests: 2, tokens: 700, costEur: 0.001 });
    expect(summary.last7Days.requests).toBe(3);
    expect(summary.thisMonth.requests).toBe(3);
    expect(summary.total).toMatchObject({ requests: 4, inputTokens: 2100, outputTokens: 400 });
    expect(summary.since).toBe("2026-10-20");
    expect(summary.monthly.map((month) => month.month)).toEqual(["2026-11", "2026-10"]);
  });

  it("liefert 30 Tage lückenlos, ältester zuerst", () => {
    const summary = usageSummary(at("2026-11-04"));
    expect(summary.daily).toHaveLength(30);
    expect(summary.daily[0].day).toBe("2026-10-06");
    expect(summary.daily.at(-1)?.day).toBe("2026-11-04");
    expect(summary.since).toBeNull();
  });
});

describe("Speicherung", () => {
  it("liest neu, wenn eine andere Instanz die Datei geändert hat", () => {
    // Erst lesen, solange es noch keine Datei gibt (wie die Kostenseite vor
    // der ersten Chat-Anfrage) …
    expect(usageSummary(at("2026-11-04")).since).toBeNull();

    // … dann schreibt eine andere Modul-Instanz (die Chat-Route).
    writeFileSync(
      process.env.USAGE_HISTORY_FILE!,
      JSON.stringify({
        version: 1,
        days: { "2026-11-04": { requests: 2, inputTokens: 10, outputTokens: 1, costEur: 0 } },
      }),
    );

    expect(usageSummary(at("2026-11-04")).today.requests).toBe(2);
  });

  it("überlebt einen Neustart über die Datei", () => {
    recordUsage({ inputTokens: 100, outputTokens: 10, costEur: 0.0001 }, at("2026-11-04"));
    flushUsageHistory();

    const file = JSON.parse(readFileSync(process.env.USAGE_HISTORY_FILE!, "utf8"));
    expect(file.days["2026-11-04"]).toMatchObject({ requests: 1, inputTokens: 100 });

    resetUsageHistory(); // simuliert Neustart: Speicher leer, Datei bleibt
    expect(usageSummary(at("2026-11-04")).today.requests).toBe(1);
  });
});
