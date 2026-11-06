import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Barrierefreiheit nach WCAG AAA, automatisch geprüft mit axe (#119). Jede
 * Seite hell und dunkel, dazu die statische Teaser-Seite, die auf Prod unter
 * `/` steht. Was axe nicht prüfen kann (Verständlichkeit, Tastaturabläufe,
 * Screenreader-Ansagen), ersetzt das nicht.
 *
 * Schlägt hier etwas fehl, nennt die Meldung Regel, Element und Kontrast.
 * Farben stehen in `public/design/tokens.css`.
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
  "/datenschutz",
  "/teaser.html",
  "/gibt-es-nicht",
];

/** WCAG 2.0 bis 2.2, Stufen A bis AAA, u. a. `color-contrast-enhanced` (7:1). */
const TAGS = ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`WCAG AAA (${colorScheme === "light" ? "hell" : "dunkel"})`, () => {
    test.use({ colorScheme });

    for (const path of PAGES) {
      test(path, async ({ page }) => {
        await page.goto(path);
        // Webschrift abwarten, sonst misst axe mit der Ersatzschrift
        await page.evaluate(() => document.fonts.ready);
        const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const violations = result.violations.map((violation) => ({
          rule: violation.id,
          help: violation.help,
          targets: violation.nodes.map((node) => `${node.target.join(" ")}: ${node.failureSummary?.split("\n").at(-1)?.trim()}`),
        }));
        expect(violations).toEqual([]);
      });
    }
  });
}
