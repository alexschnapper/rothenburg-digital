import { ImageResponse } from "next/og";

import { CHART_NAMES, EXPORT_SIZE, chartSvg, type ChartName } from "@/lib/opendata/charts";
import { chartData } from "@/lib/opendata/reportFiles";

/**
 * Export je Chart (#93): `/daten/charts/ampel-heute.svg` bzw. `.png`, mit
 * Titel, Legende, Stand und Quelle. Daten aus dem eingecheckten Bericht wie
 * `/daten`, kein Live-Abruf.
 *
 * PNG für Google Docs/Slides und E-Mails, die kein SVG annehmen. Gerendert
 * mit `ImageResponse` aus Next.js (Satori und Resvg), also ohne zusätzliche
 * Abhängigkeit: Das SVG geht als Bild hinein und kommt als PNG heraus.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ datei: string }> }) {
  const { datei } = await params;
  const match = datei.match(/^([a-z-]+)\.(svg|png)$/);
  const name = match?.[1] as ChartName | undefined;
  if (!match || !name || !CHART_NAMES.includes(name)) {
    return new Response("Unbekannter Chart.", { status: 404 });
  }

  const data = chartData();
  const svg = chartSvg(name, data, { frame: true });
  const filename = `${name}-${data.date}.${match[2]}`;
  const disposition = `inline; filename="${filename}"`;

  if (match[2] === "svg") {
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": disposition },
    });
  }

  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- Satori kennt nur <img>
    <img src={src} width={EXPORT_SIZE.width} height={EXPORT_SIZE.height} alt="" />,
    { ...EXPORT_SIZE, headers: { "Content-Disposition": disposition } },
  );
}
