import { expect, test } from "@playwright/test";

/**
 * Datenfehler melden (#10): Links zu vorausgefüllten GitHub-Formularen. Der
 * Server schreibt nichts.
 */
test.describe("Datenfehler melden (#10)", () => {
  test("/daten: Abschnitt mit GitHub, Meldungen und Idee", async ({ page }) => {
    await page.goto("/daten");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Fehler melden und mitmachen" }) });
    await expect(section).toBeVisible();

    const github = section.getByRole("link", { name: /Fehler in den Daten auf GitHub melden/ });
    const href = new URL((await github.getAttribute("href")) ?? "");
    expect(href.searchParams.get("template")).toBe("datenfehler.yml");
    expect(href.searchParams.get("seite")).toBe("/daten");

    // Ein Weg ohne GitHub-Konto (z. B. E-Mail) ist noch in Klärung (#10).
    await expect(section.locator('a[href^="mailto:"]')).toHaveCount(0);

    await expect(section.getByRole("link", { name: /Bisherige Meldungen/ })).toHaveAttribute("href", /label%3Adatenmeldung/);
    await expect(section.getByRole("link", { name: /Idee einreichen/ })).toHaveAttribute("href", /template=idee\.yml/);
  });

  test("/daten: je Datensatz ein Link mit eingetragenem Datensatz", async ({ page }) => {
    await page.goto("/daten#skg-venus-restaurants");
    const card = page.locator("#skg-venus-restaurants");
    const link = card.getByRole("link", { name: /Fehler in diesem Datensatz melden/ });
    const href = new URL((await link.getAttribute("href")) ?? "");
    expect(href.searchParams.get("datensatz")).toBe("Restaurants");
  });

  test("Bereichsseite: Meldelinks unter der Quelle", async ({ page }) => {
    await page.goto("/essen-trinken");
    const quelle = page.locator("section", { has: page.getByRole("heading", { name: "Quelle", exact: true }) });
    test.skip(!(await quelle.isVisible()), "bydata nicht erreichbar");
    const github = quelle.getByRole("link", { name: /Auf GitHub melden/ });
    const href = new URL((await github.getAttribute("href")) ?? "");
    // Bezeichnung der Quelle auf dieser Seite, z. B. „Restaurants, Cafés und Gastronomie“
    expect(href.searchParams.get("datensatz")).toContain("Restaurants");
    expect(href.searchParams.get("seite")).toBe("/essen-trinken");
    await expect(quelle.locator('a[href^="mailto:"]')).toHaveCount(0);
  });
});
