import { expect, test } from "@playwright/test";

test.describe("Datenqualität (#80)", () => {
  test("erreichbar über die erste Kachel, zeigt den eingecheckten Bericht", async ({ page }) => {
    await page.goto("/");
    const tiles = page.getByRole("navigation", { name: "Offene Daten" }).getByRole("link");
    await expect(tiles.first()).toContainText("Datenqualität");
    await tiles.first().click();

    await expect(page).toHaveURL(/\/daten$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Datenqualität der offenen Daten" }),
    ).toBeVisible();
    // Kein Live-Abruf: Die Seite steht auch ohne bydata.
    await expect(page.getByText(/Geprüft wurden \d+ Datensätze/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Datensätze" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Prüfregeln im Quellcode/ })).toBeVisible();
  });
});
