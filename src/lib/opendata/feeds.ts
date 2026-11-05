import type { DatasetLicense } from "@/lib/opendata/bydata";
import { AREA, OPEN_DATA_SOURCE, type Coordinates, type SourceInfo } from "@/lib/opendata/common";
import { loadEmergencyData, type EmergencyData } from "@/lib/opendata/emergency";
import { loadParkingData, type ParkingData } from "@/lib/opendata/parking";
import { loadRestaurantData, type RestaurantData } from "@/lib/opendata/restaurants";
import { loadShopData, type ShopData } from "@/lib/opendata/shopping";
import { loadSightData, type SightData } from "@/lib/opendata/sights";

/**
 * Aufbereitete offene Daten als Standard-Feeds zurückgeben (Issue #81):
 * GeoJSON je Bereich, schema.org JSON-LD auf den Bereichsseiten und ein
 * DCAT-AP-Katalog, damit Portale die Feeds finden.
 *
 * Quelle sind dieselben `to…Data()`-Funktionen wie für Seiten und Chat:
 * bereinigte Namen und Adressen, lesbare Öffnungszeiten, Koordinaten nur,
 * wenn sie im Gebiet liegen und nicht mit einem Eintrag an anderer Straße
 * zusammenfallen (#66).
 *
 * Lizenz und Namensnennung kommen vom Quelldatensatz (#66) und stehen an
 * jedem Eintrag. CC BY-SA 4.0 verlangt, dass Ableitungen unter derselben
 * Lizenz stehen: Mischt ein Feed Datensätze, gilt für ihn die strengste
 * Lizenz (siehe `feedLicense`).
 */

export type FeedName = "parken" | "notfall-hitze" | "essen-trinken" | "einkaufen" | "sehenswuerdigkeiten";

export const FEED_NAMES: FeedName[] = [
  "parken",
  "notfall-hitze",
  "essen-trinken",
  "einkaufen",
  "sehenswuerdigkeiten",
];

/** Ein Eintrag im Feed, unabhängig vom Bereich. */
export type FeedEntry = {
  id: string;
  name: string;
  /** Deutsch, z. B. „Parkplatz“, „Trinkbrunnen“ */
  category: string;
  /** schema.org-Typ für JSON-LD, z. B. `ParkingFacility` */
  schemaType: string;
  description: string;
  address: string;
  coordinates: Coordinates | null;
  website: string | null;
  openingHours: string[];
  /** Namensnennung aus dem Eintrag selbst, wenn die Daten eine nennen */
  attribution: string | null;
  source: SourceInfo;
};

export type Feed = {
  name: FeedName;
  title: string;
  description: string;
  /** Eigene Seite des Bereichs */
  page: string;
  keywords: string[];
  /** EU-Datenthema (DCAT-AP), z. B. `TRAN` */
  theme: string;
  entries: FeedEntry[];
  sources: SourceInfo[];
};

type FeedInfo = Omit<Feed, "entries" | "sources" | "name">;

export const FEED_INFO: Record<FeedName, FeedInfo> = {
  parken: {
    title: "Parkplätze und E-Ladesäulen in Rothenburg ob der Tauber",
    description:
      "Parkplätze, Wohnmobilstellplätze und E-Ladesäulen mit Adresse, Ausstattung und Bezahlung, aus den offenen Daten der Stadt aufbereitet.",
    page: "/parken",
    keywords: ["Parken", "Parkplatz", "Wohnmobil", "E-Ladesäule", "Elektromobilität"],
    theme: "TRAN",
  },
  "notfall-hitze": {
    title: "Defibrillatoren, Trinkbrunnen und kühle Orte in Rothenburg ob der Tauber",
    description:
      "Standorte öffentlich zugänglicher Defibrillatoren sowie Trinkbrunnen und kühle Orte bei Hitze, aus den offenen Daten der Stadt aufbereitet.",
    page: "/notfall-hitze",
    keywords: ["Defibrillator", "AED", "Trinkbrunnen", "Hitze", "Hitzeschutz"],
    theme: "HEAL",
  },
  "essen-trinken": {
    title: "Gastronomie in Rothenburg ob der Tauber",
    description:
      "Restaurants, Cafés und Bäckereien mit Adresse, Art der Küche und lesbaren Öffnungszeiten, aus den offenen Daten der Stadt aufbereitet.",
    page: "/essen-trinken",
    keywords: ["Gastronomie", "Restaurant", "Café", "Öffnungszeiten"],
    theme: "ECON",
  },
  einkaufen: {
    title: "Einkaufen in Rothenburg ob der Tauber",
    description:
      "Geschäfte, Kunsthandwerk und Direktvermarkter mit Adresse und lesbaren Öffnungszeiten, aus mehreren Datensätzen der Stadt zusammengeführt und ohne Dubletten.",
    page: "/einkaufen",
    keywords: ["Einkaufen", "Einzelhandel", "Kunsthandwerk", "Direktvermarkter", "Öffnungszeiten"],
    theme: "ECON",
  },
  sehenswuerdigkeiten: {
    title: "Sehenswürdigkeiten in Rothenburg ob der Tauber",
    description:
      "Türme, Tore, Plätze, Museen und Orte jüdischer Geschichte mit Adresse und Beschreibung, aus den offenen Daten der Stadt aufbereitet.",
    page: "/sehenswuerdigkeiten",
    keywords: ["Sehenswürdigkeit", "Tourismus", "Stadtmauer", "Museum", "Kultur"],
    theme: "EDUC",
  },
};

