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
# .env.local öffnen und MISTRAL_API_KEY eintragen

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
| `npm run redteam` | Angriffs-Suite gegen den laufenden Server (braucht API-Key) |

`.github/workflows/ci.yml` fährt bei jedem Push und PR auf `dev` und `main`
genau die drei prüfbaren Schritte: `npm ci --include=dev`, `npm run typecheck`,
`npm run lint`, `npm run build`. Ohne Secrets — der API-Key ist ein reines
Runtime-Secret, der Build braucht ihn nicht.

`npm run redteam` läuft **nicht** in CI: die Suite braucht einen Key und kostet
pro Lauf echte Modellkosten. Sie gehört an einen bewussten Zeitpunkt — vor einem
Release und nach einem Providerwechsel.

## LLM-Provider umschalten

Welcher Anbieter antwortet, entscheidet `LLM_PROVIDER` zur Laufzeit — ohne
Rebuild, nur Neustart. **Seit #32 ist `mistral` der einheitliche Default für
alle vier Umgebungen** (localhost, dev, staging, Prod) — so wird lokal unter
denselben Bedingungen getestet wie live, und der App-Key ist nicht mit dem
separaten Claude-Abo (Claude Code) zu verwechseln:

```bash
LLM_PROVIDER=mistral   npm run dev   # Default, EU-gehostet, braucht MISTRAL_API_KEY
LLM_PROVIDER=anthropic npm run dev   # Ausnahmefall, braucht ANTHROPIC_API_KEY
```

Warum Mistral der Default ist: Anthropic bietet Data-Residency nur
`us`/`global`, Mistral ist EU-gehostet (Frankreich) — für eine Stadtverwaltung
ein Datenschutzthema. Details in
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
│   ├── parken/page.tsx      # Parken & E-Laden aus offenen Daten (#6)
│   ├── essen-trinken/page.tsx # Gastronomie mit Öffnungsstatus (#27)
│   ├── kosten/page.tsx      # öffentliche Kostenübersicht (#48)
│   ├── not-found.tsx        # 404 mit Fakt zum Tag (#54)
│   ├── error.tsx            # 500, global-error.tsx als Rückfallebene
│   └── globals.css          # Tailwind + a11y-Basics
├── components/
│   └── Chat.tsx             # Barrierefreies Chat-UI (useChat)
└── lib/
    ├── chat.ts              # Usage-/Kosten-Metadaten (Typ + Zod-Schema)
    ├── env.ts               # Env-Helfer (Truthy, Ganzzahl, Liste)
    ├── flags.ts             # Feature-Flag-System
    ├── landing.ts           # Chat-Portal oder Teaser (LANDING_PAGE)
    ├── opendata/            # Offene Daten der Stadt über bydata (#44)
    │   ├── bydata.ts        # Abruf über Such-API, Zwischenspeicher
    │   ├── common.ts        # gemeinsame Helfer (Felder, Adresse, OSM-Link)
    │   ├── openingHours.ts  # Öffnungszeiten lesen, „jetzt geöffnet?"
    │   ├── parking.ts       # Parkplätze + E-Ladesäulen, Prompt-Daten
    │   └── restaurants.ts   # Gastronomie, Prompt-Daten
    ├── usage/history.ts     # Tagessummen für /kosten, als JSON-Datei
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

## Offene Daten (bydata)

