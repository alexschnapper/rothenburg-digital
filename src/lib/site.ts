/**
 * Zentrale Projektangaben (Issue #115): Namen, Rollen und Adressen, die an
 * vielen Stellen vorkommen — Seiten, Footer, Feeds, DCAT-Katalog, Chat-Prompt.
 * Ändert sich etwas, wird es nur hier geändert.
 *
 * Markdown (README, `docs/`) und `public/teaser.html` können diese Datei
 * nicht einbinden. Dort hält `site.test.ts` die Schreibweisen im Blick: Er
 * meldet veraltete Formen wie „OK Lab Rothenburg“ ohne „(in Gründung)“ oder
 * „RTS“ ohne ausgeschriebenen Namen.
 */

const REPO = "https://github.com/alexschnapper/rothenburg-digital";

/** Das Projekt selbst. */
export const SITE = {
  name: "rothenburg.digital",
  url: "https://rothenburg.digital",
  repo: REPO,
  issues: `${REPO}/issues`,
  newIssue: `${REPO}/issues/new`,
  license: `${REPO}/blob/main/LICENSE`,
  /** Datei im veröffentlichten Stand (`main`), z. B. `docs/datenqualitaet.md` */
  file: (path: string) => `${REPO}/blob/main/${path}`,
  commit: (sha: string) => `${REPO}/commit/${sha}`,
} as const;

/**
 * Die Initiative hinter dem Projekt. Das OK Lab Rothenburg gibt es offiziell
 * noch nicht; bis zur Gründung steht überall „(in Gründung)“.
 */
export const INITIATIVE = {
  name: "OK Lab Rothenburg (in Gründung)",
  initiator: "Alexander Schnapper",
} as const;

/** Die Stadt als Herausgeberin der offenen Daten. */
export const CITY = {
  name: "Stadt Rothenburg ob der Tauber",
  website: "https://www.rothenburg.de",
} as const;

/**
 * Rothenburg Tourismus Service. Im Text immer mit Namen, die Abkürzung nur in
 * Klammern dahinter (`full`), nie „RTS“ allein.
 */
export const RTS = {
  name: "Rothenburg Tourismus Service",
  full: "Rothenburg Tourismus Service (RTS)",
  website: "https://www.rothenburg-tourismus.de",
  /** Kontakt der Tourist-Information, laut bydata auch für Datenfragen (#66) */
  email: "info@rothenburg.de",
  /** Projekt, aus dem die offenen Daten der Stadt stammen */
  graph: "RTS-Graph",
  /** Technische Grundlage des RTS-Graph; Kennung `skg-…` bei bydata */
  knowledgeGraph: "Social Knowledge Graph",
} as const;

/** Rollenabgrenzung, gleich auf jeder Seite und im Chat. */
export const ROLE_DISCLAIMER = `Kein offizielles Angebot der ${CITY.name} oder des ${RTS.full}.`;

/** Wer hinter dem Projekt steht, als ein Satz. */
export const ABOUT = `${SITE.name} ist ein Proof of Concept des ${INITIATIVE.name} – eine unabhängige Open-Source-Initiative, entwickelt von ${INITIATIVE.initiator}.`;
