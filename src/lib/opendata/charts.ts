import { germanDate } from "@/lib/opendata/common";
import {
  SEVERITIES,
  TRAFFIC_ORDER,
  axisMax,
  shortDate,
  xPositions,
  yPosition,
  type ChartBox,
} from "@/lib/opendata/dashboard";
import type { HistoryEntry, Severity, Traffic } from "@/lib/opendata/quality";

/**
 * Charts zur Datenqualität als fertiges SVG (Issue #93). Dieselbe Funktion
 * liefert die Grafik für `/daten` und für den Export als SVG bzw. PNG
 * (`/daten/charts/<name>.svg|png`), damit beide gleich aussehen.
 *
 * Die Farben stehen fest in den Attributen (helles, druckfreundliches
 * Schema), damit eine exportierte Datei in Word, PowerPoint oder Keynote ohne
 * CSS richtig aussieht. Auf der Seite überschreiben Klassen (`.chart …` in
 * `globals.css`) die Farben für den dunklen Modus; CSS schlägt
 * Präsentationsattribute.
 *
 * Farbe trägt nie allein Bedeutung (WCAG 1.4.1): Linien unterscheiden sich
 * in Strich und Punktform, Flächen und Segmente tragen Symbol, Zahl und Wort.
 */

export type ChartName = "befunde-verlauf" | "ampel-verlauf" | "ampel-heute";

export const CHART_NAMES: ChartName[] = ["befunde-verlauf", "ampel-verlauf", "ampel-heute"];

export const CHART_TITLE: Record<ChartName, string> = {
  "befunde-verlauf": "Befunde je Stufe",
  "ampel-verlauf": "Ampel der Datensätze im Verlauf",
  "ampel-heute": "Ampel der Datensätze heute",
};

/** Zwei Zeilen, damit die Quelle in die schmale Grafik passt. */
export const CHART_SOURCE = [
  "Quelle: rothenburg.digital/daten, Bericht zur Datenqualität der",
  "offenen Daten der Stadt Rothenburg ob der Tauber (bydata)",
];

export type ChartOptions = {
  /** Mit Titel, Stand, Quelle und weißem Grund: für den Export. */
  frame: boolean;
};

const FONT = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
const TEXT = "#1a1a1a";
const GRID = "#a1a1aa";

const LINE: Record<Severity, { color: string; dash: string; plural: string }> = {
  fehler: { color: "#b91c1c", dash: "", plural: "Fehler" },
  warnung: { color: "#b45309", dash: "6 4", plural: "Warnungen" },
  hinweis: { color: "#0369a1", dash: "2 3", plural: "Hinweise" },
};

const AREA: Record<Traffic, { fill: string; stroke: string; icon: string; label: string }> = {
  rot: { fill: "#fecaca", stroke: "#991b1b", icon: "✖", label: "Fehler" },
  gelb: { fill: "#fde68a", stroke: "#92400e", icon: "!", label: "Warnung" },
  gruen: { fill: "#bbf7d0", stroke: "#166534", icon: "✓", label: "In Ordnung" },
};

/** Zeichenfläche ohne Rahmen; der Export legt Kopf- und Fußzeile darum. */
const BOX: ChartBox = { width: 400, height: 240, padLeft: 34, padRight: 112, padTop: 14, padBottom: 30 };
const FRAME_TOP = 58;
const FRAME_BOTTOM = 44;
const FRAME_SIDE = 16;

/** Text in SVG: `&`, `<`, `>` und Anführungszeichen maskieren. */
export const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Beschriftungen am rechten Rand dürfen sich nicht überlappen: von unten nach
 * oben jeweils mindestens `gap` Abstand, notfalls nach oben schieben.
 */
export function spreadLabels(ys: number[], gap = 16): number[] {
  const order = ys.map((y, index) => ({ y, index })).sort((a, b) => b.y - a.y);
  for (let i = 1; i < order.length; i++) {
    order[i].y = Math.min(order[i].y, order[i - 1].y - gap);
  }
  const result = [...ys];
  for (const { y, index } of order) result[index] = y;
  return result;
}

