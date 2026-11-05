import { expect, test } from "@playwright/test";

test.describe("Startseite", () => {
  test("zeigt Header, Datenschutz-Hinweis und leeren Chat", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Rothenburg Digital/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Rothenburg Digital" }),
    ).toBeVisible();
    await expect(
      page.getByText("Offene Daten für Rothenburg ob der Tauber – geprüft"),
    ).toBeVisible();

    // Der Chat ist Demonstrator und startet eingeklappt (#82).
    const textbox = page.getByRole("textbox", { name: "Ihre Nachricht" });
    await expect(textbox).toBeHidden();
    await page.getByText("Demonstrator: Fragen an die offenen Daten").click();
    await expect(textbox).toBeVisible();

    // Datenschutz-/Verlässlichkeitshinweis (#18) — sichtbar, sobald der Chat
    // aufgeklappt ist, vor dem Chat, kein wegklickbares Banner.
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
    // Der Hauptinhalt beginnt mit den offenen Daten, nicht mit dem Chat (#82).
    await expect(
      page.locator("#main-content").getByRole("heading", { level: 2 }).first(),
    ).toHaveText("Offene Daten der Stadt");
  });

  test("Chat lässt sich per Tastatur auf- und zuklappen (#82)", async ({ page }) => {
    await page.goto("/");

    const summary = page.locator("#chat > summary");
    const textbox = page.getByRole("textbox", { name: "Ihre Nachricht" });
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(textbox).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(textbox).toBeHidden();
  });

  test("Footer zeigt Lizenz, Rechtslinks und Build-Hash", async ({ page }) => {
    await page.goto("/");

    // Auf role="contentinfo" eingeschränkt: "Datenschutz" träfe sonst auch
    // "Mehr zum Datenschutz" (#18-Hinweis), und die Datenschutzseite selbst
    // hat noch einen zweiten Impressum-Link im Fließtext.
    const footer = page.getByRole("contentinfo");
    const impressum = footer.getByRole("link", { name: "Impressum" });
    await expect(impressum).toHaveAttribute(
      "href",
      "https://alexander-schnapper.de/impressum",
    );
    await expect(impressum).toHaveAttribute("target", "_blank");

    await expect(
      footer.getByRole("link", { name: "Datenschutz", exact: true }),
    ).toHaveAttribute("href", "/datenschutz");

    await expect(page.getByText(/Aktive Module:/)).toBeVisible();
  });

  test("Kacheln führen zu den Seiten aus offenen Daten", async ({ page }) => {
    await page.goto("/");

    const tiles = page.getByRole("navigation", { name: "Offene Daten" });
    await expect(tiles.getByRole("link", { name: /Parken & E-Laden/ })).toHaveAttribute(
      "href",
      "/parken",
    );
    await expect(tiles.getByRole("link", { name: /Essen & Trinken/ })).toHaveAttribute(
      "href",
      "/essen-trinken",
    );
    // Rein darstellende Schwerpunkte sind ausgeblendet, bis es Seiten dazu gibt.
    await expect(page.getByText("Sensorik & Klima")).toHaveCount(0);
  });
});