const feed = (name: FeedName, entries: FeedEntry[], sources: SourceInfo[]): Feed => ({
  name,
  ...FEED_INFO[name],
  entries,
  sources,
});

// ─── Aus den Bereichsdaten ─────────────────────────────────────────────────

export function parkingFeed(data: ParkingData): Feed {
  const [parkingSource, chargingSource] = data.sources;
  const entries: FeedEntry[] = [
    ...data.parking.map((place) => ({
      id: place.id,
      name: place.name,
      category: place.camper ? "Parkplatz, auch für Wohnmobile" : "Parkplatz",
      schemaType: "ParkingFacility",
      description: place.description,
      address: place.address,
      coordinates: place.coordinates,
      website: place.website,
      openingHours: [],
      attribution: null,
      source: parkingSource,
    })),
    ...data.charging.map((place) => ({
      id: place.id,
      name: place.name,
      category: "E-Ladesäule",
      schemaType: "Place",
      description: place.description,
      address: place.address,
      coordinates: place.coordinates,
      website: place.website,
      openingHours: [],
      attribution: null,
      source: chargingSource,
    })),
  ];
  return feed("parken", entries, data.sources);
}

export function emergencyFeed(data: EmergencyData): Feed {
  const [defiSource, heatSource] = data.sources;
  const entries = [
    ...data.defibrillators.map((spot) => ({ spot, source: defiSource })),
    ...data.heat.map((spot) => ({ spot, source: heatSource })),
  ].map(({ spot, source }) => ({
    id: spot.id,
    name: spot.name,
    category: spot.kind,
    schemaType: "Place",
    description: spot.description,
    address: spot.address,
    coordinates: spot.coordinates,
    website: null,
    openingHours: spot.hoursLines,
    attribution: null,
    source,
  }));
  return feed("notfall-hitze", entries, data.sources);
}

export function restaurantFeed(data: RestaurantData): Feed {
  const entries = data.restaurants.map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
    category: [...restaurant.types, ...restaurant.cuisine].join(", ") || "Gastronomie",
    schemaType: restaurant.types.some((type) => /café|bäckerei/i.test(type)) ? "CafeOrCoffeeShop" : "Restaurant",
    description: restaurant.description,
    address: restaurant.address,
    coordinates: restaurant.coordinates,
    website: restaurant.website,
    openingHours: restaurant.hoursLines,
    attribution: null,
    source: data.source,
  }));
  return feed("essen-trinken", entries, [data.source]);
}

export function shopFeed(data: ShopData): Feed {
  const entries = data.shops.map((shop) => ({
    id: shop.id,
    name: shop.name,
    category: shop.types.join(", ") || "Geschäft",
    schemaType: "Store",
    description: shop.description,
    address: shop.address,
    coordinates: shop.coordinates,
    website: shop.website,
    openingHours: shop.hoursLines,
    attribution: null,
    source: shop.source,
  }));
  return feed("einkaufen", entries, data.sources);
}