const BAR_WIDTH = 56;

/**
 * x-Position je Bericht. Ein einzelner Bericht steht rechts, wo später der
 * neueste steht; so laufen die Rasterlinien nicht durch die Beschriftung.
 */
function positions(count: number): number[] {
  return count === 1 ? [BOX.width - BOX.padRight - BAR_WIDTH / 2] : xPositions(count, BOX);
}

/** Achse und Raster; das Raster endet bei `gridEnd`, rechts davon stehen die Beschriftungen. */
function axis(max: number, xs: number[], history: HistoryEntry[], gridEnd: number): string {
  const ticks = [0, max / 2, max];
  const lines = ticks.map((tick) => {
    const y = round(yPosition(tick, max, BOX));
    return (
      `<line class="cg" x1="${BOX.padLeft}" x2="${round(gridEnd)}" y1="${y}" y2="${y}" stroke="${GRID}" stroke-width="1" stroke-opacity="0.6"/>` +
      `<text class="ct" x="${BOX.padLeft - 6}" y="${y + 4}" text-anchor="end">${tick}</text>`
    );
  });
  const dates = history.map(
    (entry, index) =>
      `<text class="ct" x="${round(xs[index])}" y="${BOX.height - 10}" text-anchor="middle">${esc(shortDate(entry.date))}</text>`,
  );
  return lines.join("") + dates.join("");
}

function marker(severity: Severity, x: number, y: number): string {
  const { color } = LINE[severity];
  const cls = `class="f-${severity}" fill="${color}"`;
  if (severity === "fehler") return `<circle ${cls} cx="${round(x)}" cy="${round(y)}" r="4.5"/>`;
  if (severity === "warnung") return `<rect ${cls} x="${round(x - 4.5)}" y="${round(y - 4.5)}" width="9" height="9"/>`;
  return `<path ${cls} d="M ${round(x)} ${round(y - 5.5)} L ${round(x + 5.5)} ${round(y + 4.5)} L ${round(x - 5.5)} ${round(y + 4.5)} Z"/>`;
}

// ─── Die drei Charts ───────────────────────────────────────────────────────

function findingsChart(history: HistoryEntry[]): { body: string; desc: string } {
  const max = axisMax(history.flatMap((entry) => SEVERITIES.map((severity) => entry.findings[severity])));
  const xs = positions(history.length);
  const latest = history[history.length - 1];
  const lastX = xs[xs.length - 1];
  const labelYs = spreadLabels(SEVERITIES.map((severity) => yPosition(latest.findings[severity], max, BOX)));
  const series = SEVERITIES.map((severity, index) => {
    const { color, dash, plural } = LINE[severity];
    const points = history.map((entry, i) => `${round(xs[i])},${round(yPosition(entry.findings[severity], max, BOX))}`);
    const markers = history.map((entry, i) => marker(severity, xs[i], yPosition(entry.findings[severity], max, BOX)));
    return (
      `<polyline class="s-${severity}" points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ""}/>` +
      markers.join("") +
      `<text class="ct" x="${round(lastX + 12)}" y="${round(labelYs[index] + 4)}">${plural} (${latest.findings[severity]})</text>`
    );
  });
  const desc =
    `Befunde je Stufe in ${history.length === 1 ? "einem Bericht" : `${history.length} Berichten`}, ` +
    `zuletzt am ${germanDate(latest.date)}: ` +
    SEVERITIES.map((severity) => `${latest.findings[severity]} ${LINE[severity].plural}`).join(", ") +
    ".";
  return { body: axis(max, xs, history, lastX) + series.join(""), desc };
}

