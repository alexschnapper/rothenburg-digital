# Entwicklung

Entwickler-Doku für `rothenburg-digital`. Die öffentliche Projektbeschreibung
steht in [`README.md`](../README.md), das Deployment in
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

> **Warum zwei Dateien?** `README.md` ist die Außenseite des Projekts —
> Besucher des Repositories, Bürgerschaft, RTS. Diese Datei richtet sich an
> alle, die den Code bauen. Vorher stand beides in derselben Datei, auf
> `main` die öffentliche und auf `dev` die technische Fassung; ein Merge
> hätte die eine durch die andere ersetzt (Issue #19).

Barrierefreies Chat-Portal für die Stadt Rothenburg – gebaut mit Next.js 16
(App Router), React 19, TypeScript, Tailwind CSS und dem Vercel AI SDK v7.

## Schnellstart

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen konfigurieren
cp .env.example .env.local
# .env.local öffnen und ANTHROPIC_API_KEY eintragen

# 3. Dev-Server starten
npm run dev      # http://localhost:3000
```

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Hot-Reload |
| `npm run build` | Produktionsbuild (`.next`) — Pflicht vor dem Deploy |
| `npm run start` | Produktionsserver (lokal; auf dem Server läuft `server.js`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## LLM-Provider umschalten

Welcher Anbieter antwortet, entscheidet `LLM_PROVIDER` zur Laufzeit — ohne
Rebuild, nur Neustart:

```bash
LLM_PROVIDER=anthropic npm run dev   # Default, braucht ANTHROPIC_API_KEY
LLM_PROVIDER=mistral   npm run dev   # EU-gehostet, braucht MISTRAL_API_KEY
```

Warum überhaupt umschaltbar: Anthropic bietet Data-Residency nur `us`/`global`,
Mistral ist EU-gehostet (Frankreich) — für eine Stadtverwaltung ein
Datenschutzthema. Details und die Empfehlung pro Umgebung in
[`DEPLOYMENT.md`](./DEPLOYMENT.md#provider-pro-umgebung), Auswirkungen auf die
Abwehr in [`SICHERHEIT-PROMPTS.md`](./SICHERHEIT-PROMPTS.md).

Beim ersten Chat-Aufruf schreibt die App eine Zeile mit Provider, Modell und
Verarbeitungsort ins Log — damit ist ohne Testanfrage nachprüfbar, was aktiv
ist. Nach einem Wechsel gehört ein `npm run redteam` dazu; die Suite nennt am
Ende das Modell, das geantwortet hat.

## Startseite umschalten

```bash
npm run dev                        # Chat-Portal (Default)
LANDING_PAGE=teaser npm run dev    # statische Teaser-Seite, Chat-API aus
```

Der Umschalter liegt in `src/lib/landing.ts`, der Rewrite in `src/proxy.ts`.
Warum das existiert und welche Umgebung was setzt: siehe
[`DEPLOYMENT.md`](./DEPLOYMENT.md#startseite-pro-umgebung).

## Feature-Flags

Unfertige Module sind auf Prod standardmäßig deaktiviert. Aktivierung per
Umgebungsvariable in `.env.local`:

| Flag | Beschreibung |
|---|---|
| `NEXT_PUBLIC_FEATURE_SENSOR_COMMUNITY` | Sensor.Community Integration |
| `NEXT_PUBLIC_FEATURE_RTS_SHOWCASE` | RTS-Showcase (Tourismus-Vorschau) |

Werte: `1` oder `true` aktiviert, alles andere (auch leer) deaktiviert.
Der Code liest die Flags über `@/lib/flags`:

```ts
import { flags, isEnabled } from "@/lib/flags";
if (isEnabled("sensorCommunity")) { /* … */ }
```

## Sicherheit

- `.gitignore` schließt alle `.env*`-Dateien aus (Ausnahme: `.env.example`).
- Der `ANTHROPIC_API_KEY` bleibt server-seitig — die API-Route unter
  `src/app/api/chat/route.ts` liest ihn direkt aus `process.env`.
- Feature-Flags mit `NEXT_PUBLIC_`-Präfix werden zur Build-Zeit ins Client-Bundle
  eingebettet. **Niemals** echte Secrets mit diesem Präfix versehen.
- `/api/chat` ist gegen Prompt-Injection und Token-Missbrauch abgesichert:
  Origin-Prüfung, Rate-Limit, Tages-Token-Budget, Text-Normalisierung,
  Injection-Heuristik und Datenmarkierung — alles serverseitig und
  provider-unabhängig in `src/lib/guard/`. Grenzwerte, Bedrohungsmodell und
  bekannte Lücken: [`SICHERHEIT-PROMPTS.md`](./SICHERHEIT-PROMPTS.md).

Die Abwehr hat eine eigene Angriffs-Suite. Sie spricht ausschließlich HTTP und
ist damit unabhängig vom LLM-Provider:

```bash
npm run dev        # Terminal 1
npm run redteam    # Terminal 2 – 35 Fälle gegen den laufenden Server
```

Beim Entwickeln lohnt es sich, die Limits in `.env.local` großzügiger zu setzen
(`CHAT_RATE_MAX_REQUESTS=60`, `CHAT_SUSPICIOUS_LIMIT=0`) — sonst sperrt man sich
beim Ausprobieren selbst aus.

## Struktur

```
src/
├── proxy.ts                 # Startseite je Umgebung (Next 16: ex middleware)
├── app/
│   ├── api/chat/route.ts    # streamText-Endpoint (Vercel AI SDK)
│   ├── layout.tsx           # Root Layout, lang="de", Skip-Link
│   ├── page.tsx             # Startseite mit Chat
│   └── globals.css          # Tailwind + a11y-Basics
├── components/
│   └── Chat.tsx             # Barrierefreies Chat-UI (useChat)
└── lib/
    ├── chat.ts              # Usage-/Kosten-Metadaten (Typ + Zod-Schema)
    ├── env.ts               # Env-Helfer (Truthy, Ganzzahl, Liste)
    ├── flags.ts             # Feature-Flag-System
    ├── landing.ts           # Chat-Portal oder Teaser (LANDING_PAGE)
    ├── llm/                 # Providerauswahl (Anthropic/Mistral) + Preise
    │   ├── pricing.ts       # Listenpreise, Kostenrechnung
    │   └── provider.ts      # LLM_PROVIDER, Modell, Verarbeitungsort
    └── guard/               # Missbrauchs-Abwehr für /api/chat
        ├── config.ts        # Grenzwerte (per Env überschreibbar)
        ├── log.ts           # pseudonymisiertes Protokoll
        ├── prompt.ts        # System-Prompt + Datenmarkierung
        ├── ratelimit.ts     # Rate-Limit, Kontingente, Token-Budget
        ├── respond.ts       # Ablehnungs-Antworten
        ├── sanitize.ts      # Unicode-Normalisierung
        ├── schema.ts        # Request-Validierung (nur Text)
        └── screen.ts        # Injection-Heuristik

scripts/redteam.mjs         # Angriffs-Suite (HTTP, provider-unabhängig)
tests/redteam-cases.json    # Angriffs- und Kontrollfälle
```

## Branches

| Branch | Bedeutung |
|---|---|
| `main` | veröffentlichter Stand, [rothenburg.digital](https://rothenburg.digital/) |
| `staging` | Vorabnahme, `staging.rothenburg.digital` |
| `dev` | Integrationsbranch, `dev.rothenburg.digital` |
| `feat/*`, `docs/*` | Arbeitsbranches, Pull Request nach `dev` |

Sichtbare Änderungen werden vor dem Commit auf localhost geprüft.

## Barrierefreiheit

- `lang="de"`, semantisches HTML (`main`, `header`, `article`, `form`)
- Skip-to-content Link
- `aria-live="polite"` auf dem Chat-Log
- `prefers-color-scheme` (Dark Mode) und `prefers-reduced-motion` respektiert
- Sichtbarer Fokus-Ring für alle interaktiven Elemente
- Tastatur-Bedienung: Eingabetaste sendet, Umschalt+Eingabe = neue Zeile

## Teaser-Seite und Doc-Root

`public/teaser.html` und `public/rothenburg_digital.svg` stammen von der
statischen Seite, die vor der App unter rothenburg.digital lief. Sie kamen mit
dem Merge von `main` ins Repository (Issue #19). Das SVG ist gleichzeitig das
Logo in der `README.md`.

Beide liegen in `public/`, und das ist Bedingung, nicht Geschmack: die
Teaser-Seite verweist **relativ** auf `rothenburg_digital.svg`. Liegt das SVG
im Wurzelverzeichnis, funktioniert es nur so lange, wie nginx die Datei selbst
ausliefert — sobald die App die Seite ausliefert, wären Logo und Favicon 404.

> **Achtung, teuer gelernt:** Die Datei lag zuerst als `index.html` im
> Wurzelverzeichnis — und **nginx hat sie auf dev ausgeliefert, statt die App
> zu starten**. Bei Plesk zeigt der Document Root auf das App-Verzeichnis, und
> nginx bedient vorhandene Dateien selbst, bevor Passenger überhaupt gefragt
> wird. Auf localhost fällt das nicht auf, weil dort kein nginx davorsteht:
> `next dev` beantwortet `/` immer aus `src/app/page.tsx`.
>
> Daraus zwei Regeln:
>
> 1. **Keine `index.html` (und generell keine ausliefernden Dateien) im
>    Wurzelverzeichnis.** Statisches gehört nach `public/`, von wo Next es
>    ausliefert.
> 2. **Verhalten auf dev prüfen, nicht nur auf localhost.** Alles, was den
>    Webserver betrifft — Doc-Root, Header, Weiterleitungen —, ist auf
>    localhost unsichtbar.
>
> Offene Frage dazu: welche weiteren Dateien im Wurzelverzeichnis nginx
> ausliefert (`package.json`, `README.md`, `.env.example` …) und ob Dotfiles
> zuverlässig gesperrt sind. Auf dev läuft der Test ins Basic-Auth (401) und
> sagt damit nichts aus — mit Zugangsdaten oder gegen die öffentliche Domain
> prüfen:
>
> ```bash
> curl -I -u USER:PASS https://dev.rothenburg.digital/package.json
> curl -I https://rothenburg.digital/package.json
> ```

## Weiterführend

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Umgebungsvariablen, Plesk/Passenger,
  Key-Rotation
- [`SICHERHEIT-PROMPTS.md`](./SICHERHEIT-PROMPTS.md) — Bedrohungsmodell,
  Schichten der Missbrauchs-Abwehr, Red-Team-Suite, bekannte Lücken
- [`../AGENTS.md`](../AGENTS.md) — Hinweise für KI-Assistenten im Repository
