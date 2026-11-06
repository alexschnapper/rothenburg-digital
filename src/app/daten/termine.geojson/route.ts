import { geojsonResponse } from "@/lib/opendata/feedResponse";

/** GeoJSON-Feed (#36), Aufbau in `src/lib/opendata/feeds.ts`. */
export function GET(request: Request) {
  return geojsonResponse("termine", request);
}
