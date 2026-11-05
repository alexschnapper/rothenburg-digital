import { EVENTS_DATASET } from "@/lib/opendata/dailyFact";
import { DEFIBRILLATOR_DATASET, HEAT_DATASET } from "@/lib/opendata/emergency";
import { CHARGING_DATASET, PARKING_DATASET } from "@/lib/opendata/parking";
import { RESTAURANT_DATASET } from "@/lib/opendata/restaurants";
import { SHOP_DATASETS } from "@/lib/opendata/shopping";
import { SIGHTS_DATASET } from "@/lib/opendata/sights";

/**
 * Bestandsaufnahme (Issue #66): Wofür nutzt rothenburg.digital welchen
 * Datensatz der Stadt, und warum manche nicht? Vorher stand das als Tabelle im
 * Issue und veraltete mit jedem PR.
 *
 * Der Datenqualitäts-Bericht (#80) zeigt die Angaben je Datensatz an. Taucht im
 * Katalog ein Datensatz auf, der hier fehlt, meldet er „noch nicht bewertet“ —
 * so fällt ein neuer Datensatz der Stadt beim wöchentlichen Lauf auf.
 *
 * Neue Nutzung (Seite, Chat) hier mit eintragen.
 */

export type UsageStatus = "genutzt" | "teilweise" | "abgedeckt" | "nicht-genutzt";

export type Usage = {
  status: UsageStatus;
  /** Eigene Seiten, auf denen die Daten erscheinen */
  pages: { href: string; label: string }[];
  /** Kommen die Daten bei passenden Fragen in den Chat? */
  chat: boolean;
  /** Einschränkung oder Begründung, ein Satz */
  note: string;
};

export const USAGE_LABEL: Record<UsageStatus, string> = {
  genutzt: "Genutzt",
  teilweise: "Teilweise genutzt",
  abgedeckt: "Über einen anderen Datensatz abgedeckt",
  "nicht-genutzt": "Nicht genutzt",
};

const PARKEN = { href: "/parken", label: "Parken & E-Laden" };
const ESSEN = { href: "/essen-trinken", label: "Essen & Trinken" };
const EINKAUFEN = { href: "/einkaufen", label: "Einkaufen" };
const SEHEN = { href: "/sehenswuerdigkeiten", label: "Sehenswürdigkeiten" };
const NOTFALL = { href: "/notfall-hitze", label: "Notfall & Hitze" };

const shop = (note = ""): Usage => ({ status: "genutzt", pages: [EINKAUFEN], chat: true, note });
const subsetOfSights: Usage = {
  status: "abgedeckt",
  pages: [SEHEN],
  chat: true,
  note: "Teilmenge des Datensatzes Sehenswürdigkeiten.",
};

/** Die 18 Datensätze der Stadt im Katalog `rothenburg-import`, Stand 05.11.2026. */
export const INVENTORY: Record<string, Usage> = {
  [PARKING_DATASET]: { status: "genutzt", pages: [PARKEN], chat: true, note: "" },
  [CHARGING_DATASET]: {
    status: "genutzt",
    pages: [PARKEN],
    chat: true,
    note: "Seite und Chat verweisen zusätzlich auf die vollständigere Übersicht der Stadt.",
  },
  [RESTAURANT_DATASET]: {
    status: "genutzt",
    pages: [ESSEN],
    chat: true,
    note: "Mit Öffnungsstatus, den der Server berechnet.",
  },
  [SIGHTS_DATASET]: {
    status: "genutzt",
    pages: [SEHEN],
    chat: true,
    note: "Auch Quelle für den Fakt zum Tag auf der 404-Seite.",
  },
  "skg-venus-top-10-rothenburg": subsetOfSights,
  "skg-venus-museum": subsetOfSights,
  "skg-venus-juedisches-rothenburg": subsetOfSights,
  [DEFIBRILLATOR_DATASET]: { status: "genutzt", pages: [NOTFALL], chat: true, note: "" },
  [HEAT_DATASET]: { status: "genutzt", pages: [NOTFALL], chat: true, note: "" },
  [EVENTS_DATASET]: {
    status: "teilweise",
    pages: [],
    chat: false,
    note: "Nur für den Fakt zum Tag auf der 404-Seite. Termine im Chat folgen mit #36.",
  },
  "skg-venus-stadtfuehrungen": {
    status: "nicht-genutzt",
    pages: [],
    chat: false,
    note: "Der Datensatz ist leer.",
  },
  ...Object.fromEntries(SHOP_DATASETS.map(({ id }) => [id, shop()])),
  "skg-venus-einzelhandel": shop(
    "Enthält dieselben Einträge wie Einkaufsmöglichkeiten und fügt deshalb nichts hinzu.",
  ),
  "skg-venus-geniessen-ob-der-tauber": {
    status: "abgedeckt",
    pages: [ESSEN],
    chat: true,
    note: "Beide Einträge stehen auch im Datensatz Restaurants.",
  },
  "skg-venus-wanderwege": {
    status: "nicht-genutzt",
    pages: [],
    chat: false,
    note: "Nur ein Weg (W6); eine eigene Seite lohnt sich erst mit mehr Einträgen.",
  },
};

/**
 * Weitere Daten, die das Portal der Stadt zeigt oder die Suche findet, die aber
 * nicht im Katalog der Stadt stehen und deshalb nicht geprüft werden.
 */
export const OTHER_SOURCES: { title: string; publisher: string; note: string }[] = [
  {
    title: "Gemeindekennzahlen (GKSt): Tourismus, Baufertigstellungen, Beschäftigte, Schulen, Lebendgeborene",
    publisher: "Bayerisches Landesamt für Statistik",
    note: "Amtliche Jahresstatistik ohne Ortsbezug, nicht von der Stadt gepflegt. Vorerst nicht genutzt; Kandidat für eine spätere Seite „Rothenburg in Zahlen“.",
  },
  {
    title: "Grundwassermessstellen (3)",
    publisher: "Gewässerkundlicher Dienst Bayern",
    note: "Nicht im Portal der Stadt. Wird mit dem Sensorik-Pilot (#73) neu bewertet.",
  },
  {
    title: "Automatische Zählstellen A7, 2014–2023",
    publisher: "Bundesanstalt für Straßenwesen",
    note: "Nicht im Portal der Stadt, abgeschlossene Zeitreihe ohne Bezug zur Altstadt. Bewusst nicht genutzt.",
  },
];
