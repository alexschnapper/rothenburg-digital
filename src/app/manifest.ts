import type { MetadataRoute } from "next";

/**
 * Web App Manifest (PWA-Grundgerüst, Issue #1).
 *
 * Next liefert das als `/manifest.webmanifest` aus und verlinkt es automatisch
 * im <head> — es braucht kein manuelles <link rel="manifest">.
 *
 * Bewusst NICHT gesetzt: `orientation`. Eine Festlegung auf z. B.
 * "portrait-primary" verstößt gegen WCAG 2.1 SC 1.3.4 (Orientation) — die App
 * muss in beiden Ausrichtungen nutzbar bleiben.
 *
 * Offline-Fähigkeit (Service Worker, Notfall-Infos) ist bewusst nicht Teil
 * davon — das ist Issue #9 im Milestone v1.0.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Rothenburg Digital – Chat-Portal",
    short_name: "Rothenburg",
    description:
      "Barrierefreies Chat-Portal für die Rothenburger Bürgerinnen und Bürger.",
    lang: "de",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#8b1e3f",
    categories: ["government", "travel", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Android beschneidet dieses Icon auf die Gerätemaske, daher randlos
        // mit Motiv in der Safe Zone.
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
