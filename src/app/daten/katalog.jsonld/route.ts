import { catalogResponse } from "@/lib/opendata/feedResponse";

/** DCAT-AP-Katalog der Feeds (#81), Aufbau in `src/lib/opendata/feeds.ts`. */
export function GET(request: Request) {
  return catalogResponse(request);
}
