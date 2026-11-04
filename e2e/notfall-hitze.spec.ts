import { expect, test } from "@playwright/test";

test.describe("Notfall & Hitze (#61)", () => {
  test("erreichbar über die Kachel, 112 steht ganz oben", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Notfall & Hitze/ }).click();

    await expect(page).toHaveURL(/\/notfall-hitze$/);
    await expect(page.getByRole("heading", { level: 1, name: "Notfall & Hitze" })).toBeVisible();
    // Unabhängig davon, ob bydata erreichbar ist.
    await expect(page.getByRole("heading", { name: "Im Notfall: Notruf 112" })).toBeVisible();
    await expect(page.getByRole("link", { name: "112 anrufen" })).toHaveAttribute("href", "tel:112");
  });
});