export function sightFeed(data: SightData): Feed {
  const entries = data.sights.map((sight) => ({
    id: sight.id,
    name: sight.name,
    category: sight.types.join(", ") || "Sehenswürdigkeit",
    schemaType: "TouristAttraction",
    description: sight.description,
    address: sight.address,
    coordinates: sight.coordinates,
    website: null,
    openingHours: sight.openingHours ? [sight.openingHours] : [],
    attribution: sight.attribution,
    source: data.source,
  }));
  return feed("sehenswuerdigkeiten", entries, [data.source]);
}

/** Feed laden; `null`, wenn die Daten gerade nicht abrufbar sind. */
export async function loadFeed(name: FeedName): Promise<Feed | null> {
  switch (name) {
    case "parken": {
      const data = await loadParkingData();
      return data && parkingFeed(data);
    }
    case "notfall-hitze": {
      const data = await loadEmergencyData();
      return data && emergencyFeed(data);
    }
    case "essen-trinken": {
      const data = await loadRestaurantData();
      return data && restaurantFeed(data);
    }
    case "einkaufen": {
      const data = await loadShopData();
      return data && shopFeed(data);
    }
    case "sehenswuerdigkeiten": {
      const data = await loadSightData();
      return data && sightFeed(data);
    }
  }
}

// ─── Lizenz ────────────────────────────────────────────────────────────────

/** Je strenger, desto höher. Unbekannte Lizenzen lassen sich nicht einordnen. */
function licenseRank(license: DatasetLicense | null): number | null {
  if (!license) return null;
  const label = license.label.toUpperCase();
  if (/BY-SA/.test(label)) return 3;
  if (/\bBY\b/.test(label)) return 2;
  if (/CC0|ZERO/.test(label)) return 1;
  return null;
}

/**
 * Lizenz des ganzen Feeds: die strengste seiner Quellen. Ein Feed aus CC0
 * und CC BY-SA 4.0 steht also unter CC BY-SA 4.0 (Share-Alike). `null`, wenn
 * eine Quelle keine oder eine unbekannte Lizenz hat — dann gilt nur die
 * Angabe am Eintrag.
 */
export function feedLicense(sources: SourceInfo[]): DatasetLicense | null {
  let strictest: { rank: number; license: DatasetLicense } | null = null;
  for (const source of sources) {
    const rank = licenseRank(source.license);
    if (rank === null) return null;
    if (!strictest || rank > strictest.rank) strictest = { rank, license: source.license! };
  }
  return strictest?.license ?? null;
}

/** Namensnennung samt Hinweis auf die Bearbeitung, wie CC BY sie verlangt. */
export function feedAttribution(feed: Feed): string {
  const sources = feed.sources
    .map((source) => `„${source.label}“${source.license ? ` (${source.license.label})` : ""}`)
    .join(", ");
  return (
    `${OPEN_DATA_SOURCE}, über das bayerische Open-Data-Portal bydata: ${sources}. ` +
    "Aufbereitet von rothenburg.digital: Namen und Adressen bereinigt, Beschreibungen gekürzt, Öffnungszeiten lesbar gemacht, unplausible Koordinaten entfernt."
  );
}

/** Jüngster Stand der Quellen, `YYYY-MM-DD`. */
const newest = (sources: SourceInfo[]) =>
  sources
    .map((source) => source.modified)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1) ?? null;

// ─── Adresse der Seite ─────────────────────────────────────────────────────

const PUBLIC_ORIGIN = "https://rothenburg.digital";

/**
 * Herkunft für absolute Links in den Feeds. Aus der Anfrage, damit dev und
 * staging auf sich selbst verweisen — aber nur für bekannte Hosts: Ein
 * gefälschter `Host`-Header soll keine fremden Adressen in die Feeds
 * schreiben. Alles andere wird zur öffentlichen Adresse.
 */
export function siteOrigin(host: string | null, forwardedProto: string | null = null): string {
  if (!host) return PUBLIC_ORIGIN;
  const name = host.toLowerCase();
  if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(name)) {
    return `${forwardedProto === "https" ? "https" : "http"}://${name}`;
  }
  if (/^([a-z0-9-]+\.)?rothenburg\.digital$/.test(name)) return `https://${name}`;
  return PUBLIC_ORIGIN;
}

export const feedPath = (name: FeedName) => `/daten/${name}.geojson`;
export const CATALOG_PATH = "/daten/katalog.jsonld";

// ─── GeoJSON (RFC 7946) ────────────────────────────────────────────────────

