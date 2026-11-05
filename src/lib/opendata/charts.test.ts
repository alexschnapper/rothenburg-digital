import { describe, expect, it } from "vitest";

import {
  CHART_NAMES,
  CHART_SOURCE,
  chartSvg,
  esc,
  ringSegment,
  spreadLabels,
  type ChartData,
} from "@/lib/opendata/charts";
import type { HistoryEntry } from "@/lib/opendata/quality";

const entry = (date: string, rot: number, gelb: number, gruen: number): HistoryEntry => ({
  date,
  status: { rot, gelb, gruen },
  findings: { fehler: rot, warnung: gelb * 2, hinweis: 18 },
  datasets: {},
});

const one: ChartData = {
  history: [entry("2026-11-05", 2, 14, 2)],
  today: { rot: 2, gelb: 14, gruen: 2 },
  date: "2026-11-05",
};

const several: ChartData = {
  history: [entry("2026-11-05", 2, 14, 2), entry("2026-11-09", 2, 13, 3), entry("2026-11-16", 1, 12, 5)],
  today: { rot: 1, gelb: 12, gruen: 5 },
  date: "2026-11-16",
};

describe("chartSvg", () => {
  it.each(CHART_NAMES)("%s: Export mit Titel, Stand, Quelle und festen Farben", (name) => {
    const svg = chartSvg(name, several, { frame: true });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+"/);
    expect(svg).toContain(`<title id="chart-${name}-title">`);
    expect(svg).toContain(`<desc id="chart-${name}-desc">`);
    expect(svg).toContain("Stand 16.11.2026");
    for (const line of CHART_SOURCE) expect(svg).toContain(line);
    // Ohne CSS-Variablen: Word, PowerPoint und Resvg kennen sie nicht.
    expect(svg).not.toContain("var(");
    expect(svg).toContain('fill="#ffffff"');
  });

  it("für die Seite ohne Rahmen, aber mit Klassen für den dunklen Modus", () => {
    const svg = chartSvg("befunde-verlauf", several, { frame: false });
    expect(svg).toContain('class="chart"');
    expect(svg).not.toContain("Stand ");
    expect(svg).not.toContain('fill="#ffffff"');
    expect(svg).toContain('class="s-warnung"');
    expect(svg).toContain('class="f-fehler"');
    expect(svg).toContain('role="img" aria-labelledby="chart-befunde-verlauf-title chart-befunde-verlauf-desc"');
  });

  it("Linien: je Stufe Strichart, Punktform und Name mit Wert", () => {
    const svg = chartSvg("befunde-verlauf", several, { frame: false });
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(svg).toContain('stroke-dasharray="2 3"');
    expect(svg.match(/<circle /g)).toHaveLength(3);
    expect(svg).toContain("Warnungen (24)");
    expect(svg).toContain("Fehler (1)");
  });

  it("Ampel-Verlauf: Fläche ab zwei Berichten, vorher ein Balken", () => {
    const area = chartSvg("ampel-verlauf", several, { frame: false });
    expect(area.match(/<polygon /g)).toHaveLength(3);
    expect(area).toContain("✖ 1 Fehler");
    expect(area).toContain("✓ 5 In Ordnung");

    const bar = chartSvg("ampel-verlauf", one, { frame: false });
    expect(bar).not.toContain("<polygon");
    expect(bar.match(/<rect class="t-/g)).toHaveLength(3);
  });

  it("Ring: Gesamtzahl in der Mitte, Legende mit Symbol, Zahl und Wort", () => {
    const svg = chartSvg("ampel-heute", one, { frame: false });
    expect(svg).toContain(">18</text>");
    expect(svg).toContain("! 14 Warnung");
    expect(svg).toContain("✖ 2 Fehler");
    expect(svg.match(/<path class="t-/g)).toHaveLength(3);
  });

  it("Ring ohne leere Segmente", () => {
    const svg = chartSvg("ampel-heute", { ...one, today: { rot: 0, gelb: 0, gruen: 18 } }, { frame: false });
    expect(svg.match(/<path class="t-/g)).toHaveLength(1);
  });

  it("beschreibt die Werte für Screenreader", () => {
    expect(chartSvg("ampel-heute", one, { frame: false })).toContain(
      "Ampel der 18 Datensätze heute: 2 Fehler, 14 Warnung, 2 In Ordnung.",
    );
  });
});

describe("Hilfen", () => {
  it("maskiert Text für SVG", () => {
    expect(esc('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  it("schiebt überlappende Beschriftungen auseinander", () => {
    expect(spreadLabels([100, 95, 20])).toEqual([100, 84, 20]);
    expect(spreadLabels([50, 200])).toEqual([50, 200]);
  });

  it("zeichnet einen vollen Ring knapp unter 360 Grad", () => {
    const path = ringSegment(100, 100, 90, 50, 0, 360);
    expect(path).toMatch(/^M 100 10 A 90 90 0 1 1 /);
    expect(path).not.toContain("NaN");
  });
});
