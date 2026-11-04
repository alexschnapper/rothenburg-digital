import { expect, test } from "@playwright/test";

/** Wie bei /parken: Daten serverseitig von bydata, deshalb beide Fälle. */
test.describe("Sehenswürdigkeiten", () => {
  test("erreichbar über die Kachel auf der Startseite", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Sehenswürdigkeiten/ }).click();

    await expect(page).toHaveURL(/\/sehenswuerdigkeiten$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sehenswürdigkeiten" })).toBeVisible();
  });

  test("zeigt Gruppen mit Quelle oder einen Hinweis bei Ausfall", async ({ page }) => {
    await page.goto("/sehenswuerdigkeiten");

    const unavailable = page.getByRole("status");
    const group = page.getByRole("heading", { name: /^Türme, Tore und Stadtmauer/ });
    await expect(unavailable.or(group)).toBeVisible();

    if (await group.isVisible()) {
      await expect(page.getByRole("heading", { name: "Quelle" })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Was hier (noch) fehlt" })).toBeVisible();
  });
});