/**
 * FeatureCollection mit einem Feature je Eintrag. Ohne verlässlichen Punkt
 * ist `geometry` `null` (RFC 7946, 3.2) — der Eintrag bleibt mit Adresse
 * drin. Lizenz, Namensnennung und Quellen als „foreign members“ (6.1).
 */
export function toGeoJson(feed: Feed, origin: string) {
  const license = feedLicense(feed.sources);
  return {
    type: "FeatureCollection" as const,
    name: feed.title,
    description: feed.description,
    license: license ? { name: license.label, url: license.url } : null,
    attribution: feedAttribution(feed),
    modified: newest(feed.sources),
    page: `${origin}${feed.page}`,
    sources: feed.sources.map((source) => ({
      title: source.label,
      url: source.url,
      modified: source.modified,
      license: source.license ? { name: source.license.label, url: source.license.url } : null,
    })),
    features: feed.entries.map((entry) => ({
      type: "Feature" as const,
      id: entry.id,
      geometry: entry.coordinates ? { type: "Point" as const, coordinates: entry.coordinates } : null,
      properties: {
        name: entry.name,
        category: entry.category,
        description: entry.description || null,
        address: entry.address || null,
        website: entry.website,
        opening_hours: entry.openingHours.length > 0 ? entry.openingHours : null,
        source: entry.source.label,
        source_url: entry.source.url,
        license: entry.source.license?.label ?? null,
        license_url: entry.source.license?.url ?? null,
        attribution: entry.attribution,
      },
    })),
  };
}

// ─── schema.org JSON-LD für die Bereichsseiten ─────────────────────────────

/**
 * Ein `Dataset` (mit Lizenz, Quellen und Verweis auf den GeoJSON-Feed) und
 * eine `ItemList` der Orte. Nur Text aus den aufbereiteten Daten; vor dem
 * Einbetten `<` maskieren (`jsonLdScript`).
 */
export function toSchemaOrg(feed: Feed, origin: string) {
  const license = feedLicense(feed.sources);
  const datasetId = `${origin}${feedPath(feed.name)}#dataset`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        "@id": datasetId,
        name: feed.title,
        description: feed.description,
        url: `${origin}${feed.page}`,
        keywords: feed.keywords,
        inLanguage: "de",
        ...(license?.url ? { license: license.url } : {}),
        creditText: feedAttribution(feed),
        isBasedOn: feed.sources.map((source) => source.url),
        ...(newest(feed.sources) ? { dateModified: newest(feed.sources) } : {}),
        spatialCoverage: { "@type": "Place", name: "Rothenburg ob der Tauber" },
        creator: { "@type": "Organization", name: "rothenburg.digital (OK Lab Rothenburg)", url: origin },
        distribution: {
          "@type": "DataDownload",
          encodingFormat: "application/geo+json",
          contentUrl: `${origin}${feedPath(feed.name)}`,
        },
      },
      {
        "@type": "ItemList",
        name: feed.title,
        isPartOf: { "@id": datasetId },
        numberOfItems: feed.entries.length,
        itemListElement: feed.entries.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": entry.schemaType,
            name: entry.name,
            ...(entry.description ? { description: entry.description } : {}),
            ...(entry.address ? { address: entry.address } : {}),
            ...(entry.website ? { url: entry.website } : {}),
            ...(entry.coordinates
              ? {
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: entry.coordinates[1],
                    longitude: entry.coordinates[0],
                  },
                }
              : {}),
          },
        })),
      },
    ],
  };
}

/** JSON für `<script type="application/ld+json">`: `<` maskiert, damit kein `</script>` entsteht. */
export const jsonLdScript = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

// ─── DCAT-AP-Katalog ───────────────────────────────────────────────────────

const EU = "http://publications.europa.eu/resource/authority";

/** Gebiet als WKT-Polygon für `dcat:bbox` (Länge Breite, gegen den Uhrzeigersinn). */
const AREA_WKT =
  `POLYGON((${AREA.lonMin} ${AREA.latMin}, ${AREA.lonMax} ${AREA.latMin}, ` +
  `${AREA.lonMax} ${AREA.latMax}, ${AREA.lonMin} ${AREA.latMax}, ${AREA.lonMin} ${AREA.latMin}))`;

const PUBLISHER = {
  "@type": "foaf:Agent",
  "foaf:name": "rothenburg.digital (OK Lab Rothenburg)",
};

