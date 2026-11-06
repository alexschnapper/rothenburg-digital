import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { Dataset } from "@/lib/opendata/bydata";
import { coordinates, type SourceInfo } from "@/lib/opendata/common";
import {
  FEED_NAMES,
  feedAttribution,
  feedLicense,
  jsonLdScript,
  parkingFeed,
  shopFeed,
  siteOrigin,
  toCatalog,
  toGeoJson,
  toSchemaOrg,
} from "@/lib/opendata/feeds";
import { toParkingData } from "@/lib/opendata/parking";
import { toShopData } from "@/lib/opendata/shopping";

const ORIGIN = "https://dev.rothenburg.digital";

const dataset = (id: string, items: unknown[], license: string | null, url: string | null = null): Dataset => ({
  id,
  items,
  modified: "2026-10-13",
  pageUrl: `https://rothenburg.bydata.de/datasets/${id}?locale=de`,
  license: license ? { label: license, url } : null,
  fetchedAt: new Date(),
});

const item = (id: string, name: string, street: string, lat = 49.377, lon = 10.179) => ({
  id,
  name,
  types: "Souvenirladen",
  topics: "",
  short_description: "",
  description: "",
  street,
  postal_code: "91541",
  city: "Rothenburg ob der Tauber",
  lat,
  lon,
  opening_hours: "Mo, Di, Mi, Do, Fr, Sa 10:00-18:00",
  contact_phone: "",
  url: "",
  features: "",
  payment: "",
});

const shops = shopFeed(
  toShopData([
    {
      dataset: dataset(
        "skg-venus-einkaufsmoeglichkeiten",
        [
          // Zwei Straßen auf einem Punkt: der Punkt taugt nicht (#66).
          item("a", "Laden A", "Herrngasse 1", 49.3771, 10.1786),
          item("b", "Laden B", "Marktplatz 7", 49.3771, 10.1786),
          item("c", "Laden C", "Hafengasse 3", 49.3765, 10.1801),
          // Weit außerhalb: vertauschte Koordinaten
          item("d", "Laden D", "Galgengasse 5", 10.18, 49.37),
        ],
        "CC BY-SA 4.0",
        "https://creativecommons.org/licenses/by-sa/4.0/",
      ),
      label: "Einkaufsmöglichkeiten",
    },
    { dataset: dataset("skg-venus-einzelhandel", [], "CC BY-SA 4.0"), label: "Einzelhandel" },
    { dataset: dataset("skg-venus-handmade", [], "CC BY 4.0"), label: "Handmade" },
    {
      dataset: dataset("skg-venus-direktvermarkter-popup-rothenburg", [item("p", "Pop-up", "Rödergasse 2")], "CC0"),
      label: "Direktvermarkter Pop-up",
    },
  ]),
);

const parking = parkingFeed(
  toParkingData(
    dataset("skg-venus-parkplaetze", [{ ...item("p4", "Parkplatz P4 Rothenburg ob der Tauber", "Galgengasse"), types: "Parkplatz; Wohnmobilstellplatz" }], "CC0", "https://creativecommons.org/publicdomain/zero/1.0/"),
    dataset("skg-venus-e-ladesaeulen", [{ ...item("e1", "E-Ladesäule Kapellenplatz", "Kapellenplatz"), types: "Ladestation" }], "CC0"),
  ),
);

// ─── GeoJSON nach RFC 7946 ─────────────────────────────────────────────────

/** Position: Länge, Breite (3.1.1), im Wertebereich von WGS 84. */
const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const geoJsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z
      .object({
        type: z.literal("Feature"),
        id: z.union([z.string(), z.number()]).optional(),
        // 3.2: geometry ist ein Geometrie-Objekt oder null
        geometry: z.union([z.object({ type: z.literal("Point"), coordinates: position }).strict(), z.null()]),
        // 3.2: properties ist ein Objekt oder null
        properties: z.union([z.record(z.string(), z.unknown()), z.null()]),
      })
      .strict(),
  ),
});

