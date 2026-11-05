import { expect, test } from "@playwright/test";

/**
 * Wie bei /parken: Die Daten kommen serverseitig von bydata, `page.route()`
 * greift dort nicht. Geprüft wird, was mit und ohne Netz gelten muss.
 */
test.describe("Essen & Trinken", () => {
  test("erreichbar über den Link auf der Startseite", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Essen & Trinken/ }).click();

    await expect(page).toHaveURL(/\/essen-trinken$/);
    await expect(page).toHaveTitle(/Essen & Trinken/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Essen & Trinken" }),
    ).toBeVisible();
  });

  test("zeigt Betriebe mit Quelle oder einen Hinweis bei Ausfall", async ({
    page,
  }) => {
    await page.goto("/essen-trinken");

    const unavailable = page.getByRole("status");
    const listHeading = page.getByRole("heading", { name: /^Betriebe/ });
    await expect(unavailable.or(listHeading)).toBeVisible();

    if (await listHeading.isVisible()) {
      await expect(page.getByRole("heading", { name: "Quelle" })).toBeVisible();
      await expect(page.getByText(/^Stand der Anzeige: heute/)).toBeVisible();
    }

    await expect(
      page.getByRole("heading", { name: "Was hier (noch) fehlt" }),
    ).toBeVisible();
  });
});
