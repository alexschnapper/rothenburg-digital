import { expect, test } from "@playwright/test";

test.describe("Startseite", () => {
  test("zeigt Header, Datenschutz-Hinweis und leeren Chat", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Rothenburg Digital/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Rothenburg Digital" }),
    ).toBeVisible();
    await expect(
      page.getByText("Vom Marktplatz bis ins Taubertal"),
    ).toBeVisible();

    // Datenschutz-/Verlässlichkeitshinweis (#18) — dauerhaft sichtbar, vor
    // dem Chat, kein wegklickbares Banner.
    await expect(page.getByText("keine personenbezogenen Daten")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Mehr zum Datenschutz" }),
    ).toHaveAttribute("href", "/datenschutz");

    // Leerer Chat-Bereich
    await expect(page.getByRole("log", { name: "Chat-Verlauf" })).toContainText(
      "Stellen Sie eine Frage",
    );
    await expect(page.getByRole("textbox", { name: "Ihre Nachricht" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Senden" })).toBeDisabled();
  });

  test("Skip-Link verweist auf den Hauptinhalt", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "Zum Hauptinhalt springen" });
    await expect(skipLink).toHaveAttribute("href", "#main-content");
    await expect(page.locator("#main-content")).toBeAttached();
  });

  test("Footer zeigt Lizenz, Rechtslinks und Build-Hash", async ({ page }) => {
    await page.goto("/");

    const impressum = page.getByRole("link", { name: "Impressum" });
    await expect(impressum).toHaveAttribute(
      "href",
      "https://alexander-schnapper.de/impressum",
    );
    await expect(impressum).toHaveAttribute("target", "_blank");

    // Exakter Name, sonst würde "Mehr zum Datenschutz" (#18-Hinweis) auch
    // treffen.
    await expect(
      page.getByRole("link", { name: "Datenschutz", exact: true }),
    ).toHaveAttribute("href", "/datenschutz");

    await expect(page.getByText(/Aktive Module:/)).toBeVisible();
  });

  test("Info-Kacheln zu den drei Schwerpunkten sind sichtbar", async ({ page }) => {
    await page.goto("/");

    const focusAreas = page.getByLabel("Schwerpunkte von Rothenburg Digital");
    await expect(focusAreas.getByText("Barrierefrei")).toBeVisible();
    await expect(focusAreas.getByText("Mehrsprachig")).toBeVisible();
    await expect(focusAreas.getByText("Smart City")).toBeVisible();
  });
});
