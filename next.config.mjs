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
