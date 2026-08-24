/**
 * Erzeugt die PWA-Icons aus Code — reproduzierbar, ohne externe Bildwerkzeuge.
 *
 *   node scripts/generate-icons.mjs
 *
 * Motiv: stilisiertes Stadttor mit Turm (Rothenburg) in der Markenfarbe.
 * Gerendert wird 4-fach überabgetastet und anschließend gemittelt, damit die
 * Kanten glatt sind. Ausgabe: public/icons/*.png
 *
 * Warum generiert und nicht gezeichnet: so bleibt das Motiv im Repo als Code
 * nachvollziehbar und lässt sich bei einem Rebranding in einer Datei ändern.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BRAND = [0x8b, 0x1e, 0x3f]; // #8B1E3F
const INK = [0xff, 0xff, 0xff]; // Motivfarbe (weiß)
const SS = 4; // Supersampling-Faktor

// --- PNG-Kodierung (RGBA, 8 bit) ------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // Farbtyp RGBA
  // 10..12 = Kompression/Filter/Interlace = 0

  // Jede Scanline wird mit Filtertyp 0 (None) eingeleitet.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const src = y * width * 4;
    const dst = y * (1 + width * 4);
    raw[dst] = 0;
    rgba.copy(raw, dst + 1, src, src + width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Motiv ----------------------------------------------------------------
// Alle Koordinaten in 0..1, damit das Motiv größenunabhängig ist.

/** Liegt (x,y) innerhalb eines Rechtecks? */
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** Liegt (x,y) im Dreieck (Turmdach)? Apex oben mittig, Basis auf y1. */
function inRoof(x, y, apexX, apexY, halfWidth, y1) {
  if (y < apexY || y > y1) return false;
  const t = (y - apexY) / (y1 - apexY);
  return Math.abs(x - apexX) <= halfWidth * t;
}

/** Abgerundetes Quadrat (für nicht-maskable Icons). */
function inRoundedSquare(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Farbe eines Punkts. `bleed` = randlos (maskable / Apple), sonst abgerundet.
 * `motifScale` < 1 schrumpft das Motiv zur Mitte — nötig für maskable, weil
 * Android das Icon auf die innere Safe Zone (~80 %) beschneidet.
 * Rückgabe: [r,g,b,a]
 */
function sample(px, py, bleed, motifScale) {
  if (!bleed && !inRoundedSquare(px, py, 0.18)) return [0, 0, 0, 0];

  const x = 0.5 + (px - 0.5) / motifScale;
  const y = 0.5 + (py - 0.5) / motifScale;

  // Torbogen: Halbkreis auf Rechteck — wird aus dem Turmkörper ausgestanzt.
  const archR = 0.085;
  const archCx = 0.5;
  const archCy = 0.605;
  const inArchTop =
    (x - archCx) ** 2 + (y - archCy) ** 2 <= archR * archR && y <= archCy;
  const inArch =
    inArchTop || inRect(x, y, archCx - archR, archCy, archCx + archR, 0.8);

  // Turmkörper (schlank + hoch) + steiles Dach + zwei Fenster
  const body = inRect(x, y, 0.38, 0.32, 0.62, 0.8);
  const roof = inRoof(x, y, 0.5, 0.12, 0.185, 0.32);
  const winL = inRect(x, y, 0.432, 0.395, 0.472, 0.46);
  const winR = inRect(x, y, 0.528, 0.395, 0.568, 0.46);
  // Sockel als durchgehender Balken, damit das Tor „steht“.
  const base = inRect(x, y, 0.3, 0.8, 0.7, 0.845);

  const isInk = ((body || roof) && !inArch && !winL && !winR) || base;
  return isInk ? [...INK, 255] : [...BRAND, 255];
}

// --- Rendern --------------------------------------------------------------

function render(size, bleed, motifScale) {
  const rgba = Buffer.alloc(size * size * 4);
  const n = SS * SS;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const [sr, sg, sb, sa] = sample(x, y, bleed, motifScale);
          // Über Alpha vorgewichtet mitteln, damit transparente Ränder nicht
          // in Richtung Schwarz ausbluten.
          const w = sa / 255;
          r += sr * w;
          g += sg * w;
          b += sb * w;
          a += sa;
        }
      }
      const alpha = a / n;
      const i = (py * size + px) * 4;
      if (alpha > 0) {
        const w = a / 255;
        rgba[i] = Math.round(r / w);
        rgba[i + 1] = Math.round(g / w);
        rgba[i + 2] = Math.round(b / w);
      }
      rgba[i + 3] = Math.round(alpha);
    }
  }

  return encodePng(size, size, rgba);
}

const TARGETS = [
  { file: "icon-192.png", size: 192, bleed: false, motifScale: 1 },
  { file: "icon-512.png", size: 512, bleed: false, motifScale: 1 },
  // Android beschneidet maskable-Icons — Motiv auf die Safe Zone verkleinern.
  { file: "icon-maskable-512.png", size: 512, bleed: true, motifScale: 0.78 },
  // iOS rundet nur die Ecken, beschneidet aber nicht.
  { file: "apple-touch-icon.png", size: 180, bleed: true, motifScale: 0.92 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, bleed, motifScale } of TARGETS) {
  const png = render(size, bleed, motifScale);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file.padEnd(24)} ${size}x${size}  ${png.length} B`);
}
