import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDatasetCache,
  isAcceptableDownloadUrl,
  jsonDownloadUrl,
  loadDataset,
} from "@/lib/opendata/bydata";

const FILE = "https://opendata.rothenburg-tourismus.de/parkplaetze.json";

/** Gekürzte Antwort der Such-API (`/datasets/<id>`). */
const metadata = {
  result: {
    modified: "2026-10-22T23:30:00Z",
    distributions: [
      { format: { id: "CSV" }, download_url: [FILE.replace(".json", ".csv")] },
      { format: { id: "JSON" }, download_url: [FILE], access_url: [FILE] },
    ],
  },
};

function mockFetch(responses: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!(url in responses)) return new Response("nicht gefunden", { status: 404 });
    return new Response(JSON.stringify(responses[url]), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  clearDatasetCache();
});

describe("isAcceptableDownloadUrl", () => {
  it.each([FILE, "https://open.bydata.de/x.json"])("erlaubt %s", (url) => {
    expect(isAcceptableDownloadUrl(url)).toBe(true);
  });

  it.each([
    "http://opendata.rothenburg-tourismus.de/parkplaetze.json",
    "https://localhost/x.json",
    "https://127.0.0.1/x.json",
    "https://[::1]/x.json",
    "https://intranet/x.json",
    "file:///etc/passwd",
    "kein link",
  ])("lehnt %s ab", (url) => {
    expect(isAcceptableDownloadUrl(url)).toBe(false);
  });
});

describe("jsonDownloadUrl", () => {
  it("liest die Adresse der JSON-Distribution und den Stand", () => {
    expect(jsonDownloadUrl(metadata)).toEqual({ url: FILE, modified: "2026-10-22" });
  });

  it("wirft ohne JSON-Distribution", () => {
    expect(() =>
      jsonDownloadUrl({ result: { distributions: [{ format: { id: "CSV" } }] } }),
    ).toThrow();
  });
});

describe("loadDataset", () => {
  const META = "https://open.bydata.de/api/hub/search/datasets/skg-venus-parkplaetze";

  it("lädt über die Metadaten und speichert zwischen", async () => {
    const fetchMock = mockFetch({ [META]: metadata, [FILE]: [{ id: "p1" }] });

    const first = await loadDataset("skg-venus-parkplaetze");
    expect(first.items).toEqual([{ id: "p1" }]);
    expect(first.pageUrl).toBe(
      "https://rothenburg.bydata.de/datasets/skg-venus-parkplaetze?locale=de",
    );

    await loadDataset("skg-venus-parkplaetze");
    expect(fetchMock).toHaveBeenCalledTimes(2); // Metadaten + Datei, nur einmal
  });

  it("liefert bei Ausfall den letzten Stand weiter", async () => {
    vi.useFakeTimers();
    mockFetch({ [META]: metadata, [FILE]: [{ id: "p1" }] });
    await loadDataset("skg-venus-parkplaetze");

    vi.advanceTimersByTime(7 * 60 * 60 * 1000);
    mockFetch({});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const stale = await loadDataset("skg-venus-parkplaetze");
    expect(stale.items).toEqual([{ id: "p1" }]);
  });

  it("wirft, wenn es noch keinen Stand gibt", async () => {
    mockFetch({});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(loadDataset("skg-venus-parkplaetze")).rejects.toThrow();
  });
});