describe("GeoJSON", () => {
  const geojson = toGeoJson(shops, ORIGIN);

  it("ist eine gültige FeatureCollection nach RFC 7946", () => {
    expect(() => geoJsonSchema.parse(geojson)).not.toThrow();
    // Durch JSON hin und zurück: keine `undefined`, keine Sonderwerte
    expect(JSON.parse(JSON.stringify(geojson))).toEqual(geojson);
  });

  it("gibt Punkte nur, wenn sie taugen; der Eintrag bleibt mit Adresse", () => {
    const byId = Object.fromEntries(geojson.features.map((feature) => [feature.id, feature]));
    expect(byId.a.geometry).toBeNull();
    expect(byId.b.geometry).toBeNull();
    expect(byId.c.geometry).toEqual({ type: "Point", coordinates: [10.1801, 49.3765] });
    expect(byId.d.geometry).toBeNull();
    expect(byId.d.properties.address).toBe("Galgengasse 5, 91541 Rothenburg ob der Tauber");
  });

  it("nennt Lizenz und Quelle an jedem Eintrag", () => {
    const popup = geojson.features.find((feature) => feature.id === "p")!;
    expect(popup.properties).toMatchObject({ license: "CC0", source: "Direktvermarkter Pop-up" });
    const laden = geojson.features.find((feature) => feature.id === "c")!;
    expect(laden.properties).toMatchObject({
      license: "CC BY-SA 4.0",
      license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
      source_url: "https://rothenburg.bydata.de/datasets/skg-venus-einkaufsmoeglichkeiten?locale=de",
      opening_hours: ["Mo–Sa 10:00–18:00 Uhr", "So geschlossen"],
    });
  });

  it("verweist auf die eigene Seite der Herkunft", () => {
    expect(geojson.page).toBe(`${ORIGIN}/einkaufen`);
  });
});

describe("Lizenz", () => {
  const source = (label: string | null): SourceInfo => ({
    label: "x",
    url: "https://rothenburg.bydata.de/datasets/x",
    modified: null,
    license: label ? { label, url: null } : null,
  });

  it("ein gemischter Feed steht unter der strengsten Lizenz (Share-Alike)", () => {
    expect(feedLicense([source("CC0"), source("CC BY-SA 4.0"), source("CC BY 4.0")])?.label).toBe("CC BY-SA 4.0");
    expect(feedLicense([source("CC0"), source("CC BY 4.0")])?.label).toBe("CC BY 4.0");
    expect(feedLicense([source("CC0")])?.label).toBe("CC0");
    expect(toGeoJson(shops, ORIGIN).license?.name).toBe("CC BY-SA 4.0");
  });

  it("ohne oder mit unbekannter Lizenz einer Quelle: keine Feed-Lizenz", () => {
    expect(feedLicense([source("CC0"), source(null)])).toBeNull();
    expect(feedLicense([source("Datenlizenz Deutschland 2.0")])).toBeNull();
  });

  it("Namensnennung mit Quellen und Hinweis auf die Bearbeitung", () => {
    const text = feedAttribution(shops);
    expect(text).toContain("„Einkaufsmöglichkeiten“ (CC BY-SA 4.0)");
    expect(text).toContain("„Direktvermarkter Pop-up“ (CC0)");
    expect(text).toContain("Aufbereitet von rothenburg.digital");
  });
});

describe("schema.org", () => {
  it("Dataset mit Lizenz und GeoJSON, ItemList mit Typ und Koordinaten", () => {
    const [ds, list] = toSchemaOrg(parking, ORIGIN)["@graph"] as Record<string, unknown>[];
    expect(ds).toMatchObject({
      "@type": "Dataset",
      license: "https://creativecommons.org/publicdomain/zero/1.0/",
      distribution: { encodingFormat: "application/geo+json", contentUrl: `${ORIGIN}/daten/parken.geojson` },
    });
    expect(list).toMatchObject({ "@type": "ItemList", numberOfItems: 2 });
    expect((list.itemListElement as { item: unknown }[])[0].item).toMatchObject({
      "@type": "ParkingFacility",
      name: "Parkplatz P4 Rothenburg ob der Tauber",
      geo: { latitude: 49.377, longitude: 10.179 },
    });
  });

  it("kann kein `</script>` erzeugen", () => {
    expect(jsonLdScript({ name: "</script><script>alert(1)</script>" })).not.toContain("<");
  });
});

// ─── DCAT-AP ───────────────────────────────────────────────────────────────

const literal = z.object({ "@language": z.string(), "@value": z.string().min(1) });
const ref = z.object({ "@id": z.string().url() });
/** Verknüpfte Adresse mit Typ — sonst meldet das Profil „Ranges“ einen Verstoß (#107). */
const typedRef = (type: string) => ref.extend({ "@type": z.literal(type) });

/**
 * Pflichtangaben nach DCAT-AP 3 für Katalog, Datensatz und Distribution,
 * samt Typen der verknüpften Adressen. Die offizielle Prüfung macht
 * `npm run dcat:pruefen`; dieses Schema ist die schnelle Prüfung ohne Netz.
 */
