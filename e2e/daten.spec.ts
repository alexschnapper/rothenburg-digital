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
    await expect(page.getByRole("heading", { name: "Befunde je Datensatz" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Prüfregeln im Quellcode/ })).toBeVisible();
  });
});

test.describe("Dashboard Datenqualität (#84)", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("Filter über das Formular landen in der Adresse", async ({ page }) => {
    await page.goto("/daten");
    await page.getByRole("combobox", { name: "Regel" }).selectOption("veraltet");
    await page.getByRole("button", { name: "Filter anwenden" }).click();

    // Leere Felder fallen weg, die Adresse bleibt teilbar.
    await expect(page).toHaveURL(/\/daten\?regel=veraltet$/);
    await expect(page.getByText(/Gefiltert nach Regel „Veraltet“/)).toBeVisible();
    // Nur noch eine Spalte, und jede Karte nennt nur diesen Befund.
    const matrix = page.getByRole("region", { name: /Befunde je Datensatz und Prüfregel/ });
    await expect(matrix.getByRole("columnheader")).toHaveCount(2);
    await expect(page.getByText("Warnung · Öffnungszeiten:")).toHaveCount(0);
  });

  test("ein geteilter Link zeigt dieselbe Ansicht, unbekannte Werte zeigen alles", async ({ page }) => {
    await page.goto("/daten?schwere=fehler");
    await expect(page.getByRole("combobox", { name: "Schwere" })).toHaveValue("fehler");
    await expect(page.getByText(/Datensätzen\.$/).first()).toContainText("2 von 18");

    await page.goto("/daten?regel=gibt-es-nicht");
    await expect(page).toHaveURL(/\/daten$/);
    await expect(page.getByText(/Gefiltert nach/)).toHaveCount(0);
  });

  test("Zelle per Tastatur: springt zum Befund", async ({ page }) => {
    await page.goto("/daten");
    const cell = page.getByRole("link", { name: /^Fehler: Leer bei / });
    await cell.focus();
    await expect(cell).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#skg-venus-[a-z-]+--leer$/);
    const target = page.locator(":target");
    await expect(target).toContainText("Fehler · Leer:");
    await expect(target).toBeInViewport();
  });

  test("CSV-Export aller Befunde", async ({ request }) => {
    const response = await request.get("/daten/befunde.csv");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="befunde-\d{4}-\d{2}-\d{2}\.csv"/);
    // BOM für Excel; `text()` würde ihn beim Dekodieren verschlucken.
    const body = await response.body();
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = (await response.text()).trim().split("\r\n");
    expect(lines[0]).toMatch(/^\uFEFF?Datensatz-ID;Datensatz;Ampel;Regel;/);
    expect(lines.length).toBeGreaterThan(1);

    const filtered = await request.get("/daten/befunde.csv?regel=veraltet");
    const rows = (await filtered.text()).trim().split("\r\n").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.includes(";veraltet;Veraltet;"))).toBe(true);
  });

  test("Druckansicht ohne Filter und Navigation, Matrix sichtbar", async ({ page }) => {
    await page.goto("/daten");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Filter anwenden" })).toBeHidden();
    await expect(page.getByRole("link", { name: /Zur Startseite/ })).toBeHidden();
    await expect(page.getByRole("region", { name: /Befunde je Datensatz und Prüfregel/ })).toBeVisible();
  });

  test("auf dem Handy wird die Matrix zur Liste", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/daten");
    await expect(page.getByRole("region", { name: /Befunde je Datensatz und Prüfregel/ })).toBeHidden();
    await expect(page.getByRole("link", { name: "Veraltet" })).toBeVisible();
  });
});
