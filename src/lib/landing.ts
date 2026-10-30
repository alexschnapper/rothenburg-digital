import { isTruthy } from "@/lib/env";

/**
 * Was zeigt `/` — das Chat-Portal oder die Teaser-Seite?
 *
 * Hintergrund: Das Portal soll auf localhost, dev und staging sichtbar sein,
 * auf Prod aber noch nicht. Bis jetzt wurde das über die Anwesenheit einer
 * `index.html` im Doc-Root gesteuert — unsichtbar im Code, und beim Merge aus
 * #19 hat genau diese Datei versehentlich auch dev auf den Teaser gesetzt.
 * Deshalb steht die Entscheidung jetzt explizit in einer Env-Variable.
 *
 * **Default ist `chat`.** Nur Prod schaltet mit `LANDING_PAGE=teaser` ab. Die
 * umgekehrte Voreinstellung (überall aus, jede Umgebung schaltet frei) wäre
 * näher an der Flag-Konvention des Projekts, hätte aber denselben Fehlerfall wie
 * bisher: fehlt das Flag auf dev, steht dort wieder der Teaser, und niemand
 * merkt es. Der Preis dieser Wahl: die Variable muss auf Prod **gesetzt sein**
 * — siehe `docs/DEPLOYMENT.md`.
 *
 * Kein `NEXT_PUBLIC_`: der Wert wird zur Laufzeit gelesen, ein Umschalten
 * braucht also nur einen App-Neustart und keinen Rebuild.
 */

export type LandingMode = "chat" | "teaser";

/** Pfad der statischen Teaser-Seite (liegt in `public/`). */
export const TEASER_PATH = "/teaser.html";

export function landingMode(): LandingMode {
  return (process.env.LANDING_PAGE ?? "").trim().toLowerCase() === "teaser"
    ? "teaser"
    : "chat";
}

/**
 * Ist der Chat in dieser Umgebung überhaupt freigegeben?
 *
 * Im Teaser-Modus gilt auch `/api/chat` als abgeschaltet — sonst wäre auf Prod
 * eine sichtbare Teaser-Seite mit einem offenen, kostenpflichtigen
 * LLM-Endpoint dahinter erreichbar. Wer beides ausdrücklich will (z. B. um die
 * API vor dem Livegang der Seite zu testen), setzt `CHAT_DISABLED=0`.
 */
export function chatEnabled(): boolean {
  const explicit = process.env.CHAT_DISABLED;
  if (explicit !== undefined && explicit.trim() !== "") {
    return !isTruthy(explicit);
  }
  return landingMode() === "chat";
}