Anbindung an die offenen Daten der Stadt (Issue #44): Parkplätze und
E-Ladesäulen (#6) sowie Restaurants und Cafés (#27). Die Daten erscheinen je
an zwei Stellen: auf einer eigenen Seite (`/parken`, `/essen-trinken`) und im
Chat.

- **Einstieg ist bydata, nicht der Dateiserver.** `src/lib/opendata/bydata.ts`
  fragt die Such-API (`https://open.bydata.de/api/hub/search/datasets/<id>`)
  und liest dort die Download-Adresse der JSON-Datei. Heute liegt sie auf
  `opendata.rothenburg-tourismus.de`; ändert sich das mit dem offiziellen
  Zugang, greift es ohne Codeänderung. Verlinkt werden nur die Datensatzseiten
  auf `rothenburg.bydata.de`.
- **Zwischenspeicher:** 6 Stunden im Prozess (die Daten ändern sich
  wöchentlich). Fällt die Quelle aus, bleibt der letzte Stand; gab es noch
  keinen, sagen Seite und Chat ehrlich, dass keine Daten vorliegen.
- **Chat:** Die Daten kommen nur in den Prompt, wenn eine der letzten drei
  Fragen dazu passt (`isParkingQuestion`, `isFoodQuestion`), sonst kostet
  jede Anfrage rund 1.500 (Parken) bzw. 2.000 Token (Gastronomie) mehr. Sie stehen als Fremdinhalt im
  `<fremdquelle>`-Marker (#16). Der Prompt verbietet, sie als vollständig
  darzustellen, und verlangt Quelle und Stand je Datensatz.
- **Datenlücken:** Preise, Belegung und Stellplatzzahl fehlen in den Daten.
  Der bydata-Datensatz zu Ladesäulen ist unvollständig (Stand November 2026
  nur Kapellenplatz). Chat und Seite verweisen deshalb immer auf die
  offizielle Übersicht https://www.rothenburg.de/besuchen/mobilitaet/e-tankstellen
  und auf Lade-Apps (ohne Gewähr). Zwei Regeln von dieser Seite (3 Stunden
  kostenfrei für E-Autos, 2 Stunden Höchstparkdauer in der Altstadt) stehen
  von Hand in `parkingSection()` (`src/lib/guard/prompt.ts`) und auf
  `/parken` — bei Änderungen der Stadt dort nachziehen.

- **Öffnungszeiten (#27):** `openingHours.ts` liest das Format der Daten
  (`Mo, Di 11:30-14:30; Sa ab 11:30`, auch über Mitternacht) und rechnet aus,
  ob gerade geöffnet ist — wie bei der Tourist-Information (#34) verrechnet
  sich das Modell sonst. Im Prompt steht je Betrieb `Jetzt: …`. Unlesbare
  Angaben ergeben keinen Status statt eines geratenen. An Feiertagen gibt es
  bewusst keinen Status, weil die Daten dazu nichts sagen.
- **Gastronomie-Lücken:** Der Datensatz enthält nur einen Teil der Betriebe
  (Stand November 2026: 28), keine Speisekarten und keine Preise. Chat und
  Seite sagen das und verweisen auf https://www.rothenburg-tourismus.de.

- **Vorauswahl durch den Server (#44):** Bei der Gastronomie bekommt das
  Modell nur die sechs passendsten Betriebe mit allen Angaben, die übrigen nur
  mit Namen (`selectRestaurants()` in `restaurants.ts`). Punkte gibt es für
  Name, Art, Küche, Begriffe aus der Beschreibung und den Zeitbezug der Frage
  („jetzt", Wochentag, heute/morgen — `query.ts`). Das senkt die Eingabe-Token
  einer Essensfrage von rund 9.500 auf 6.300, und die Obergrenze von fünf
  genannten Betrieben hält. Für weitere Datensätze dieselben Bausteine nutzen.

Weitere Datensätze der Stadt (Restaurants, Sehenswürdigkeiten, Termine …)
lassen sich mit `loadDataset(<id>)` genauso laden; die Liste steht in #44.

## Branches

| Branch | Bedeutung | Schutz |
|---|---|---|
| `main` | veröffentlichter Stand, [rothenburg.digital](https://rothenburg.digital/) | Pull Request Pflicht (0 Reviews), Pflicht-Check `verify`, aktueller Stand nötig, kein Force-Push, kein Löschen — **auch für Admins** |
| `staging` | Vorabnahme, `staging.rothenburg.digital` | – |
| `dev` | Integrationsbranch, `dev.rothenburg.digital` | bewusst **kein** Schutz: direkte Commits für Hotfixes und Zwischenstände bleiben möglich. CI läuft trotzdem und meldet sich, wenn etwas rot wird |
| `feat/*`, `docs/*` | Arbeitsbranches, Pull Request nach `dev` | – |

Sichtbare Änderungen werden vor dem Commit auf localhost geprüft. Für alles,
was der Webserver entscheidet (Doc-Root, Header, Weiterleitungen), sagt
localhost nichts aus — das gehört auf dev geprüft, siehe „Teaser-Seite und
Doc-Root".

Vor `dev` → `main` gilt zusätzlich die Reihenfolge aus
[`DEPLOYMENT.md`](./DEPLOYMENT.md) („Aktueller Stand der Umgebungen"): ohne
Node-App auf Prod nimmt dieser Merge die Seite offline. Der Branch-Schutz
verhindert das **nicht** — er blockiert nur direkte Pushes, nicht das Mergen
eines PRs.

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
