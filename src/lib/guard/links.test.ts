import { describe, expect, it } from "vitest";

import { isAllowedLinkHref, toSafeLinkHref } from "@/lib/guard/links";

describe("isAllowedLinkHref", () => {
  it("erlaubt https-Adressen zu einem Allowlist-Hostnamen", () => {
    expect(isAllowedLinkHref("https://www.rothenburg.de/amt")).toBe(true);
    expect(isAllowedLinkHref("https://stadt.rothenburg.de/")).toBe(true);
    expect(isAllowedLinkHref("https://ratsinfo.rothenburg.de/sitzung/1")).toBe(
      true,
    );
    expect(isAllowedLinkHref("https://www.rothenburg-tourismus.de/")).toBe(
      true,
    );
  });

  it("erlaubt OpenStreetMap-Kartenlinks (#28)", () => {
    expect(
      isAllowedLinkHref(
        "https://www.openstreetmap.org/search?query=Caf%C3%A9%20Einhorn%20Rothenburg%20ob%20der%20Tauber",
      ),
    ).toBe(true);
    expect(isAllowedLinkHref("https://openstreetmap.org/")).toBe(true);
  });

  it("lehnt Google Maps ab — OSM ist die bewusste Wahl, kein Fallback auf Google", () => {
    expect(
      isAllowedLinkHref("https://www.google.com/maps/search/Marktplatz"),
    ).toBe(false);
  });

  it("erlaubt http-Autolinks (remark-gfm-`www.`-Erkennung)", () => {
    // Regression: remark-gfm autolinkt bloße "www."-Adressen selbst und setzt
    // dafür http:// statt https:// — siehe toSafeLinkHref.
    expect(isAllowedLinkHref("http://www.rothenburg.de/")).toBe(true);
  });

  it("lehnt erfundene Subdomains ab, auch wenn sie plausibel klingen", () => {
    // Genau der Fall, der beim Testen auffiel: es gibt keine Subdomain
    // "tourismus.rothenburg.de" — die echte Seite ist rothenburg-tourismus.de.
    expect(isAllowedLinkHref("https://www.tourismus.rothenburg.de/")).toBe(
      false,
    );
    expect(isAllowedLinkHref("https://tourismus.rothenburg.de/")).toBe(false);
  });

  it("lehnt fremde Domains ab", () => {
    expect(isAllowedLinkHref("https://de.wikipedia.org/wiki/Rothenburg")).toBe(
      false,
    );
    expect(
      isAllowedLinkHref("https://rothenburg.de.angreifer.example/"),
    ).toBe(false);
  });

  it("lehnt unsichere oder untypische Protokolle ab", () => {
    expect(isAllowedLinkHref("javascript:alert(1)")).toBe(false);
    expect(
      isAllowedLinkHref("data:text/html,<script>alert(1)</script>"),
    ).toBe(false);
  });

  it("lehnt fehlende oder unparsbare Adressen ab", () => {
    expect(isAllowedLinkHref(undefined)).toBe(false);
    expect(isAllowedLinkHref("")).toBe(false);
    expect(isAllowedLinkHref("nicht-mal-eine-url")).toBe(false);
  });
});

describe("toSafeLinkHref", () => {
  it("lässt https-Adressen unverändert", () => {
    expect(toSafeLinkHref("https://www.rothenburg.de/")).toBe(
      "https://www.rothenburg.de/",
    );
  });

  it("hebt http-Autolinks auf https", () => {
    expect(toSafeLinkHref("http://www.rothenburg.de/")).toBe(
      "https://www.rothenburg.de/",
    );
  });
});
