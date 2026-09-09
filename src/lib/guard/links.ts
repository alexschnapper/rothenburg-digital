/**
 * Hostnamen-Allowlist für Links in gerenderten Markdown-Antworten (Issue #15).
 *
 * Läuft im Browser (Chat.tsx ist ein Client Component) — bewusst eine feste
 * Liste statt einer Env-Variable: ein Tippfehler in einer Env-Konfiguration
 * dürfte hier nicht versehentlich beliebige Domains freischalten.
 *
 * **Exakte Hostnamen, kein `*.rothenburg.de`-Wildcard.** Eine
 * Subdomain-Freigabe hätte auch plausibel klingende, aber erfundene
 * Adressen durchgelassen — das Modell hat einmal `www.tourismus.rothenburg.de`
 * genannt, das es so nicht gibt (die echte Seite ist die eigenständige Domain
 * `rothenburg-tourismus.de`). Jede neue Subdomain kommt deshalb erst dazu,
 * wenn sie tatsächlich geprüft und gebraucht wird — nicht auf Zuruf des
 * Modells.
 */
export const ALLOWED_LINK_HOSTS = [
  "rothenburg.de",
  "www.rothenburg.de",
  "stadt.rothenburg.de",
  "ratsinfo.rothenburg.de",
  "rothenburg-tourismus.de",
  "www.rothenburg-tourismus.de",
  "sensor.community",
  "www.sensor.community",
  // Kartenlinks zu vom Modell genannten Orten (Issue #28) — bewusst
  // OpenStreetMap statt Google Maps: keine Tracking-Anfrage an einen
  // weiteren US-Anbieter, passt zur EU-Verarbeitung über Mistral (#12).
  "www.openstreetmap.org",
  "openstreetmap.org",
] as const;

/**
 * Adressen zu einem Allowlist-Hostnamen sind erlaubt — auch ohne
 * ausgeschriebenes Protokoll im Quelltext.
 *
 * `remark-gfm` erkennt nach GFM-Spec auch bloße `www.`-Adressen als Autolink
 * (ohne `[Text](URL)`-Syntax) und setzt dafür selbst ein `http://` davor. Wer
 * nur `https:` zuließe, würde genau diese — häufigste — Schreibweise wieder
 * aussperren.
 */
export function isAllowedLinkHref(href: string | undefined): href is string {
  if (!href) return false;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  return (ALLOWED_LINK_HOSTS as readonly string[]).includes(url.hostname);
}

/**
 * Ziel-URL für den `href`, garantiert `https:` — unabhängig davon, ob der
 * Autolink (z. B. aus einer bloßen `www.`-Adresse) mit `http:` erzeugt wurde.
 * Nur für Adressen aufrufen, die `isAllowedLinkHref` schon bestätigt hat.
 */
export function toSafeLinkHref(href: string): string {
  const url = new URL(href);
  url.protocol = "https:";
  return url.toString();
}
