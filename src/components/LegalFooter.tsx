import Link from "next/link";

import { buildSha } from "@/lib/buildInfo";

/**
 * Attribution, Lizenz und rechtliche Links — identisch auf jeder Seite
 * (Startseite, `/datenschutz`, künftige weitere Seiten). Kein eigenes
 * `<footer>`: die aufrufende Seite bestimmt die Landmarke, damit pro Seite
 * nur eine einzige `footer`-Landmarke entsteht.
 */
export default function LegalFooter() {
  return (
    <>
      <p>
        Eine unabhängige Open-Source-Initiative, entwickelt von Alexander
        Schnapper. Kein offizielles Angebot der Stadt Rothenburg ob der
        Tauber oder des Rothenburg Tourismus Service (RTS).
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Lizenziert unter{" "}
          <a
            href="https://github.com/alexschnapper/rothenburg-digital/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            GNU GPLv3
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>{" "}
          &bull; 2026 &bull; Build{" "}
          {buildSha === "unbekannt" ? (
            buildSha
          ) : (
            <a
              href={`https://github.com/alexschnapper/rothenburg-digital/commit/${buildSha}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {buildSha}
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
          )}
        </span>
        <nav aria-label="Rechtliche Hinweise" className="flex gap-2">
          <a
            href="https://alexander-schnapper.de/impressum"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Impressum
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>
          <span aria-hidden="true">&bull;</span>
          <Link href="/datenschutz" className="underline">
            Datenschutz
          </Link>
        </nav>
      </div>
    </>
  );
}
