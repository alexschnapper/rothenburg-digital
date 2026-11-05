import { expect, test, type Page } from "@playwright/test";

/**
 * Breitere Desktop-Ansicht (#94): Alle Inhaltsseiten nutzen `PageShell`.
 * Wie bei den Datenseiten kommen die Daten serverseitig von bydata; geprüft
 * wird, was mit und ohne Netz gelten muss.
 */
const PAGES = [
  "/",
  "/daten",
  "/essen-trinken",
  "/einkaufen",
  "/sehenswuerdigkeiten",
  "/parken",
  "/notfall-hitze",
  "/kosten",
];

/** Breite eines Elements in CSS-Pixeln */
const width = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().width);

/** Spalten der ersten Kartenliste mit mindestens drei Karten, 0 ohne Daten */
const columnsOfFirstGrid = (page: Page) =>
  page.evaluate(() => {
    const grid = [...document.querySelectorAll("main ul.grid")].find(
      (ul) => ul.children.length >= 3,
    );
    if (!grid) return 0;
    const tops = [...grid.children].map((li) => Math.round(li.getBoundingClientRect().top));
    return tops.filter((top) => top === tops[0]).length;
  });

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("Breitere Desktop-Ansicht (#94)", () => {
  for (const path of PAGES) {
    test(`${path}: breit auf dem Desktop, Fließtext schmal`, async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(path);
      expect(await width(page, "main")).toBeGreaterThan(1200);
      // max-w-3xl = 768 px: höchstens etwa 80 Zeichen pro Zeile (WCAG 1.4.8)
      expect(await width(page, "header")).toBeLessThanOrEqual(768);
    });

    test(`${path}: ohne horizontales Scrollen auf dem Handy und bei 400 % Zoom`, async ({ page }) => {
      // 320 px entsprechen 1280 px bei 400 % Zoom (WCAG 1.4.10)
      for (const viewportWidth of [390, 320]) {
        await page.setViewportSize({ width: viewportWidth, height: 800 });
        await page.goto(path);
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      }
    });
  }

  test("Kartenlisten: eine Spalte auf dem Handy, drei auf dem Desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/sehenswuerdigkeiten");
    const desktop = await columnsOfFirstGrid(page);
    test.skip(desktop === 0, "bydata nicht erreichbar, keine Karten");
    expect(desktop).toBe(3);

    await page.setViewportSize({ width: 390, height: 800 });
    expect(await columnsOfFirstGrid(page)).toBe(1);
  });

  test("Parken und E-Laden stehen auf dem Desktop nebeneinander", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/parken");
    const parken = page.getByRole("heading", { name: /^Parkplätze/ });
    test.skip(!(await parken.isVisible()), "bydata nicht erreichbar");
    const laden = page.getByRole("heading", { name: /^E-Ladesäulen/ });
    const [a, b] = [await parken.boundingBox(), await laden.boundingBox()];
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(b!.x).toBeGreaterThan(a!.x + 500);
  });

  test("Chat-Demonstrator bleibt schmal", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/");
    expect(await width(page, "details#chat")).toBeLessThanOrEqual(768);
  });

  test("Druckansicht ohne Navigation und Footer", async ({ page }) => {
    await page.goto("/essen-trinken");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("link", { name: /Zur Startseite/ })).toBeHidden();
    await expect(page.locator("footer")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
