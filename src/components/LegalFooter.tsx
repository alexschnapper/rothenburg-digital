import Link from "next/link";

import { buildSha } from "@/lib/buildInfo";
import { ABOUT, ROLE_DISCLAIMER, SITE } from "@/lib/site";

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
        {ABOUT} {ROLE_DISCLAIMER}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Lizenziert unter{" "}
          <a
            href={SITE.license}
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
              href={SITE.commit(buildSha)}
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
          <span aria-hidden="true">&bull;</span>
          <Link href="/kosten" className="underline">
            Kosten
          </Link>
        </nav>
      </div>
    </>
  );
}
