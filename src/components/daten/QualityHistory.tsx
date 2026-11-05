import { germanDate } from "@/lib/opendata/common";
import {
  SEVERITIES,
  TRAFFIC_ORDER,
  findingLines,
  shortDate,
  xPositions,
  yPosition,
  type ChartBox,
} from "@/lib/opendata/dashboard";
import { SEVERITY_LABEL, type HistoryEntry, type Severity, type Traffic } from "@/lib/opendata/quality";
import { TRAFFIC } from "@/components/daten/Marks";

const BOX: ChartBox = { width: 360, height: 200, padLeft: 32, padRight: 96, padTop: 12, padBottom: 28 };

/**
 * Linien unterscheiden sich nicht nur in der Farbe, sondern auch in Strich
 * und Punktform, und tragen am Ende ihren Namen (WCAG 1.4.1).
 */
const LINE: Record<Severity, { className: string; dash: string; plural: string }> = {
  fehler: { className: "stroke-red-700 fill-red-700 dark:stroke-red-400 dark:fill-red-400", dash: "", plural: "Fehler" },
  warnung: {
    className: "stroke-amber-700 fill-amber-700 dark:stroke-amber-400 dark:fill-amber-400",
    dash: "6 4",
    plural: "Warnungen",
  },
  hinweis: {
    className: "stroke-sky-700 fill-sky-700 dark:stroke-sky-400 dark:fill-sky-400",
    dash: "2 3",
    plural: "Hinweise",
  },
};

const BAR: Record<Traffic, string> = {
  rot: "fill-red-200 stroke-red-800 dark:fill-red-900 dark:stroke-red-300",
  gelb: "fill-amber-200 stroke-amber-800 dark:fill-amber-900 dark:stroke-amber-300",
  gruen: "fill-green-200 stroke-green-800 dark:fill-green-900 dark:stroke-green-300",
};

function Marker({ severity, x, y }: { severity: Severity; x: number; y: number }) {
  if (severity === "fehler") return <circle cx={x} cy={y} r={4} />;
  if (severity === "warnung") return <rect x={x - 4} y={y - 4} width={8} height={8} />;
  return <path d={`M ${x} ${y - 5} L ${x + 5} ${y + 4} L ${x - 5} ${y + 4} Z`} />;
}

function Axis({ max, xs, history }: { max: number; xs: number[]; history: HistoryEntry[] }) {
  const ticks = [0, max / 2, max];
  return (
    <g className="fill-current stroke-current text-[11px]">
      {ticks.map((tick) => {
        const y = yPosition(tick, max, BOX);
        return (
          <g key={tick}>
            <line x1={BOX.padLeft} x2={BOX.width - BOX.padRight} y1={y} y2={y} strokeOpacity={0.25} />
            <text x={BOX.padLeft - 6} y={y + 4} textAnchor="end" stroke="none">
              {tick}
            </text>
          </g>
        );
      })}
      {history.map((entry, index) => (
        <text key={entry.date} x={xs[index]} y={BOX.height - 8} textAnchor="middle" stroke="none">
          {shortDate(entry.date)}
        </text>
      ))}
    </g>
  );
}

/**
 * Verlauf aus `reports/verlauf.json` (#80, #84): Befunde je Stufe und die
 * Ampel über die Wochen, als SVG vom Server und mit gleichwertiger Tabelle.
 * Eine Lücke im Verlauf heißt „nichts geändert“.
 */
