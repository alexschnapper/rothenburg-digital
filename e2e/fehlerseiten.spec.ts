import { expect, test } from "@playwright/test";

test.describe("Fehlerseiten (#54)", () => {
  test("unbekannte Adresse zeigt deutsche 404-Seite mit echtem Status", async ({ page }) => {
    const response = await page.goto("/gibt-es-nicht");

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(/Seite nicht gefunden/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nicht gefunden");
    await expect(page.getByRole("link", { name: "Zur Startseite" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

test.describe("Fehler im Chat (#54)", () => {
  async function askWithError(
    page: import("@playwright/test").Page,
    status: number,
    body: string,
    headers: Record<string, string> = {},
  ) {
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status,
        headers: { "content-type": "text/plain; charset=utf-8", ...headers },
        body,
      }),
    );
    await page.goto("/");
    await page.getByText("Demonstrator: Fragen an die offenen Daten").click();
    await page.getByRole("textbox", { name: "Ihre Nachricht" }).fill("Wann hat das Bürgerbüro geöffnet?");
    await page.getByRole("button", { name: "Senden" }).click();
    // Next hat einen eigenen `role="alert"` (Ansage bei Seitenwechsel).
    return page.getByRole("alert").filter({ hasText: "Erneut senden" });
  }

  test("429 zeigt Code, Bezeichnung und Wartezeit", async ({ page }) => {
    const alert = await askWithError(
      page,
      429,
      "Zu viele Anfragen in kurzer Zeit. Bitte kurz warten.",
      { "Retry-After": "30" },
    );
    await expect(alert).toContainText("429 · Zu viele Anfragen");
    await expect(alert).toContainText("Zu viele Anfragen in kurzer Zeit");
    await expect(alert.getByRole("button", { name: /Erneut senden in \d+ s/ })).toBeDisabled();
    await expect(alert.getByRole("link", { name: /Fehler melden/ })).toHaveCount(0);
  });

  test("503 wegen Tagesbudget verweist auf die Kostenseite", async ({ page }) => {
    const alert = await askWithError(
      page,
      503,
      "Das Tagesbudget des Assistenten ist ausgeschöpft. Bitte nach Mitternacht wieder versuchen.",
    );
    await expect(alert).toContainText("503 · Dienst nicht verfügbar");
    await expect(alert.getByRole("link", { name: "Kosten des Chats" })).toHaveAttribute("href", "/kosten");
  });

  test("500 bietet „Fehler melden“ mit vorausgefülltem Formular", async ({ page }) => {
    const alert = await askWithError(page, 500, "Es ist ein Fehler bei der Chat-Anfrage aufgetreten.");
    const report = alert.getByRole("link", { name: /Fehler melden/ });
    await expect(report).toHaveAttribute("href", /template=fehlermeldung\.yml.*fehlercode=500/);
    await expect(alert.getByRole("button", { name: "Erneut senden" })).toBeEnabled();
  });
});
