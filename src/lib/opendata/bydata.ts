import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

/**
 * Abruf offener Daten der Stadt über bydata (Issue #44, erster Einsatz #6).
 *
 * Einstieg ist bewusst die Such-API von open.bydata.de und nicht der
 * Dateiserver, auf dem die Dateien heute liegen
 * (`opendata.rothenburg-tourismus.de`): Die Download-Adresse steht in den
 * Metadaten des Datensatzes und wird bei jedem Abruf dort gelesen. Ändert sich
 * der Dateiserver mit dem offiziellen Schnittstellenzugang, greift das ohne
 * Codeänderung.
 *
 * Die Daten werden wöchentlich aktualisiert. Ein Zwischenspeicher im Prozess
 * reicht deshalb — wie bei den Zählern in `guard/ratelimit.ts` gibt es pro
 * Umgebung genau einen Passenger-Prozess. Fällt die Quelle aus, wird der
 * letzte erfolgreiche Stand weiter ausgeliefert; gab es noch keinen, wirft
 * der Abruf, und die aufrufende Stelle sagt ehrlich, dass keine Daten
 * vorliegen.
 */

const SEARCH_API = "https://open.bydata.de/api/hub/search";

/** Öffentliche Datensatzseite der Stadt — der Link, der Nutzern gezeigt wird. */
export const datasetPageUrl = (id: string) =>
  `https://rothenburg.bydata.de/datasets/${id}?locale=de`;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
/** Die größte Datei der Stadt (Top Events) hat gut 500 KB. */
const MAX_BYTES = 2 * 1024 * 1024;

const metadataSchema = z.object({
  result: z.object({
    modified: z.string().optional(),
    distributions: z.array(
      z.object({
        format: z.object({ id: z.string() }).optional(),
        download_url: z.array(z.string()).optional(),
        access_url: z.array(z.string()).optional(),
      }),
    ),
  }),
});

export type Dataset = {
  id: string;
  /** Rohdaten der JSON-Distribution — prüft die aufrufende Stelle. */
  items: unknown[];
  /** Letzte Änderung laut Metadaten, z. B. `2026-10-22`. */
  modified: string | null;
  pageUrl: string;
  fetchedAt: Date;
};

/**
 * Nur `https` und ein echter Hostname: Die Adresse kommt aus fremden
 * Metadaten, der Server soll damit nicht ins eigene Netz oder auf eine
 * IP-Adresse geschickt werden können.
 */
export function isAcceptableDownloadUrl(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  if (host === "localhost" || !host.includes(".")) return false;
  if (/^[\d.]+$/.test(host) || host.startsWith("[")) return false;
  return true;
}

/** Download-Adresse der JSON-Distribution aus den Metadaten. */
export function jsonDownloadUrl(metadata: unknown): {
  url: string;
  modified: string | null;
} {
  const { result } = metadataSchema.parse(metadata);
  const json = result.distributions.find(
    (distribution) => distribution.format?.id.toUpperCase() === "JSON",
  );
  const url = [...(json?.download_url ?? []), ...(json?.access_url ?? [])].find(
    isAcceptableDownloadUrl,
  );
  if (!url) throw new Error("Keine JSON-Distribution mit gültiger Adresse.");
  return { url, modified: result.modified?.slice(0, 10) ?? null };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} für ${url}`);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error(`Antwort zu groß: ${url}`);
  return JSON.parse(text);
}

/**
 * Testmodus für das Red-Team (Issue #60): Datensätze aus lokalen Dateien
 * statt von bydata, damit sich präparierte Beschreibungen (indirekte
 * Injection) gezielt einspielen lassen. Nur über die Umgebungsvariable, **nie
 * auf einem Server setzen** — die App würde sonst Testdaten ausliefern.
 */
function fixtureDataset(dir: string, id: string): Dataset {
  console.warn(`[opendata] TESTMODUS: ${id} aus ${dir}`);
  const items: unknown = JSON.parse(
    readFileSync(/*turbopackIgnore: true*/ join(dir, `${id}.json`), "utf8"),
  );
  if (!Array.isArray(items)) throw new Error(`Keine Liste in ${id}.json`);
  return { id, items, modified: "2026-11-01", pageUrl: datasetPageUrl(id), fetchedAt: new Date() };
}

async function fetchDataset(id: string): Promise<Dataset> {
  const fixtures = process.env.OPENDATA_FIXTURE_DIR?.trim();
  if (fixtures) return fixtureDataset(fixtures, id);

  const metadata = await fetchJson(
    `${SEARCH_API}/datasets/${encodeURIComponent(id)}`,
  );
  const { url, modified } = jsonDownloadUrl(metadata);
  const items = await fetchJson(url);
  if (!Array.isArray(items)) throw new Error(`Keine Liste in ${url}`);
  return { id, items, modified, pageUrl: datasetPageUrl(id), fetchedAt: new Date() };
}

const cache = new Map<string, { dataset: Dataset; expires: number }>();
const pending = new Map<string, Promise<Dataset>>();

/**
 * Datensatz laden, mit Zwischenspeicher. Wirft nur, wenn weder ein frischer
 * Abruf gelingt noch ein älterer Stand vorliegt.
 */
export async function loadDataset(id: string): Promise<Dataset> {
  const cached = cache.get(id);
  if (cached && cached.expires > Date.now()) return cached.dataset;

  // Gleichzeitige Anfragen teilen sich einen Abruf.
  let request = pending.get(id);
  if (!request) {
    request = fetchDataset(id).finally(() => pending.delete(id));
    pending.set(id, request);
  }

  try {
    const dataset = await request;
    cache.set(id, { dataset, expires: Date.now() + CACHE_TTL_MS });
    return dataset;
  } catch (error) {
    console.error(`[opendata] ${id}:`, error);
    if (cached) return cached.dataset;
    throw error;
  }
}

/** Nur für Tests. */
export function clearDatasetCache(): void {
  cache.clear();
  pending.clear();
}
