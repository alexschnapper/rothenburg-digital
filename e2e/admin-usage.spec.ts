import { expect, test } from "@playwright/test";

/**
 * Reiner API-Test (kein `page`, keine Browser-Seite) — Playwrights
 * `request`-Fixture reicht für einen JSON-Endpoint. Der Token muss mit
 * `playwright.config.ts` (`webServer.env.ADMIN_TOKEN`) übereinstimmen.
 */
const ADMIN_TOKEN = "e2e-test-token";

test.describe("GET /api/admin/usage (#17)", () => {
  // Lokal nutzt Playwright einen schon laufenden `npm run dev` mit
  // (`reuseExistingServer`), und der kennt den Test-Token meist nicht: Der
  // Endpoint meldet dann 503 „nicht konfiguriert". Das ist kein Fehler im
  // Code, also lokal überspringen. In der CI startet Playwright den Server
  // selbst mit Token; dort gilt der Test immer.
  test.beforeEach(async ({ request }) => {
    if (process.env.CI) return;
    const probe = await request.get("/api/admin/usage");
    test.skip(
      probe.status() === 503,
      "Laufender Dev-Server ohne ADMIN_TOKEN — Test läuft in der CI oder ohne laufenden Server",
    );
  });

  test("lehnt Anfragen ohne Token ab", async ({ request }) => {
    const response = await request.get("/api/admin/usage");
    expect(response.status()).toBe(401);
  });

  test("lehnt einen falschen Token ab", async ({ request }) => {
    const response = await request.get("/api/admin/usage", {
      headers: { Authorization: "Bearer falscher-token" },
    });
    expect(response.status()).toBe(401);
  });

  test("liefert eine Momentaufnahme mit korrektem Token", async ({ request }) => {
    const response = await request.get("/api/admin/usage", {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      day: expect.any(String),
      tokensToday: expect.any(Number),
      budget: expect.any(Number),
      screenedToday: expect.any(Number),
      blockedToday: expect.any(Number),
      blockRate: expect.any(Number),
      topBlockedRules: expect.any(Array),
    });
  });
});