/** Bänder je Ampelfarbe, rot unten. Ab zwei Berichten Fläche, sonst ein Balken. */
function trafficHistoryChart(history: HistoryEntry[]): { body: string; desc: string } {
  const totals = history.map((entry) => TRAFFIC_ORDER.reduce((sum, status) => sum + entry.status[status], 0));
  const max = Math.max(1, ...totals);
  const xs = positions(history.length);
  const latest = history[history.length - 1];
  const area = history.length >= 2;
  const barWidth = BAR_WIDTH;

  // Kumulierte Unter- und Obergrenze je Band und Lauf
  const lower = history.map(() => 0);
  const bands = TRAFFIC_ORDER.map((status) => {
    const bottom = [...lower];
    const top = history.map((entry, i) => (lower[i] += entry.status[status]));
    return { status, bottom, top };
  });

  const shapes = bands.map(({ status, bottom, top }) => {
    const { fill, stroke } = AREA[status];
    const cls = `class="t-${status}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"`;
    if (!area) {
      const y1 = yPosition(top[0], max, BOX);
      const y0 = yPosition(bottom[0], max, BOX);
      if (y0 - y1 <= 0) return "";
      return `<rect ${cls} x="${round(xs[0] - barWidth / 2)}" y="${round(y1)}" width="${barWidth}" height="${round(y0 - y1)}"/>`;
    }
    const upper = top.map((value, i) => `${round(xs[i])},${round(yPosition(value, max, BOX))}`);
    const under = bottom.map((value, i) => `${round(xs[i])},${round(yPosition(value, max, BOX))}`).reverse();
    return `<polygon ${cls} points="${[...upper, ...under].join(" ")}"/>`;
  });

  // Beschriftung rechts neben dem letzten Lauf, auf Höhe der Bandmitte
  const last = history.length - 1;
  const mids = bands.map(({ bottom, top }) => yPosition((bottom[last] + top[last]) / 2, max, BOX));
  const labelYs = spreadLabels(mids);
  const labelX = (area ? xs[last] : xs[last] + barWidth / 2) + 12;
  const labels = bands.map(({ status }, index) => {
    const { icon, label } = AREA[status];
    return `<text class="ct" x="${round(labelX)}" y="${round(labelYs[index] + 4)}">${icon} ${latest.status[status]} ${label}</text>`;
  });

  const desc =
    `Ampel der ${totals[last]} Datensätze in ${history.length === 1 ? "einem Bericht" : `${history.length} Berichten`}, ` +
    `zuletzt am ${germanDate(latest.date)}: ` +
    TRAFFIC_ORDER.map((status) => `${latest.status[status]} ${AREA[status].label}`).join(", ") +
    ".";
  const gridEnd = area ? xs[last] : xs[last] + barWidth / 2;
  return { body: axis(max, xs, history, gridEnd) + shapes.join("") + labels.join(""), desc };
}

/** Kreisbogen-Segment eines Rings, Winkel in Grad ab 12 Uhr im Uhrzeigersinn. */
export function ringSegment(cx: number, cy: number, outer: number, inner: number, from: number, to: number): string {
  const point = (radius: number, angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return `${round(cx + radius * Math.cos(rad))} ${round(cy + radius * Math.sin(rad))}`;
  };
  // Ein voller Kreis lässt sich nicht als ein Bogen zeichnen: knapp darunter bleiben.
  const end = to - from >= 360 ? from + 359.99 : to;
  const large = end - from > 180 ? 1 : 0;
  return (
    `M ${point(outer, from)} A ${outer} ${outer} 0 ${large} 1 ${point(outer, end)} ` +
    `L ${point(inner, end)} A ${inner} ${inner} 0 ${large} 0 ${point(inner, from)} Z`
  );
}

