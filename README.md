# rothenburg-digital

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

## Barrierefreiheit

- `lang="de"`, semantisches HTML (`main`, `header`, `article`, `form`)
- Skip-to-content Link
- `aria-live="polite"` auf dem Chat-Log
- `prefers-color-scheme` (Dark Mode) und `prefers-reduced-motion` respektiert
- Sichtbarer Fokus-Ring für alle interaktiven Elemente
- Tastatur-Bedienung: Eingabetaste sendet, Umschalt+Eingabe = neue Zeile
