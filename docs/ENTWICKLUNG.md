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

## Struktur

```
src/
├── app/
│   ├── api/chat/route.ts    # streamText-Endpoint (Vercel AI SDK)
│   ├── layout.tsx           # Root Layout, lang="de", Skip-Link
│   ├── page.tsx             # Startseite mit Chat
│   └── globals.css          # Tailwind + a11y-Basics
├── components/
│   └── Chat.tsx             # Barrierefreies Chat-UI (useChat)
└── lib/
    ├── chat.ts              # Usage-Metadaten (Typ + Zod-Schema)
    └── flags.ts             # Feature-Flag-System
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

## Altbestand im Wurzelverzeichnis

`index.html` und `rothenburg_digital.svg` stammen von der statischen
Teaser-Seite, die vor der App unter rothenburg.digital lief. Sie kamen mit dem
Merge von `main` hierher (Issue #19). Das SVG bindet die `README.md` als Logo
ein; die `index.html` liefert Passenger im Next-Setup nicht aus. Ob sie beim
Livegang der App gelöscht wird, ist noch nicht entschieden.

## Weiterführend

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Umgebungsvariablen, Plesk/Passenger,
  Key-Rotation
- [`../AGENTS.md`](../AGENTS.md) — Hinweise für KI-Assistenten im Repository
