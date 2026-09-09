import { execSync } from "node:child_process";

/**
 * CSP-Direktiven laut Issue #15 — bewusst nur diese drei, nicht `script-src`
 * oder `default-src`: Next injiziert eigene Inline-Scripts fürs Hydration
 * (RSC-Payload), ein strikter `default-src 'self'` würde die ohne
 * Nonce-Verkabelung blockieren. Das ist ein größeres, separates Vorhaben.
 * Diese drei Direktiven schließen dagegen genau die Lücke, die mit dem
 * Markdown-Renderer entstanden ist: Bilder/Verbindungen aus einer
 * Modellantwort werden nicht automatisch nachgeladen, und die Seite lässt
 * sich nicht in einen fremden Frame einbetten.
 */
const csp = [
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Commit-Kurzhash des Builds, für Footer und Server-Log (`src/lib/buildInfo.ts`).
 *
 * Warum hier und nicht als CI-Variable: der Git-Deploy auf diesem Host baut
 * lokal auf dem Server (siehe `docs/DEPLOYMENT.md`, „Bekannte
 * Server-Eigenheiten") — es gibt keine CI-Pipeline, die eine Variable
 * mitgeben könnte. `next.config.mjs` läuft aber so oder so vor jedem Build,
 * mit Zugriff auf das `.git`-Verzeichnis, das der Git-Deploy im
 * App-Verzeichnis stehen lässt. `NEXT_PUBLIC_BUILD_SHA` gewinnt, falls doch
 * einmal von außen gesetzt (z. B. testweise), sonst wird frisch ermittelt.
 */
if (!process.env.NEXT_PUBLIC_BUILD_SHA) {
  try {
    process.env.NEXT_PUBLIC_BUILD_SHA = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // Kein .git-Verzeichnis (z. B. ein Deploy ohne Git) — kein harter Fehler,
    // der Fallback in buildInfo.ts greift dann.
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },
};

export default nextConfig;
