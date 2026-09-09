import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit-Tests für reine Funktionen (Issue #25).
 *
 * Bewusst kein Next-Plugin und keine Browser-/DOM-Umgebung: die erste Runde
 * deckt nur serverunabhängige `src/lib/**`-Logik ab (Guard-Heuristiken,
 * Link-Allowlist, Preisrechnung). Component- und Browser-Tests sind ein
 * eigener, größerer Schritt (Playwright, siehe #25) und kommen später dazu.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
