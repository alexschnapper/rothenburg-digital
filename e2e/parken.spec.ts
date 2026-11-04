import { expect, test } from "@playwright/test";

/**
 * Die Seite lädt die Daten serverseitig von bydata — `page.route()` greift
 * dort nicht. Die Tests prüfen deshalb nur, was in beiden Fällen gelten muss:
 * mit Daten (Liste + Quelle) und ohne Netz (ehrlicher Hinweis statt Fehler).
 */
test.describe("Parken & E-Laden", () => {
  test("erreichbar über den Link auf der Startseite", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Parken & E-Laden/ }).click();

    await expect(page).toHaveURL(/\/parken$/);
    await expect(page).toHaveTitle(/Parken & E-Laden/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Parken & E-Laden" }),
    ).toBeVisible();
  });

  test("zeigt Daten mit Quelle oder einen Hinweis bei Ausfall", async ({
    page,
  }) => {
    await page.goto("/parken");

    const unavailable = page.getByRole("status");
    const parkingHeading = page.getByRole("heading", { name: /^Parkplätze/ });
    await expect(unavailable.or(parkingHeading)).toBeVisible();

    if (await parkingHeading.isVisible()) {
      await expect(page.getByRole("heading", { name: "Quelle" })).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Auf der Karte zeigen/ }).first(),
      ).toHaveAttribute("href", /^https:\/\/www\.openstreetmap\.org\//);
    }

    // Unabhängig von den Daten: was fehlt, steht immer da.
    await expect(
      page.getByRole("heading", { name: "Was hier (noch) fehlt" }),
    ).toBeVisible();
  });
});
