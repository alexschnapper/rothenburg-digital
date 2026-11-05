import { geojsonResponse } from "@/lib/opendata/feedResponse";

/** GeoJSON-Feed (#81), Aufbau in `src/lib/opendata/feeds.ts`. */
export function GET(request: Request) {
  return geojsonResponse("essen-trinken", request);
}
