# Entwicklung

Entwickler-Doku für `rothenburg-digital`. Die öffentliche Projektbeschreibung
steht in [`README.md`](../README.md), das Deployment in
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

> **Warum zwei Dateien?** `README.md` ist die Außenseite des Projekts —
> Besucher des Repositories, Bürgerschaft, RTS. Diese Datei richtet sich an
> alle, die den Code bauen. Vorher stand beides in derselben Datei, auf
> `main` die öffentliche und auf `dev` die technische Fassung; ein Merge
> hätte die eine durch die andere ersetzt (Issue #19).

Offene Daten für Rothenburg, barrierefrei aufbereitet, mit einem Chat als
Demonstrator – gebaut mit Next.js 16
(App Router), React 19, TypeScript, Tailwind CSS und dem Vercel AI SDK v7.

## Schnellstart

```bash
# 0. Node 26 LTS, die Version steht in .nvmrc (#33)
nvm use

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
| `npm run datenqualitaet` | Bericht zur Datenqualität der offenen Daten neu erzeugen (#80) |

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
npm run dev                        # Portal: offene Daten, Chat eingeklappt (Default)
LANDING_PAGE=teaser npm run dev    # statische Teaser-Seite, Chat-API aus
```

Der Umschalter liegt in `src/lib/landing.ts`, der Rewrite in `src/proxy.ts`.
Warum das existiert und welche Umgebung was setzt: siehe
[`DEPLOYMENT.md`](./DEPLOYMENT.md#startseite-pro-umgebung).

**Aufbau des Portals (#82):** Oben stehen die offenen Daten (Kacheln, die
Datenqualität vorn), darunter der Chat als eingeklappter Demonstrator
(`<details id="chat">`). Das gilt für alle Umgebungen gleich, damit dev zeigt,
was später auf staging steht. Der Teaser (`public/teaser.html`, Prod) stellt
ebenfalls die Daten vorn, verlinkt `/daten` aber bewusst noch nicht.

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
│   ├── page.tsx             # Startseite: offene Daten, Chat eingeklappt
│   ├── parken/page.tsx      # Parken & E-Laden aus offenen Daten (#6)
│   ├── essen-trinken/page.tsx # Gastronomie mit Öffnungsstatus (#27)
│   ├── sehenswuerdigkeiten/page.tsx # Sehenswürdigkeiten (#44)
│   ├── kosten/page.tsx      # öffentliche Kostenübersicht (#48)
│   ├── not-found.tsx        # 404 mit Fakt zum Tag (#54)
│   ├── error.tsx            # 500, global-error.tsx als Rückfallebene
│   └── globals.css          # Tailwind + a11y-Basics
├── components/
│   ├── Chat.tsx             # Barrierefreies Chat-UI (useChat)
│   └── PageShell.tsx        # Seitenrahmen: Breite, Kopf, Footer, Druck (#94)
└── lib/
    ├── chat.ts              # Usage-/Kosten-Metadaten (Typ + Zod-Schema)
    ├── env.ts               # Env-Helfer (Truthy, Ganzzahl, Liste)
    ├── flags.ts             # Feature-Flag-System
    ├── landing.ts           # Portal oder Teaser (LANDING_PAGE)
    ├── opendata/            # Offene Daten der Stadt über bydata (#44)
    │   ├── attribution.ts   # Kartenlinks + Quelle unter der Chat-Antwort (#63)
    │   ├── bydata.ts        # Abruf über Such-API, Zwischenspeicher
    │   ├── common.ts        # gemeinsame Helfer (Felder, Adresse, OSM-Link)
    │   ├── openingHours.ts  # Öffnungszeiten lesen, „jetzt geöffnet?"
    │   ├── parking.ts       # Parkplätze + E-Ladesäulen, Prompt-Daten
    │   ├── restaurants.ts   # Gastronomie, Prompt-Daten
    │   ├── shopping.ts      # Einkaufen aus mehreren Datensätzen (#62)
    │   ├── sights.ts        # Sehenswürdigkeiten, Prompt-Daten
    │   ├── query.ts         # Frage auswerten (Stichwörter, jetzt, Wochentag)
    │   └── dailyFact.ts     # Fakt zum Tag für die 404-Seite
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
E-Ladesäulen (#6), Restaurants und Cafés (#27), Einkaufen (#62),
Sehenswürdigkeiten sowie Notfall und Hitze (#61). Die Daten erscheinen je an
zwei Stellen: auf einer eigenen Seite (`/parken`, `/essen-trinken`,
`/einkaufen`, `/sehenswuerdigkeiten`, `/notfall-hitze`) und im Chat.

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
  darzustellen.
- **Kartenlinks und Quelle vom Server (#63):** Das Modell bekommt keine
  Koordinaten und schreibt weder Kartenlinks noch „Quelle: …". Nach der
  Antwort sucht `attributionMarkdown()` (`attribution.ts`) im Text, welche
  Orte aus den eingebundenen Daten genannt sind (auch ohne Gattungswort wie
  „Restaurant" oder Ortszusatz, längster Name gewinnt), und `/api/chat` hängt
  deren OSM-Links sowie Quelle, Stand und Lizenz der Datensätze als eigenen
  Textteil an. Nennt die Antwort keinen Ort, entfällt der Anhang. Neue
  Datensätze brauchen dafür eine `…Places()`-Funktion, die in `route.ts`
  in die Liste `places` kommt. Der Anhang ist bisher immer deutsch (#4).
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
  Modell nur die fünf passendsten Betriebe mit allen Angaben, die übrigen nur
  mit Namen (`selectRestaurants()` in `restaurants.ts`). Punkte gibt es für
  Name, Art, Küche, Begriffe aus der Beschreibung und den Zeitbezug der Frage
  („jetzt", Wochentag, heute/morgen — `query.ts`). Das senkt die Eingabe-Token
  einer Essensfrage von rund 9.500 auf 6.300, und die Obergrenze von fünf
  genannten Betrieben hält. Für weitere Datensätze dieselben Bausteine nutzen.

- **Sehenswürdigkeiten:** `skg-venus-sehenswuerdigkeiten` enthält auch
  „Top 10", „Museum" und „Jüdisches Rothenburg" (Teilmengen),
  „Stadtführungen" ist leer (Stand November 2026). Öffnungszeiten stehen nur
  als Freitext bei wenigen Orten und werden wörtlich weitergegeben. Bekannte
  Orte fehlen (Plönlein, Burggarten, St. Jakob); der Chat darf sie nennen,
  aber ohne Öffnungszeiten, Preise oder Adressen.
- **Lizenzen (#66):** Die Lizenz gilt je Datensatz und steht in den Metadaten
  der JSON-Distribution (`Dataset.license`). Restaurants und
  Sehenswürdigkeiten stehen unter CC BY 4.0, Parken, Ladesäulen,
  Defibrillatoren und Hitzeorte unter CC0, Einkaufsmöglichkeiten und Einzelhandel unter CC BY-SA 4.0.
  Die Angabe pro Objekt in den Daten (oft „CC0") ist nicht maßgeblich. Die
  Seiten zeigen Quelle, Stand und Lizenz über `OpenDataSources`.
- **Einkaufen (#62):** `shopping.ts` führt `skg-venus-einkaufsmoeglichkeiten`
  (Kern, CC BY-SA 4.0), `-einzelhandel` (Stand 05.11.2026 dieselben 54
  Einträge mit denselben IDs, fügt also nichts hinzu), `-handmade`
  und die beiden `-direktvermarkter-*` über die gemeinsame `id` zusammen. Der
  erste Datensatz in `SHOP_DATASETS` gewinnt und liefert Quelle und Lizenz des
  Eintrags; Gastronomie (z. B. eine Kaffeerösterei aus „Handmade") fällt weg,
  sie gehört nach `/essen-trinken`. `skg-venus-geniessen-ob-der-tauber`
  enthält nur zwei Restaurants, die schon im Restaurant-Datensatz stehen, der
  Wanderweg-Datensatz nur einen Eintrag (W6) — beide sind bewusst nicht
  eingebunden.
- **Höchstens fünf:** Die Vorauswahl gibt dem Modell genau fünf Einträge mit
  Details. „Höchstens fünf" im Prompt allein hielt es nicht zuverlässig ein.

Weitere Datensätze der Stadt (Restaurants, Sehenswürdigkeiten, Termine …)
lassen sich mit `loadDataset(<id>)` genauso laden. Welcher Datensatz wofür
genutzt wird, steht in `src/lib/opendata/inventory.ts` (#66).

### Datenqualitäts-Bericht (#80)

Prüft alle Datensätze des Katalogs `rothenburg-import` (die Datensätze der
Stadt auf `rothenburg.bydata.de`) nach festen Regeln, ohne Sprachmodell. Die
Befunde sollen nachprüfbar und bei gleichen Daten gleich sein, weil sie als
Rückmeldung an die Datenhalter gedacht sind.

- **Regeln:** `src/lib/opendata/quality.ts`, Tests daneben. Drei Stufen:
  *Fehler* (leer, nicht abrufbar, Postleitzahl, Koordinaten), *Warnung*
  (Stand passt nicht zur angegebenen Häufigkeit, Lizenzen widersprechen sich,
  Dubletten, unlesbare Öffnungszeiten, fehlt laut Referenzliste) und
  *Hinweis* (fehlende Angaben, die die Nutzung nicht verhindern). Die Ampel
  je Datensatz richtet sich nach Fehlern und Warnungen.
- **Bestandsaufnahme (#66):** `src/lib/opendata/inventory.ts` hält je
  Datensatz fest, ob und wo rothenburg.digital ihn nutzt (Seiten, Chat) und
  warum manche nicht. Bericht und `/daten` zeigen das je Datensatz an.
  Taucht im Katalog ein Datensatz auf, der dort fehlt, meldet der Bericht
  „noch nicht bewertet“. Wer einen Datensatz neu einbindet, trägt ihn dort
  mit ein. Daten, die das Portal zeigt, die aber nicht im Katalog der Stadt
  stehen (Landesamt für Statistik u. a.), stehen in `OTHER_SOURCES`.
- **Gleicher Punkt:** Einträge an verschiedenen Straßen auf exakt denselben
  Koordinaten meldet der Bericht als Warnung. Dieselbe Erkennung sorgt in
  `withReliableMapUrls()` dafür, dass solche Einträge eine Adresssuche statt
  des falschen Punkts verlinken.
- **Referenzen:** `REFERENCES` listet von Hand, was laut einer offiziellen
  Quelle im Datensatz stehen müsste (heute: Ladesäulen an P1, P4, P5 und am
  Bahnhof laut rothenburg.de). Ändert sich die Quelle, die Liste anpassen.
- **Ausgabe:** `npm run datenqualitaet` (`scripts/datenqualitaet.mts`, läuft
  über `tsx`) schreibt `reports/datenqualitaet.json` und
  `docs/datenqualitaet.md` und hängt eine Zeile an `reports/verlauf.json` an
  (Ampel-Zahlen, Befunde je Stufe, Ampel je Datensatz). Ist der Inhalt bis
  auf den Zeitpunkt gleich, bleiben alle Dateien unverändert; eine Lücke im
  Verlauf heißt also „nichts geändert“. Die Texte der Befunde enthalten deshalb
  nichts Relatives wie „vor 51 Tagen".
- **Seite `/daten`:** zeigt den eingecheckten Bericht, keinen Live-Abruf. Neue
  Befunde erscheinen erst nach der Durchsicht des PRs.
- **Dashboard (#84):** Logik in `src/lib/opendata/dashboard.ts`, Darstellung in
  `src/components/daten/`. Hauptansicht ist die Matrix Datensatz × Regel
  (Spalten nur für Regeln mit Befund, schwere und häufige zuerst); eine Zelle
  springt zum Befund (`/daten#<datensatz>--<regel>`), jeder Datensatz hat
  einen Anker (`/daten#skg-venus-e-ladesaeulen`). Auf dem Handy wird die
  Matrix zur Liste je Regel. Der Verlauf aus `reports/verlauf.json` ist SVG vom
  Server, jeweils mit Tabelle darunter; die Seite braucht kein JavaScript.
  Filter `schwere`, `regel`, `datensatz` stehen in der Adresse; leere oder
  unbekannte Werte leiten auf die bereinigte Adresse um. `/daten/befunde.csv`
  exportiert die Befunde (Semikolon, UTF-8 mit BOM für Excel, Formeln aus
  fremden Namen entschärft) und versteht dieselben Filter. Die Druckansicht
  blendet Filter, Navigation und Footer aus. Die Detailansicht kennt je
  Befund nur Anzahl und bis zu drei Beispiele, so wie der Bericht.
- **Workflow:** `.github/workflows/datenqualitaet.yml`, montags 05:00 UTC und
  von Hand. Prüft `dev`, schreibt den Bericht auf den festen Branch
  `bericht/datenqualitaet` und öffnet oder aktualisiert einen PR nach `dev`.
  Neue Befunde kommen als Kommentar in ein Sammel-Issue (Label
  `datenqualitaet`). Voraussetzungen und Grenzen stehen im Kopf der Datei.
- **Fremde Inhalte:** Namen aus den Daten landen in Markdown, PRs und
  Issue-Kommentaren. `cleanExample()` entfernt Markdown-Zeichen und `@`,
  damit ein Name weder verlinkt noch jemanden benachrichtigt.

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
- **Breite (#94):** Alle Inhaltsseiten nutzen `src/components/PageShell.tsx`.
  Der Rahmen ist auf dem Desktop breit (`max-w-screen-2xl`), Fließtext,
  Infokästen und Kopf bleiben mit `PROSE` (`max-w-3xl`) bei höchstens etwa
  80 Zeichen pro Zeile (WCAG 1.4.8). Breit werden nur Kartenlisten
  (`CARD_GRID`: 1, ab `sm` 2, ab `xl` 3 Spalten), Kacheln und Tabellen; zwei
  Bereiche nebeneinander mit `SIDE_BY_SIDE` (Parken | E-Laden,
  Defibrillatoren | Hitze, Tage | Monate auf `/kosten`). Raster immer mit
  `grid-cols-1` statt impliziter Spalte, sonst schiebt ein langes Wort (URL)
  die Seite bei 320 px über den Rand (WCAG 1.4.10). `e2e/layout.spec.ts`
  prüft je Seite Breite, Zeilenlänge und horizontales Scrollen bei 390 und
  320 px. Der Chat-Demonstrator auf der Startseite bleibt schmal,
  `/datenschutz` ist reiner Text und hat einen eigenen, schmalen Rahmen.
- Druckansicht: `PageShell` blendet Zurück-Link und Footer aus, Karten
  brechen nicht über zwei Seiten.

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
