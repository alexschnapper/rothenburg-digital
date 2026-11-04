import ExternalLink from "@/components/ExternalLink";
import { OPEN_DATA_SOURCE, germanDate, type SourceInfo } from "@/lib/opendata/common";

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
}: {
  sources: SourceInfo[];
  /** Zusatz, z. B. zu abweichenden Lizenzen einzelner Einträge */
  note?: string;
}) {
  return (
    <section aria-labelledby="quelle-heading" className="flex flex-col gap-1 text-sm">
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
      {note && <p className="opacity-80">{note}</p>}
    </section>
  );
}
