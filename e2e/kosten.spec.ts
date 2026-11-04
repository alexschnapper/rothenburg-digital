import { expect, test } from "@playwright/test";

test.describe("Kostenseite (#48)", () => {
  test("erreichbar über den Footer", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Kosten", exact: true })
      .click();

    await expect(page).toHaveURL(/\/kosten$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Was kostet der Chat?" }),
    ).toBeVisible();
  });

  test("erklärt Rechnung und Grenzen der Zahlen", async ({ page }) => {
    await page.goto("/kosten");

    await expect(page.getByRole("heading", { name: "Überblick" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "So wird gerechnet" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Was hier nicht enthalten ist" }),
    ).toBeVisible();
    await expect(page.getByText(/Schätzung zum Listenpreis/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tatsächlich bezahlt" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Grenzen: Die Kosten sind gedeckelt" }),
    ).toBeVisible();
  });
});