const CONTACT = {
  "@type": "vcard:Organization",
  "vcard:fn": "rothenburg.digital",
  "vcard:hasURL": { "@id": "https://github.com/alexschnapper/rothenburg-digital/issues" },
};

/**
 * DCAT-AP-Katalog als JSON-LD: ein `dcat:Dataset` je Feed mit Distribution
 * (GeoJSON), Lizenz, Quellen (`dct:source`) und Gebiet. Pflichtangaben nach
 * DCAT-AP: Katalog mit Titel, Beschreibung, Herausgeber und Datensätzen;
 * Datensatz mit Titel und Beschreibung; Distribution mit `dcat:accessURL`.
 *
 * `feeds` darf Lücken haben (Daten gerade nicht abrufbar): Der Datensatz
 * steht trotzdem im Katalog, nur ohne Lizenz und Stand.
 */
export function toCatalog(feeds: Partial<Record<FeedName, Feed>>, origin: string) {
  const dates = FEED_NAMES.map((name) => feeds[name])
    .filter((feed): feed is Feed => Boolean(feed))
    .flatMap((feed) => feed.sources);
  return {
    "@context": {
      dcat: "http://www.w3.org/ns/dcat#",
      dct: "http://purl.org/dc/terms/",
      foaf: "http://xmlns.com/foaf/0.1/",
      vcard: "http://www.w3.org/2006/vcard/ns#",
      locn: "http://www.w3.org/ns/locn#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
      gsp: "http://www.opengis.net/ont/geosparql#",
    },
    "@id": `${origin}${CATALOG_PATH}`,
    "@type": "dcat:Catalog",
    "dct:title": { "@language": "de", "@value": "Aufbereitete offene Daten für Rothenburg ob der Tauber" },
    "dct:description": {
      "@language": "de",
      "@value":
        "Feeds von rothenburg.digital: offene Daten der Stadt Rothenburg ob der Tauber, geprüft, bereinigt und in Standardformaten. Lizenz je Datensatz nach der Quelle.",
    },
    "dct:publisher": PUBLISHER,
    "foaf:homepage": { "@id": `${origin}/daten` },
    "dct:language": { "@id": `${EU}/language/DEU` },
    ...(newest(dates) ? { "dct:modified": { "@type": "xsd:date", "@value": newest(dates) } } : {}),
    "dcat:dataset": FEED_NAMES.map((name) => {
      const info = FEED_INFO[name];
      const feed = feeds[name];
      const license = feed ? feedLicense(feed.sources) : null;
      const modified = feed ? newest(feed.sources) : null;
      const download = `${origin}${feedPath(name)}`;
      return {
        "@id": `${download}#dataset`,
        "@type": "dcat:Dataset",
        "dct:identifier": download,
        "dct:title": { "@language": "de", "@value": info.title },
        "dct:description": { "@language": "de", "@value": info.description },
        "dcat:keyword": info.keywords.map((keyword) => ({ "@language": "de", "@value": keyword })),
        "dcat:theme": { "@id": `${EU}/data-theme/${info.theme}` },
        "dct:publisher": PUBLISHER,
        "dcat:contactPoint": CONTACT,
        "dct:language": { "@id": `${EU}/language/DEU` },
        "dcat:landingPage": { "@id": `${origin}${info.page}` },
        "dct:spatial": {
          "@type": "dct:Location",
          "locn:geographicName": "Rothenburg ob der Tauber",
          "dcat:bbox": { "@type": "gsp:wktLiteral", "@value": AREA_WKT },
        },
        ...(feed ? { "dct:source": feed.sources.map((source) => ({ "@id": source.url })) } : {}),
        ...(modified ? { "dct:modified": { "@type": "xsd:date", "@value": modified } } : {}),
        "dcat:distribution": {
          "@id": `${download}#geojson`,
          "@type": "dcat:Distribution",
          "dct:title": { "@language": "de", "@value": `${info.title} (GeoJSON)` },
          "dcat:accessURL": { "@id": download },
          "dcat:downloadURL": { "@id": download },
          "dcat:mediaType": { "@id": "https://www.iana.org/assignments/media-types/application/geo+json" },
          "dct:format": { "@id": `${EU}/file-type/GEOJSON` },
          ...(license?.url ? { "dct:license": { "@id": license.url } } : {}),
          ...(feed ? { "dct:rights": { "@language": "de", "@value": feedAttribution(feed) } } : {}),
        },
      };
    }),
  };
}
