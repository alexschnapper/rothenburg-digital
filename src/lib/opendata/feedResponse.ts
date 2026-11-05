import {
  CATALOG_PATH,
  FEED_NAMES,
  feedPath,
  loadFeed,
  siteOrigin,
  toCatalog,
  toGeoJson,
  type Feed,
  type FeedName,
} from "@/lib/opendata/feeds";

/**
 * Antworten der Feed-Routen unter `/daten/…` (#81). Offene Daten sollen
 * andere Systeme direkt übernehmen können: deshalb CORS für alle Herkünfte
 * und eine Stunde Cache. bydata selbst wird ohnehin höchstens alle sechs
 * Stunden abgefragt (`loadDataset`).
 */
const HEADERS = {
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  "Access-Control-Allow-Origin": "*",
  "X-Content-Type-Options": "nosniff",
};

const originOf = (request: Request) =>
  siteOrigin(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    request.headers.get("x-forwarded-proto"),
  );

const unavailable = () =>
  new Response("Die Daten sind gerade nicht abrufbar. Bitte später erneut versuchen.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store" },
  });

export async function geojsonResponse(name: FeedName, request: Request): Promise<Response> {
  const feed = await loadFeed(name);
  if (!feed) return unavailable();
  return new Response(JSON.stringify(toGeoJson(feed, originOf(request))), {
    headers: {
      ...HEADERS,
      "Content-Type": "application/geo+json; charset=utf-8",
      "Content-Disposition": `inline; filename="${feedPath(name).split("/").pop()}"`,
    },
  });
}

export async function catalogResponse(request: Request): Promise<Response> {
  const loaded = await Promise.all(FEED_NAMES.map(async (name) => [name, await loadFeed(name)] as const));
  const feeds: Partial<Record<FeedName, Feed>> = {};
  for (const [name, feed] of loaded) if (feed) feeds[name] = feed;
  return new Response(JSON.stringify(toCatalog(feeds, originOf(request))), {
    headers: {
      ...HEADERS,
      "Content-Type": "application/ld+json; charset=utf-8",
      "Content-Disposition": `inline; filename="${CATALOG_PATH.split("/").pop()}"`,
    },
  });
}
