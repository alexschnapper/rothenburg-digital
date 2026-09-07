# Deployment & Umgebungsvariablen

Diese Anwendung (Next.js) liest alle Secrets zur **Laufzeit** aus `process.env`.
Es gibt **eine** Konvention über alle Umgebungen hinweg — dieselbe Variable,
nur an unterschiedlichen Orten hinterlegt.

## Die Variablen

| Variable | Zweck | Client-sichtbar? |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` (Default) oder `mistral` — siehe „Provider pro Umgebung" | ❌ nur Server |
| `ANTHROPIC_API_KEY` | Anthropic API Key für die Chat-Route | ❌ nur Server |
| `ANTHROPIC_MODEL` | optional; überschreibt das Modell (Default: `claude-sonnet-5`) | ❌ nur Server |
| `MISTRAL_API_KEY` | Mistral API Key (nur bei `LLM_PROVIDER=mistral`) | ❌ nur Server |
| `MISTRAL_MODEL` | optional; Default: `mistral-large-latest` | ❌ nur Server |
| `LLM_PRICE_*`, `USD_TO_EUR_PERCENT` | optional; Preisbasis der Kostenanzeige | ❌ nur Server |
| `CHAT_*` | Grenzwerte der Missbrauchs-Abwehr, siehe [`SICHERHEIT-PROMPTS.md`](./SICHERHEIT-PROMPTS.md) | ❌ nur Server |
| `NEXT_PUBLIC_FEATURE_*` | Feature-Flags | ✅ ins Bundle gebacken |

> **Wichtig:** `ANTHROPIC_API_KEY` ist ein reines **Runtime-Secret**. Er ist
> nicht `NEXT_PUBLIC_`, wird also **nie ins Browser-Bundle** gebacken und **nicht
> zur Build-Zeit** benötigt. Der Server kann bauen, ohne den Key zu kennen; eine
> Key-Rotation erfordert **keinen** Rebuild, nur einen App-Neustart.
>
> `NEXT_PUBLIC_*`-Flags werden dagegen **zur Build-Zeit** eingebacken und müssen
> beim `next build` gesetzt sein.

## Wo der Key pro Umgebung liegt

| Umgebung | Ablageort | In Git? |
|---|---|---|
| **localhost** | `.env.local` (von `.gitignore` ausgeschlossen) | ❌ nie |
| **dev** | Plesk Node.js-Env von `dev.rothenburg.digital` | ❌ nie |
| **staging** | Plesk Node.js-Env von `staging.rothenburg.digital` | ❌ nie |
| **prod** | Plesk Node.js-Env von `rothenburg.digital` | ❌ nie |
| Vorlage | `.env.example` (ohne Werte) | ✅ committed |

Pro Umgebung ein **eigener** API Key (getrennte Anthropic-Workspaces mit eigenem
Spend-Limit). Wird ein Key kompromittiert, betrifft das nur diese eine Umgebung.
Für Mistral gilt dasselbe mit `MISTRAL_API_KEY`.

## Provider pro Umgebung

`LLM_PROVIDER` entscheidet zur Laufzeit, wer die Chat-Anfragen beantwortet — es
braucht dafür **keinen Rebuild**, nur einen App-Neustart.

| Umgebung | Empfehlung | Begründung |
|---|---|---|
| **localhost / dev** | `anthropic` | schnelle Iteration, ein Key, den es schon gibt |
| **staging** | `mistral` | Vorabnahme unter denselben Bedingungen wie Prod |
| **prod** | `mistral` | EU-Verarbeitung (Frankreich); Anthropic bietet Data-Residency nur `us`/`global`, also kein EU-Pinning — für eine Stadtverwaltung ein Beschaffungs- und Datenschutzthema (AVV/SCC) |

Zwei Dinge, die dabei wichtig sind:

- **Kein stiller Fallback.** Ein unbekannter Wert in `LLM_PROVIDER` führt zu
  HTTP 503 und einer Fehlermeldung im Log — nicht zu einem Rückfall auf
  Anthropic. Ein Tippfehler in der Plesk-Env darf nicht dazu führen, dass eine
  Umgebung, die ausdrücklich EU-Verarbeitung verlangt, unbemerkt über einen
  US-Anbieter läuft.
- **Nachprüfbar im Log.** Beim ersten Chat-Aufruf nach dem Start schreibt die
  App eine Zeile mit dem aktiven Provider, dem Modell und dem
  Verarbeitungsort — ohne Key, nur ob einer gesetzt ist:

  ```json
  {"scope":"llm","provider":"mistral","model":"mistral-large-latest","dataRegion":"EU (Frankreich)","apiKeySet":true,"priceKnown":true}
  ```

  Das ist die schnellste Antwort auf „läuft Prod wirklich über Mistral?".

Nach einem Providerwechsel gehört ein Lauf der Angriffs-Suite dazu
(`BASE_URL=… npm run redteam`): die Abwehr selbst ist providerunabhängig, die
**Prompt-Treue des Modells** ist es nicht. Die Suite meldet am Ende, welches
Modell tatsächlich geantwortet hat. Siehe
[`SICHERHEIT-PROMPTS.md`](./SICHERHEIT-PROMPTS.md).

## localhost

```bash
cp .env.example .env.local   # falls noch nicht vorhanden
# ANTHROPIC_API_KEY in .env.local eintragen
npm install
npm run dev                  # http://localhost:3000
```

`.env.local` ist in `.gitignore` und wird durch den Git-Deploy nie auf den Server
gezogen — genau richtig.

## Server (VPS mit Plesk)

Deploy-Fluss: Git-Push → GitHub → Webhook → Checkout auf dem Server.
Der Key darf **nicht** über Git kommen. Zwei saubere Wege:

### A) Plesk Node.js-Panel (empfohlen)

Plesk → Domain → **Node.js** → **Custom environment variables**:

```
ANTHROPIC_API_KEY = <Key der jeweiligen Umgebung>
```

Danach **Restart App**. Passenger injiziert die Variable in den Prozess; sie liegt
in keiner Datei im Repo und überlebt jeden Redeploy.

### B) Datei-Fallback (falls kein Env-Feld verfügbar)

Auf dem Server im App-Root, als Site-User:

```bash
printf 'ANTHROPIC_API_KEY=%s\n' 'sk-ant-...' > .env.production.local
chmod 600 .env.production.local
```

Next.js lädt `.env.production.local` in Produktion automatisch; die Datei ist
gitignored.

> ⚠️ Sicherstellen, dass der Webhook-Deploy **kein `git clean -fdx`** ausführt —
> das würde diese untracked Datei löschen. Plesks Standard-Git-Deploy lässt
> untracked Dateien in Ruhe.

### Deploy-Aktionen

Einzutragen unter Plesk → Domain → **Git** → Repository → *Zusätzliche
Deployment-Aktionen* (nicht im Node.js-Panel — dessen Paketmanager-Auswahl
betrifft nur den *NPM install*-Button):

```bash
npm ci --include=dev
npm run build
```

> ⚠️ **`--include=dev` ist Pflicht.** Der Application Mode `production` setzt
> `NODE_ENV=production`, und npm lässt dann devDependencies weg (gemessen: 30
> statt 53 Pakete). `tailwindcss`, `postcss`, `autoprefixer` und `typescript`
> liegen aber genau dort — ohne sie bricht `next build` ab:
> `Cannot find module 'tailwindcss'` über `postcss.config.mjs`.
>
> Der Application Mode gehört trotzdem auf **`production`**: `development`
> schaltet in Passenger die *friendly error pages* frei, die bei einem 500er
> Stacktrace, Quellcode und Umgebungsvariablen an den Besucher ausliefern.
> Dev-Features bringt der Modus keine, weil `server.js` fest `dev: false` setzt.
>
> Nebeneffekt ohne `--include=dev`: Next installiert fehlendes TypeScript beim
> Build selbst nach und pinnt exakte Versionen in `package.json` — das
> hinterlässt geänderte Dateien im Git-Checkout, die beim nächsten Deploy-Pull
> kollidieren.

Start über Plesk → Node.js:

- **Application Startup File** = `server.js` (Passenger-kompatibler Einstiegspunkt;
  `next start` funktioniert mit Passenger nicht direkt).
- **Application Mode** = `production` (Begründung oben).
- Nach jedem Deploy: **Restart App**. Alternativ als dritte Deploy-Aktion
  `mkdir -p tmp && touch tmp/restart.txt` — Passenger startet bei Änderung
  dieser Datei neu. Beim ersten Mal prüfen, ob der Neustart wirklich greift.
- `npm run build` ist Pflicht — ohne `.next` startet `server.js` nicht.

### Warum kein Standalone-Build

`output: "standalone"` ist bewusst **nicht** gesetzt. Standalone ist primär für
Container gedacht; der Plesk-Git-Deploy baut ohnehin im Verzeichnis, und
Passenger erwartet die Startdatei im App-Root — genau das leistet `server.js`.
Standalone würde zusätzliche Kopierschritte (`.next/static`, `public`) und eine
andere Startdatei bedeuten, ohne Gewinn. Siehe Issue #1.

## Key-Rotation

1. Neuen Key beim jeweiligen Anbieter erzeugen (Anthropic-Workspace bzw.
   Mistral-Console).
2. In der jeweiligen Umgebung eintragen (Plesk-Env bzw. `.env.production.local`).
3. App neu starten (kein Rebuild nötig).
4. Alten Key in der Console **widerrufen**.

Rutscht ein Key versehentlich in einen Commit: sofort in der Console widerrufen —
Entfernen aus der Git-History reicht nicht.

## Modell-Hinweis

Claude-5-Modelle (`claude-sonnet-5`) lehnen abweichende Sampling-Parameter
(`temperature`, `top_p`, `top_k`) ab. Das AI SDK setzt seit v5 keinen
`temperature`-Default mehr, deshalb setzt `src/app/api/chat/route.ts` den
Parameter gar nicht — das ist die korrekte Variante. (Unter AI SDK v4 war hier
noch ein explizites `temperature: 1` nötig, weil v4 hart auf `0` gesetzt hat.)

Für Mistral gilt dasselbe Vorgehen aus dem umgekehrten Grund: ohne gesetzten
Parameter greift der Default des Modells. Sampling gehört nicht in die Route,
sondern — falls je nötig — in die Provider-Konfiguration in
`src/lib/llm/provider.ts`, damit ein Wert nicht versehentlich für alle Anbieter
gilt.

## Preisanzeige

Der Chat zeigt Token und geschätzte Kosten. Die Preise stehen in
`src/lib/llm/pricing.ts` (Stand 07.09.2026) und werden **serverseitig**
gerechnet — der Client hat keine eigene Preisliste, die nach einem
Providerwechsel falsch wäre.

Für ein Modell ohne hinterlegten Preis zeigt die UI bewusst **keine** Schätzung,
sondern nennt nur den Modellnamen. Wer einen Preis braucht, ohne Code zu ändern,
setzt `LLM_PRICE_INPUT_USD_PER_MTOK` und `LLM_PRICE_OUTPUT_USD_PER_MTOK`. Prüfe
die Preise beim Modellwechsel — eine veraltete Zahl ist schlechter als keine.
