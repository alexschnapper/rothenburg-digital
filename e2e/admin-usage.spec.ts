import { expect, test } from "@playwright/test";

/**
 * Reiner API-Test (kein `page`, keine Browser-Seite) — Playwrights
 * `request`-Fixture reicht für einen JSON-Endpoint. Der Token muss mit
 * `playwright.config.ts` (`webServer.env.ADMIN_TOKEN`) übereinstimmen.
 */
const ADMIN_TOKEN = "e2e-test-token";

test.describe("GET /api/admin/usage (#17)", () => {
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
