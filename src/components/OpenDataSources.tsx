import Link from "next/link";

import ExternalLink from "@/components/ExternalLink";
import { dataReportUrl } from "@/lib/dataReport";
import { OPEN_DATA_SOURCE, germanDate, type SourceInfo } from "@/lib/opendata/common";
import { FEED_INFO, feedPath, type FeedName } from "@/lib/opendata/feeds";

/**
 * Quellenangabe für Seiten aus den offenen Daten der Stadt (#66): je Datensatz
 * Link, Stand und **Lizenz aus den Metadaten**. Vorher stand auf jeder Seite
 * fest „CC0", obwohl z. B. Restaurants und Sehenswürdigkeiten unter CC BY 4.0
 * stehen.
 *
 * CC BY verlangt Namensnennung (hier: {@link OPEN_DATA_SOURCE}), einen Link zur
 * Lizenz und den Hinweis, ob die Daten verändert wurden.
 */
export default function OpenDataSources({
  sources,
  note,
  feed,
}: {
  sources: SourceInfo[];
  /** Zusatz, z. B. zu abweichenden Lizenzen einzelner Einträge */
  note?: string;
  /** Aufbereitete Daten dieser Seite als GeoJSON-Feed (#81) */
  feed?: FeedName;
}) {
  return (
    <section aria-labelledby="quelle-heading" className="flex max-w-3xl flex-col gap-1 text-sm">
      <h2 id="quelle-heading" className="text-base font-bold">
        Quelle
      </h2>
      <p>
        {OPEN_DATA_SOURCE}, über das bayerische Open-Data-Portal bydata. Für die
        Anzeige aufbereitet: gekürzt, sortiert und um Sätze mit Links oder
        Anweisungen bereinigt.
      </p>
      <ul className="list-inside list-disc">
        {sources.map((source) => {
          const stand = germanDate(source.modified);
          return (
            <li key={source.url}>
              <ExternalLink href={source.url}>{source.label}</ExternalLink>
              {stand ? `, Stand ${stand}` : ""}
              {", Lizenz: "}
              {source.license ? (
                source.license.url ? (
                  <ExternalLink href={source.license.url}>{source.license.label}</ExternalLink>
                ) : (
                  source.license.label
                )
              ) : (
                "siehe Datensatz"
              )}
            </li>
          );
        })}
      </ul>
      {note && <p className="text-muted">{note}</p>}
      {feed && (
        <p>
          Zur Weiterverwendung:{" "}
          <a href={feedPath(feed)} className="underline">
            diese Daten als GeoJSON
          </a>
          , mit Lizenz und Quelle an jedem Eintrag. Alle Feeds stehen auf{" "}
          <Link href="/daten#feeds" className="underline">
            der Seite zur Datenqualität
          </Link>
          .
        </p>
      )}
      <ReportLine sources={sources} feed={feed} />
    </section>
  );
}

/**
 * „Fehler in diesen Daten gefunden?“ (#10): vorausgefülltes GitHub-Formular.
 * Bei einem einzigen Datensatz ist er schon eingetragen.
 */
function ReportLine({ sources, feed }: { sources: SourceInfo[]; feed?: FeedName }) {
  const report = {
    dataset: sources.length === 1 ? sources[0].label : undefined,
    path: feed ? FEED_INFO[feed].page : undefined,
  };
  return (
    <p>
      Fehler in diesen Daten gefunden?{" "}
      <ExternalLink href={dataReportUrl(report)}>Auf GitHub melden</ExternalLink>.
    </p>
  );
}
