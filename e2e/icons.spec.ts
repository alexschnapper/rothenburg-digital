import { expect, test } from "@playwright/test";

/**
 * Favicon und App-Icons (#89). Unter Plesk biegt Apache `/icons/` auf seine
 * eigenen Symbole um, deshalb liegen die Icons in `/app-icons/`. Ob sie auf
 * dem Server ankommen, zeigt nur `dev.rothenburg.digital`; hier wird
 * geprüft, dass alle Verweise auf vorhandene Dateien außerhalb von `/icons/`
 * zeigen.
 */
test.describe("Favicon und App-Icons (#89)", () => {
  test("Seite verweist nur auf vorhandene Icons unter /app-icons/", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/app-icons\//);
      expect((await request.get(href)).status()).toBe(200);
    }
  });

  test("Manifest verweist nur auf vorhandene Icons unter /app-icons/", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons as { src: string }[]) {
      expect(icon.src).toMatch(/^\/app-icons\//);
      expect((await request.get(icon.src)).status()).toBe(200);
    }
  });
});
