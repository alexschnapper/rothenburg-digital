import { expect, test } from "@playwright/test";

/** Wie bei /essen-trinken: Daten serverseitig von bydata, deshalb beide Fälle. */
test.describe("Einkaufen (#62)", () => {
  test("erreichbar über die Kachel auf der Startseite", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Einkaufen/ }).click();

    await expect(page).toHaveURL(/\/einkaufen$/);
    await expect(page.getByRole("heading", { level: 1, name: "Einkaufen" })).toBeVisible();
  });

  test("zeigt Gruppen mit Quelle oder einen Hinweis bei Ausfall", async ({ page }) => {
    await page.goto("/einkaufen");

    const unavailable = page.getByRole("status");
    const group = page.getByRole("heading", { name: /^Souvenirs, Geschenke und Spielzeug/ });
    await expect(unavailable.or(group)).toBeVisible();

    if (await group.isVisible()) {
      await expect(page.getByRole("heading", { name: "Quelle" })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Was hier (noch) fehlt" })).toBeVisible();
  });
});