export function QualityHistory({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return <p className="text-sm">Noch kein Verlauf vorhanden.</p>;
  const { max, xs, lines } = findingLines(history, BOX);
  const latest = history[history.length - 1];
  const datasetCount = TRAFFIC_ORDER.reduce((sum, status) => sum + latest.status[status], 0);
  const barMax = Math.max(1, ...history.map((entry) => TRAFFIC_ORDER.reduce((s, t) => s + entry.status[t], 0)));
  const barXs = xPositions(history.length, BOX);
  const barWidth = Math.min(36, ((BOX.width - BOX.padLeft - BOX.padRight) / history.length) * 0.6);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        {history.length === 1
          ? `Bisher ein Bericht vom ${germanDate(latest.date)}. Der Verlauf füllt sich mit jedem wöchentlichen Lauf.`
          : `${history.length} Berichte vom ${germanDate(history[0].date)} bis ${germanDate(latest.date)}.`}{" "}
        Eine Lücke heißt, dass sich in der Woche nichts geändert hat.
      </p>

      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-semibold">Befunde je Stufe</figcaption>
        <svg
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          className="w-full max-w-xl"
          role="img"
          aria-label={`Befunde je Stufe, zuletzt am ${germanDate(latest.date)}: ${SEVERITIES.map(
            (severity) => `${latest.findings[severity]} ${LINE[severity].plural}`,
          ).join(", ")}. Alle Werte stehen in der Tabelle darunter.`}
        >
          <Axis max={max} xs={xs} history={history} />
          {lines.map(({ severity, points }) => {
            const last = points[points.length - 1];
            return (
              <g key={severity} className={LINE[severity].className}>
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray={LINE[severity].dash}
                />
                {points.map((p) => (
                  <Marker key={p.x} severity={severity} x={p.x} y={p.y} />
                ))}
                <text x={last.x + 10} y={last.y + 4} stroke="none" className="fill-current text-[11px] text-[color:var(--color-fg)]">
                  {LINE[severity].plural}
                </text>
              </g>
            );
          })}
        </svg>
        <table className="w-full max-w-xl text-sm">
          <caption className="sr-only">Befunde je Stufe nach Datum des Berichts</caption>
          <thead>
            <tr className="border-b border-[color:var(--color-border)]">
              <th scope="col" className="py-1 text-left">Bericht</th>
              {SEVERITIES.map((severity) => (
                <th key={severity} scope="col" className="py-1 text-right">
                  {LINE[severity].plural}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.date} className="border-b border-[color:var(--color-border)]">
                <th scope="row" className="py-1 text-left font-normal">{germanDate(entry.date)}</th>
                {SEVERITIES.map((severity) => (
                  <td key={severity} className="py-1 text-right tabular-nums">{entry.findings[severity]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figure>

      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-semibold">Ampel der Datensätze</figcaption>
        <svg
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          className="w-full max-w-xl"
          role="img"
          aria-label={`Ampel der ${datasetCount} Datensätze, zuletzt am ${germanDate(latest.date)}: ${TRAFFIC_ORDER.map(
            (status) => `${latest.status[status]} ${TRAFFIC[status].label}`,
          ).join(", ")}. Alle Werte stehen in der Tabelle darunter.`}
        >
          <Axis max={barMax} xs={barXs} history={history} />
          {history.map((entry, index) => {
            let offset = 0;
            return (
              <g key={entry.date}>
                {TRAFFIC_ORDER.map((status) => {
                  const value = entry.status[status];
                  if (value === 0) return null;
                  const top = yPosition(offset + value, barMax, BOX);
                  const bottom = yPosition(offset, barMax, BOX);
                  offset += value;
                  return (
                    <g key={status}>
                      <rect
                        x={barXs[index] - barWidth / 2}
                        y={top}
                        width={barWidth}
                        height={bottom - top}
                        className={BAR[status]}
                        strokeWidth={1.5}
                      />
                      {/* Zahl und Symbol im Segment: Farbe nie allein */}
                      {bottom - top >= 14 && (
                        <text
                          x={barXs[index]}
                          y={(top + bottom) / 2 + 4}
                          textAnchor="middle"
                          className="fill-current text-[11px] font-bold"
                        >
                          {TRAFFIC[status].icon} {value}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          <g className="fill-current text-[11px]">
            {TRAFFIC_ORDER.map((status, index) => (
              <text key={status} x={BOX.width - BOX.padRight + 10} y={BOX.height - BOX.padBottom - index * 16}>
                {TRAFFIC[status].icon} {TRAFFIC[status].label}
              </text>
            ))}
          </g>
        </svg>
        <table className="w-full max-w-xl text-sm">
          <caption className="sr-only">Ampel der Datensätze nach Datum des Berichts</caption>
          <thead>
            <tr className="border-b border-[color:var(--color-border)]">
              <th scope="col" className="py-1 text-left">Bericht</th>
              {TRAFFIC_ORDER.map((status) => (
                <th key={status} scope="col" className="py-1 text-right">
                  {TRAFFIC[status].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.date} className="border-b border-[color:var(--color-border)]">
                <th scope="row" className="py-1 text-left font-normal">{germanDate(entry.date)}</th>
                {TRAFFIC_ORDER.map((status) => (
                  <td key={status} className="py-1 text-right tabular-nums">{entry.status[status]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </div>
  );
}
