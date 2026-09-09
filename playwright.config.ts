import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-/Component-Tests (Issue #25, Fortsetzung von Vitest).
 *
 * Läuft gegen `next dev`, nicht gegen einen Produktionsbuild — die Tests
 * prüfen Rendering und Verhalten im Browser, nicht das Build-Ergebnis (dafür
 * gibt es den `Produktionsbuild`-Schritt in `ci.yml`). `/api/chat` wird in
 * jedem Test mit `page.route()` gemockt (`e2e/chat.spec.ts`) — kein Test
 * hier verursacht einen echten Modellaufruf oder braucht einen API-Key.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    // Fester Test-Token für e2e/admin-usage.spec.ts (#17). Nur wirksam, wenn
    // Playwright den Server selbst startet — läuft schon einer (lokal ohne
    // CI, `reuseExistingServer`), gilt dessen eigene Umgebung, dann fehlt
    // ADMIN_TOKEN dort ggf. und der 200-Fall schlägt lokal fehl, ohne dass
    // das ein echter Bug ist.
    env: { ADMIN_TOKEN: "e2e-test-token" },
  },
});