function trafficTodayChart(status: Record<Traffic, number>): { body: string; desc: string } {
  const total = TRAFFIC_ORDER.reduce((sum, key) => sum + status[key], 0);
  const cx = 120;
  const cy = BOX.height / 2;
  const outer = 96;
  const inner = 58;
  let angle = 0;
  const segments = TRAFFIC_ORDER.map((key) => {
    const value = status[key];
    if (value === 0 || total === 0) return "";
    const from = angle;
    angle += (value / total) * 360;
    const { fill, stroke, icon } = AREA[key];
    const mid = ((from + angle) / 2 - 90) * (Math.PI / 180);
    const r = (outer + inner) / 2;
    // Zahl im Segment nur, wenn es breit genug ist; die Legende nennt sie immer.
    const number =
      angle - from >= 24
        ? `<text class="ct" x="${round(cx + r * Math.cos(mid))}" y="${round(cy + r * Math.sin(mid) + 5)}" text-anchor="middle" font-weight="700">${icon} ${value}</text>`
        : "";
    return `<path class="t-${key}" d="${ringSegment(cx, cy, outer, inner, from, angle)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${number}`;
  });
  const center =
    `<text class="ct" x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="26" font-weight="700">${total}</text>` +
    `<text class="ct" x="${cx}" y="${cy + 22}" text-anchor="middle">Datensätze</text>`;
  const legend = TRAFFIC_ORDER.map((key, index) => {
    const { fill, stroke, icon, label } = AREA[key];
    const y = 70 + index * 34;
    return (
      `<rect class="t-${key}" x="252" y="${y - 13}" width="18" height="18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
      `<text class="ct" x="278" y="${y + 1}">${icon} ${status[key]} ${label}</text>`
    );
  });
  const desc =
    `Ampel der ${total} Datensätze heute: ` +
    TRAFFIC_ORDER.map((key) => `${status[key]} ${AREA[key].label}`).join(", ") +
    ".";
  return { body: segments.join("") + center + legend.join(""), desc };
}

// ─── Zusammensetzen ────────────────────────────────────────────────────────

export type ChartData = { history: HistoryEntry[]; today: Record<Traffic, number>; date: string };

/**
 * Das fertige SVG. Ohne `frame` für die Seite (Titel steht in der
 * `figcaption`), mit `frame` als eigenständige Datei mit Titel, Stand und
 * Quelle.
 */
export function chartSvg(name: ChartName, data: ChartData, options: ChartOptions): string {
  const { body, desc } =
    name === "befunde-verlauf"
      ? findingsChart(data.history)
      : name === "ampel-verlauf"
        ? trafficHistoryChart(data.history)
        : trafficTodayChart(data.today);
  const title = CHART_TITLE[name];
  const id = `chart-${name}`;
  const meta = `<title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(desc)} Alle Werte stehen auch als Tabelle auf rothenburg.digital/daten.</desc>`;
  const style = `font-family="${FONT}" font-size="12" fill="${TEXT}"`;

  if (!options.frame) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" class="chart" viewBox="0 0 ${BOX.width} ${BOX.height}" role="img" aria-labelledby="${id}-title ${id}-desc" ${style}>` +
      meta +
      body +
      `</svg>`
    );
  }

  const width = BOX.width + 2 * FRAME_SIDE;
  const height = FRAME_TOP + BOX.height + FRAME_BOTTOM;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" ${style}>` +
    meta +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    `<text x="${FRAME_SIDE}" y="26" font-size="17" font-weight="700">${esc(title)}</text>` +
    `<text x="${FRAME_SIDE}" y="45" font-size="12">Stand ${esc(germanDate(data.date) ?? data.date)}</text>` +
    `<g transform="translate(${FRAME_SIDE} ${FRAME_TOP})">${body}</g>` +
    CHART_SOURCE.map(
      (line, index) =>
        `<text x="${FRAME_SIDE}" y="${height - 26 + index * 13}" font-size="10">${esc(line)}</text>`,
    ).join("") +
    `</svg>`
  );
}

/** Größe der Exportdatei in Pixeln (doppelte Auflösung für scharfe PNGs). */
export const EXPORT_SIZE = {
  width: (BOX.width + 2 * FRAME_SIDE) * 2,
  height: (FRAME_TOP + BOX.height + FRAME_BOTTOM) * 2,
};
