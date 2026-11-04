import { expect, test } from "@playwright/test";

test.describe("Fehlerseiten (#54)", () => {
  test("unbekannte Adresse zeigt deutsche 404-Seite mit echtem Status", async ({ page }) => {
    const response = await page.goto("/gibt-es-nicht");

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(/Seite nicht gefunden/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nicht gefunden");
    await expect(page.getByRole("link", { name: "Zur Startseite und zum Chat" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
