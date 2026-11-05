import { headers } from "next/headers";

import { jsonLdScript, siteOrigin, toSchemaOrg, type Feed } from "@/lib/opendata/feeds";

/**
 * schema.org JSON-LD für eine Bereichsseite (#81): der Datensatz mit Lizenz
 * und Verweis auf den GeoJSON-Feed, dazu die Orte als Liste. Suchmaschinen
 * und Knowledge Graphs lesen das, auf der Seite ist es unsichtbar.
 */
export default async function FeedJsonLd({ feed }: { feed: Feed }) {
  const list = await headers();
  const origin = siteOrigin(list.get("x-forwarded-host") ?? list.get("host"), list.get("x-forwarded-proto"));
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(toSchemaOrg(feed, origin)) }}
    />
  );
}
