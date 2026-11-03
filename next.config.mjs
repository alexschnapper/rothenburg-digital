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
 * GitHub Actions setzt `NEXT_PUBLIC_BUILD_SHA` beim Ausrollen selbst (siehe
 * `docs/DEPLOYMENT.md`, „Automatisches Ausrollen"). Der Git-Aufruf hier greift
 * nur bei einem Build ohne die Variable, etwa lokal. Beim manuellen Build in
 * Plesk schlägt er fehl, dort zeigt der Footer „unbekannt".
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
