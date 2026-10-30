import { expect, test } from "@playwright/test";

test.describe("Datenschutzseite", () => {
  test("erreichbar über den Link auf der Startseite", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Mehr zum Datenschutz" }).click();

    await expect(page).toHaveURL(/\/datenschutz$/);
    await expect(page).toHaveTitle(/Datenschutz/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Datenschutz beim Chat" }),
    ).toBeVisible();
  });

  test("beschreibt Anbieter, Speicherung und Protokollierung konkret", async ({
    page,
  }) => {
    await page.goto("/datenschutz");

    await expect(
      page.getByRole("heading", { name: "Anbieter und Verarbeitungsort" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Speicherung des Gesprächsverlaufs" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Protokollierung der Missbrauchs-Abwehr" }),
    ).toBeVisible();
    await expect(page.getByText("keine echte IP-Adresse")).toBeVisible();
  });

  test("Zurück-Link führt wieder zur Startseite", async ({ page }) => {
    await page.goto("/datenschutz");
    await page.getByRole("link", { name: "Zurück zum Chat" }).click();
    await expect(page).toHaveURL("/");
  });

  test("Footer ist identisch mit dem der Startseite", async ({ page }) => {
    await page.goto("/datenschutz");

    // Im Fließtext der Seite steht noch ein zweiter Impressum-Link — hier
    // bewusst auf den Footer eingeschränkt (role="contentinfo").
    const footer = page.getByRole("contentinfo");
    await expect(
      footer.getByRole("link", { name: "Datenschutz", exact: true }),
    ).toHaveAttribute("href", "/datenschutz");
    await expect(
      footer.getByRole("link", { name: "Impressum" }),
    ).toHaveAttribute("href", "https://alexander-schnapper.de/impressum");
  });
});
