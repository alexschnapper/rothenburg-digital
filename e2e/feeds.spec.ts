import { expect, test } from "@playwright/test";

/**
 * Feeds zum Weiterverwenden (#81). Die Daten kommen serverseitig von bydata,
 * `page.route()` greift dort nicht: Ist bydata nicht erreichbar, antworten
 * die GeoJSON-Feeds mit 503, und die inhaltlichen Prüfungen entfallen.
 */
const FEEDS = ["parken", "notfall-hitze", "essen-trinken", "einkaufen", "sehenswuerdigkeiten"];
/** Mit den Terminen (#36); die können je nach Jahreszeit auch leer sein. */
const ALL_FEEDS = [...FEEDS, "termine"];

test.describe("Feeds (#81)", () => {
  for (const name of FEEDS) {
    test(`${name}.geojson: FeatureCollection mit Lizenz, CORS und Cache`, async ({ request }) => {
      const response = await request.get(`/daten/${name}.geojson`);
      if (response.status() === 503) {
        expect(response.headers()["retry-after"]).toBeTruthy();
        test.skip(true, "bydata nicht erreichbar");
      }
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/geo+json");
      expect(response.headers()["access-control-allow-origin"]).toBe("*");
      expect(response.headers()["cache-control"]).toContain("max-age=3600");

      const geojson = await response.json();
      expect(geojson.type).toBe("FeatureCollection");
      expect(geojson.attribution).toContain("Aufbereitet von rothenburg.digital");
      expect(geojson.features.length).toBeGreaterThan(0);
      for (const feature of geojson.features) {
        expect(feature.type).toBe("Feature");
        expect(feature.properties.source_url).toMatch(/^https:\/\/rothenburg\.bydata\.de\//);
        if (feature.geometry) {
          const [lon, lat] = feature.geometry.coordinates;
          // Länge vor Breite (RFC 7946), im Gebiet um Rothenburg
          expect(lon).toBeGreaterThan(10);
          expect(lat).toBeGreaterThan(49);
        }
      }
    });
  }

  test("Katalog: DCAT-AP mit allen Feeds", async ({ request }) => {
    const response = await request.get("/daten/katalog.jsonld");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/ld+json");
    const catalog = await response.json();
    expect(catalog["@type"]).toBe("dcat:Catalog");
    // Je Datensatz eine Liste von Distributionen: GeoJSON, bei Terminen dazu iCalendar.
    const downloads = catalog["dcat:dataset"].flatMap(
      (dataset: { "dcat:distribution": { "dcat:downloadURL": { "@id": string } }[] }) =>
        dataset["dcat:distribution"].map((distribution) => new URL(distribution["dcat:downloadURL"]["@id"]).pathname),
    );
    expect(downloads).toEqual(
      ALL_FEEDS.flatMap((name) => [`/daten/${name}.geojson`, ...(name === "termine" ? ["/daten/termine.ics"] : [])]),
    );
  });

  test("termine.ics: Kalender zum Abonnieren (#36)", async ({ request }) => {
    const response = await request.get("/daten/termine.ics");
    if (response.status() === 503) test.skip(true, "bydata nicht erreichbar");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");
    expect(response.headers()["access-control-allow-origin"]).toBe("*");
    const ics = await response.text();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });

  test("termine.geojson: FeatureCollection mit Datum (#36)", async ({ request }) => {
    const response = await request.get("/daten/termine.geojson");
    if (response.status() === 503) test.skip(true, "bydata nicht erreichbar");
    expect(response.status()).toBe(200);
    const geojson = await response.json();
    expect(geojson.type).toBe("FeatureCollection");
    for (const feature of geojson.features) expect(feature.properties).toHaveProperty("start_date");
  });

  test("Bereichsseite: schema.org und Link auf den Feed", async ({ page }) => {
    await page.goto("/parken");
    const feedLink = page.getByRole("link", { name: "diese Daten als GeoJSON" });
    test.skip(!(await feedLink.isVisible()), "bydata nicht erreichbar");
    await expect(feedLink).toHaveAttribute("href", "/daten/parken.geojson");
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@graph"][0]["@type"]).toBe("Dataset");
  });

  test("/daten listet alle Feeds und den Katalog", async ({ page }) => {
    await page.goto("/daten#feeds");
    const section = page.locator("#feeds");
    await expect(section.getByRole("heading", { name: "Daten weiterverwenden" })).toBeVisible();
    for (const name of ALL_FEEDS) {
      await expect(section.locator(`a[href="/daten/${name}.geojson"]`)).toBeVisible();
    }
    await expect(section.locator('a[href="/daten/termine.ics"]')).toBeVisible();
    await expect(section.getByRole("link", { name: "Katalog aller Feeds" })).toBeVisible();
  });

  test("Tippfehler unter /daten/ zeigt weiter die deutsche 404-Seite", async ({ page }) => {
    const response = await page.goto("/daten/parkn.geojson");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
