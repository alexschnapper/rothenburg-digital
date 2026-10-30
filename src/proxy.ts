import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { TEASER_PATH, landingMode } from "@/lib/landing";

/**
 * Startseite je Umgebung (siehe `src/lib/landing.ts`).
 *
 * Im Teaser-Modus wird `/` intern auf die statische Seite umgeschrieben —
 * **Rewrite, kein Redirect**: die Adresse bleibt `https://rothenburg.digital/`,
 * und die Seite ist byte-genau die, die dort bisher lief. Damit gibt es beim
 * Umschalten keine Design-Überraschung.
 *
 * Warum hier und nicht in `page.tsx`: der Wert wird pro Anfrage gelesen, ein
 * Umschalten braucht also keinen Rebuild — und beide Varianten bleiben statisch
 * optimierbar.
 *
 * In Next.js 16 heißt diese Datei `proxy.ts` (vormals `middleware.ts`).
 */
export function proxy(request: NextRequest) {
  if (landingMode() === "teaser") {
    return NextResponse.rewrite(new URL(TEASER_PATH, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Nur die Startseite. Alles andere — auch `/api/chat` — läuft unverändert
  // durch; ob der Chat antwortet, entscheidet die Abwehr (`chatEnabled()`).
  matcher: "/",
};