const catalogSchema = z.object({
  "@context": z.record(z.string(), z.string().url()),
  "@type": z.literal("dcat:Catalog"),
  "dct:title": literal,
  "dct:description": literal,
  "dct:publisher": typedRef("foaf:Agent").extend({ "foaf:name": z.string().min(1) }),
  "dct:language": typedRef("dct:LinguisticSystem"),
  "foaf:homepage": typedRef("foaf:Document"),
  "dcat:dataset": z.array(
    z.object({
      "@id": z.string().url(),
      "@type": z.literal("dcat:Dataset"),
      "dct:title": literal,
      "dct:description": literal,
      "dcat:theme": typedRef("skos:Concept").extend({ "skos:prefLabel": literal }),
      "dct:language": typedRef("dct:LinguisticSystem"),
      "dcat:landingPage": typedRef("foaf:Document"),
      "dcat:distribution": z.object({
        "@type": z.literal("dcat:Distribution"),
        "dcat:accessURL": ref,
        "dcat:downloadURL": ref,
        "dct:format": typedRef("dct:MediaTypeOrExtent"),
        "dcat:mediaType": typedRef("dct:MediaType"),
      }),
    }),
  ),
});

describe("DCAT-AP-Katalog", () => {
  it("enthält alle Feeds mit den Pflichtangaben", () => {
    const catalog = toCatalog({ parken: parking, einkaufen: shops }, ORIGIN);
    expect(() => catalogSchema.parse(catalog)).not.toThrow();
    expect(catalog["dcat:dataset"]).toHaveLength(FEED_NAMES.length);
  });

  it("Lizenz, Quellen und Stand nur, wenn der Feed geladen ist", () => {
    const catalog = toCatalog({ einkaufen: shops }, ORIGIN);
    const einkaufen = catalog["dcat:dataset"].find((ds) => ds["@id"].includes("einkaufen"))!;
    expect(einkaufen["dcat:distribution"]["dct:license"]).toEqual({
      "@id": "https://creativecommons.org/licenses/by-sa/4.0/",
      "@type": "dct:LicenseDocument",
    });
    expect(einkaufen["dcat:distribution"]["dct:rights"]).toMatchObject({
      "@type": "dct:RightsStatement",
      "rdfs:label": { "@language": "de", "@value": expect.stringContaining("Einkaufsmöglichkeiten") },
    });
    expect(einkaufen["dct:source"]).toContainEqual(
      expect.objectContaining({
        "@id": "https://open.bydata.de/api/hub/repo/datasets/skg-venus-einkaufsmoeglichkeiten",
        "@type": "dcat:Dataset",
        "dct:title": { "@language": "de", "@value": "Einkaufsmöglichkeiten" },
        "foaf:page": {
          "@id": "https://rothenburg.bydata.de/datasets/skg-venus-einkaufsmoeglichkeiten?locale=de",
          "@type": "foaf:Document",
        },
      }),
    );
    const parken = catalog["dcat:dataset"].find((ds) => ds["@id"].includes("parken"))!;
    expect(parken).not.toHaveProperty("dct:source");
    expect(parken["dcat:distribution"]).not.toHaveProperty("dct:license");
    expect(parken["dcat:distribution"]).not.toHaveProperty("dct:rights");
  });

  it("Herausgeber mit eigener Adresse, nicht als namenloser Knoten", () => {
    const catalog = toCatalog({}, ORIGIN);
    expect(catalog["dct:publisher"]["@id"]).toBe(`${ORIGIN}/daten#herausgeber`);
    for (const ds of catalog["dcat:dataset"]) expect(ds["dct:publisher"]["@id"]).toBe(`${ORIGIN}/daten#herausgeber`);
  });
});

describe("Hilfen", () => {
  it("Herkunft nur für bekannte Hosts, sonst die öffentliche Adresse", () => {
    expect(siteOrigin("dev.rothenburg.digital")).toBe("https://dev.rothenburg.digital");
    expect(siteOrigin("rothenburg.digital")).toBe("https://rothenburg.digital");
    expect(siteOrigin("localhost:3000")).toBe("http://localhost:3000");
    expect(siteOrigin("evil.example")).toBe("https://rothenburg.digital");
    expect(siteOrigin("rothenburg.digital.evil.example")).toBe("https://rothenburg.digital");
    expect(siteOrigin(null)).toBe("https://rothenburg.digital");
  });

  it("Koordinaten in GeoJSON-Reihenfolge, gerundet, nur im Gebiet", () => {
    expect(coordinates(49.3771234567, 10.1786543)).toEqual([10.178654, 49.377123]);
    expect(coordinates(10.18, 49.37)).toBeNull();
  });
});
