# Deployment & Umgebungsvariablen

Diese Anwendung (Next.js) liest alle Secrets zur **Laufzeit** aus `process.env`.
Es gibt **eine** Konvention über alle Umgebungen hinweg — dieselbe Variable,
nur an unterschiedlichen Orten hinterlegt.

## Die Variablen

| Variable | Zweck | Client-sichtbar? |
|---|---|---|
| `LANDING_PAGE` | `teaser` zeigt unter `/` die statische Seite und schaltet den Chat ab; sonst Chat-Portal. **Nur auf Prod setzen** | ❌ nur Server |
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

## Wie viele Keys? Zwei.

**Zwei Keys für vier Umgebungen** — passend zur Provider-Aufteilung aus #12:

| Umgebung | Provider | Key |
|---|---|---|
| localhost + dev | Anthropic | ein Anthropic-Key, Workspace „dev" |
| staging + prod | Mistral (EU) | ein Mistral-Key |

Das war vorher anders geregelt („pro Umgebung ein eigener Key", also vier). Die
Begründung dafür war nie Geld — **API-Keys und Workspaces kosten nichts**,
abgerechnet werden Token, und die laufen ohnehin in einer Rechnung zusammen.
Getrennte Keys bringen drei andere Dinge: einen kompromittierten Key einzeln
widerrufen zu können, sehen zu können *welche* Umgebung Token verbraucht, und
pro Workspace ein Ausgabenlimit setzen zu können.

Für ein Ein-Personen-Projekt ist die Trennung „Entwicklung ↔ Öffentlichkeit"
der Punkt, an dem sich dieser Aufwand lohnt — vier Keys sind nur mehr
Verwaltung, ohne mehr Sicherheit. Wächst das Team oder wird staging öffentlich
vorgeführt, ist ein eigener Key für staging der nächste sinnvolle Schnitt.

**Ausgabenlimit setzen.** Pro Workspace in der Console ein hartes Monatslimit.
Das ist der einzige Schutz, der auch bei einem Fehler im Code hält — die
Bremsen in der App (`CHAT_DAILY_TOKEN_BUDGET`, Rate-Limit, `maxOutputTokens`,
siehe [`SICHERHEIT-PROMPTS.md`](./SICHERHEIT-PROMPTS.md)) greifen nur, solange
die App sich wie gedacht verhält.

## Abo ≠ API — zwei getrennte Abrechnungen

Eine Verwechslung, die Geld kostet und leicht passiert:

| | Was es ist | Wofür | Abrechnung |
|---|---|---|---|
| **Claude Pro/Max** | Abo | Claude-App und **Claude Code** (die Entwicklungsarbeit an diesem Repo) | Pauschale pro Monat |
| **Anthropic API** | Pay-per-Token | der `ANTHROPIC_API_KEY`, den **dieses Portal** benutzt | pro Token |

Das Abo deckt das Portal **nicht** ab; die App braucht einen API-Key mit
eigener Abrechnung. Umgekehrt braucht Claude Code keinen API-Key aus diesem
Projekt. Wer beides für dasselbe hält, legt leicht ein zweites Konto oder Abo
an und zahlt doppelt.

Nachsehen: Abos unter <https://claude.ai/settings/billing>, API-Verbrauch und
Guthaben in der Developer Platform (<https://platform.claude.com>, vormals
console.anthropic.com) — dort auch pro Workspace und pro Key aufgeschlüsselt.

> **Keys und Workspaces gehören zu einer Organisation.** Wer sich mit einem
> anderen Konto anmeldet, sieht *keine* Keys und *keine* Workspaces — sie sind
> nicht gelöscht, sondern in der anderen Org. Bevor man neue anlegt: oben im
> Konto-/Org-Wechsler prüfen, welche Organisation aktiv ist.

## Provider pro Umgebung

`LLM_PROVIDER` entscheidet zur Laufzeit, wer die Chat-Anfragen beantwortet — es
braucht dafür **keinen Rebuild**, nur einen App-Neustart.

| Umgebung | Empfehlung | Begründung |
|---|---|---|
| **localhost / dev** | `anthropic` | schnelle Iteration, ein Key, den es schon gibt |
| **staging** | `mistral` | Vorabnahme unter denselben Bedingungen wie Prod, gleicher Key wie Prod |
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

Deploy-Fluss: Git-Push → GitHub → Webhook → Checkout auf dem Server. **Nur der
Checkout läuft automatisch** — der anschließende Build ist auf diesem Server
aktuell ein manueller Schritt, siehe „Deploy-Aktionen" unten und „Bekannte
Server-Eigenheiten". Der Key darf **nicht** über Git kommen. Zwei saubere Wege:

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

### Deploy-Aktionen — **Build läuft aktuell manuell, nicht automatisch**

> ⚠️ **Stand 08.09.2026: Die „Zusätzlichen Deployment-Aktionen" können auf
> diesem Server keinen Build ausführen.** Das ist ein bestätigter, nicht von
> uns behebbarer Befund — bitte nicht erneut versuchen, dort `npm`/`node`
> zum Laufen zu bringen. Details und der tatsächliche Arbeitsablauf stehen
> unten unter „Bekannte Server-Eigenheiten".
>
> **Automatisch** läuft weiterhin: Git-Push → GitHub → Webhook → Dateien
> werden auf dem Server ausgecheckt („Deploying files … Done"). **Manuell**
> nötig nach jedem Push, der Abhängigkeiten oder Build-Output betrifft:

1. Plesk → Domain → **Git** → **Deploy** auslösen (holt den aktuellen Code;
   läuft automatisch beim Push, kann hier aber auch erneut angestoßen werden)
2. Plesk → Domain → **Node.js** → Tab **„Run Node.js commands"** → **`ci`**
   ausführen, danach **`run build`**
3. **Restart App**

Das ist der einzige Weg auf diesem Server, der `npm`/`node` in einer
funktionierenden Umgebung ausführt — die „Zusätzlichen Deployment-Aktionen"
und jede SSH-Sitzung als der Website-Nutzer laufen in einer eingeschränkten
Umgebung ohne Zugriff auf die echte Node-Installation (siehe unten).

Trägt jemand später einen Fix für die Deployment-Aktionen ein (z. B. nach
Rücksprache mit dem Hosting-Support): erst gegen genau diese drei manuellen
Schritte testen, bevor diese Warnung entfernt wird.

Start über Plesk → Node.js:

- **Application Startup File** = `server.js` (Passenger-kompatibler Einstiegspunkt;
  `next start` funktioniert mit Passenger nicht direkt).
- **Application Mode** = `production`. `development` schaltet in Passenger die
  *friendly error pages* frei, die bei einem 500er Stacktrace, Quellcode und
  Umgebungsvariablen an den Besucher ausliefern. Dev-Features bringt der Modus
  keine, weil `server.js` fest `dev: false` setzt.
- `npm ci --include=dev` ist Pflicht (nicht nur `npm ci`): der Application Mode
  `production` setzt `NODE_ENV=production`, und npm lässt dann
  devDependencies weg (gemessen: 30 statt 53 Pakete). `tailwindcss`,
  `postcss`, `autoprefixer` und `typescript` liegen aber genau dort — ohne sie
  bricht `next build` ab: `Cannot find module 'tailwindcss'` über
  `postcss.config.mjs`. Nebeneffekt ohne `--include=dev`: Next installiert
  fehlendes TypeScript beim Build selbst nach und pinnt exakte Versionen in
  `package.json` — das hinterlässt geänderte Dateien im Git-Checkout, die beim
  nächsten Deploy-Pull kollidieren.
- Nach jedem Build: **Restart App**. Alternativ `mkdir -p tmp && touch
  tmp/restart.txt` im App-Verzeichnis — Passenger startet bei Änderung dieser
  Datei neu.
- `npm run build` ist Pflicht — ohne `.next` startet `server.js` nicht.

## Bekannte Server-Eigenheiten (Plesk, dieser Host)

Drei Befunde vom 07./08.09.2026, teuer erkauft — bitte vor der nächsten
Server-Aktion lesen, nicht wiederholen.

### 1. Die Git-Deploy-Hooks laufen in einer Jail ohne Node-Zugriff

Ursache für den ausgefallenen Build oben. Die „Zusätzlichen
Deployment-Aktionen" laufen als eingeschränkter Prozess (`PATH=/usr/bin:/bin`,
`HOME=/`, kein `env`-Kommando) — vermutlich dieselbe Einschränkung wie eine
normale SSH-Sitzung als der Website-Nutzer selbst. Versucht:

- `export PATH=…` + `eval "$(nodenv init -)"` → `nodenv: command not found`
- `bash -lc '…'` (Login-Shell erzwingen) → kam weiter, dann `npm: command not
  found`
- absoluter Pfad `/opt/plesk/node/<Version>/bin/npm` (per SSH als **root**
  verifiziert, dass die Datei existiert) → `No such file or directory` — die
  Jail sieht ein anderes Dateisystem als eine root-SSH-Sitzung
- der nodenv-Shim `/.nodenv/shims/npm` direkt → scheiterte an der eigenen
  Shebang-Zeile (`#!/usr/bin/env bash`, `env` fehlt in der Jail)
- derselbe Shim über `bash /.nodenv/shims/npm …` aufgerufen (umgeht die
  Shebang) → lief bis Zeile 21 des Shims, die intern
  `/usr/libexec/nodenv/nodenv` aufruft — ein **systemweiter** Pfad außerhalb
  der Jail, ebenfalls unerreichbar

Fazit: **keine der drei Zugriffsebenen (PATH, absoluter Pfad, Shim-Dispatcher)
ist aus dieser Jail erreichbar.** Das ist keine Konfigurationsfrage im
Deployment-Aktionen-Feld mehr, sondern eine Eigenschaft der Jail selbst. Der
funktionierende Weg ist der Tab **„Run Node.js commands"** im Node.js-Panel —
der läuft nachweislich in der richtigen Umgebung (zeigt korrekt alle
`package.json`-Skripte, `ci`/`run build` liefen dort im ersten Versuch
erfolgreich durch).

### 2. Niemals rekursiv `chown` auf ein Vhost-Verzeichnis

Als Nothelfer wurde der Build einmalig als **root** direkt ausgeführt (root
sieht das komplette System, auch außerhalb der Jail), danach zur Korrektur:

```bash
chown -R rothenburg.digital_mjm03xa8j7:psacln /var/www/vhosts/rothenburg.digital/dev.rothenburg.digital
```

Das hat die **gesamte Website lahmgelegt** (503/403, auch die vorher
funktionierende Startseite). Grund: das oberste Vhost-Verzeichnis gehörte
ursprünglich der Gruppe `psaserv` (`drwxr-x---`) — der Gruppe, in der Apache
selbst Mitglied ist, um überhaupt hineinschauen zu können. Der rekursive
`chown` hat diese Gruppe auf `psacln` umgestellt, Apache konnte das
Verzeichnis danach nicht mehr betreten (`AH00529: … unable to check htaccess
file, ensure it is executable`).

**Falls ein manueller Root-Build je wieder nötig ist:** `chown -R` nur auf
Unterverzeichnisse anwenden, **nie auf das Vhost-Wurzelverzeichnis selbst**.
Korrektur, falls es doch passiert:

```bash
chgrp psaserv /var/www/vhosts/rothenburg.digital/<subdomain>
chmod 750 /var/www/vhosts/rothenburg.digital/<subdomain>
```

(Werte `psaserv`/`750` durch einen Blick auf ein unverändertes
Geschwisterverzeichnis bestätigen, z. B. `staging.rothenburg.digital` —
nicht blind übernehmen, falls sich die Konvention einmal ändert.)

### 3. Ein Ausgabenlimit unter dem bereits verbrauchten Monatsbetrag sperrt sofort

Wird das Anthropic-Ausgabenlimit einer Organisation **niedriger** gesetzt als
der in diesem Abrechnungszeitraum bereits verbrauchte Betrag, sperrt die API
**sofort und vollständig** — nicht erst ab der nächsten Anfrage über dem
Limit. Fehlermeldung im Client: `AI_APICallError: You have reached your
specified API usage limits. You will regain access on <Datum> at 00:00 UTC.`
Das betrifft die gesamte Organisation, nicht nur den einzelnen Key.

Vor dem Senken eines Limits immer den bereits verbrauchten Betrag des
laufenden Zeitraums in der Console prüfen. Nach dem Anheben kann es zusätzlich
bis zu ein bis zwei Minuten dauern, bis die Änderung wirkt — bei anhaltendem
Fehler zuerst diese Verzögerung abwarten, bevor an anderer Stelle gesucht
wird.

### Warum kein Standalone-Build

`output: "standalone"` ist bewusst **nicht** gesetzt. Standalone ist primär für
Container gedacht; der Plesk-Git-Deploy baut ohnehin im Verzeichnis, und
Passenger erwartet die Startdatei im App-Root — genau das leistet `server.js`.
Standalone würde zusätzliche Kopierschritte (`.next/static`, `public`) und eine
andere Startdatei bedeuten, ohne Gewinn. Siehe Issue #1.

## Aktueller Stand der Umgebungen (07.09.2026)

Nur **dev** läuft als Node-App. Das ist wichtig zu wissen, bevor irgendwer
Branches zusammenführt:

| Umgebung | Branch | Plesk | Was ausgeliefert wird |
|---|---|---|---|
| localhost | – | – | App, Chat-Portal |
| **dev** | `dev` | Node.js-App eingerichtet | Chat-Portal, Basic-Auth davor |
| **staging** | `staging` | *keine* Node.js-App | Branch steht noch auf dem Initial-Commit |
| **prod** | `main` | *keine* Node.js-App | statisch: `index.html` + Logo, kein Next |

> ⛔ **`dev` nicht nach `main` mergen, solange Prod keine Node-App ist.**
> `main` besteht praktisch nur aus `index.html` und dem Logo. Nach einem Merge
> wäre die `index.html` weg (sie liegt jetzt als `public/teaser.html` im
> Repository), und es gäbe keine App, die `/` beantwortet — nginx findet dann
> kein Dokument, Prod ist **nicht mehr erreichbar**. Das ist schlimmer als
> „zeigt das Falsche".
>
> Reihenfolge für den Livegang:
>
> 1. Prod in Plesk als Node.js-App einrichten (Startup File `server.js`,
>    Application Mode `production` — Details oben unter „Server (VPS mit
>    Plesk)"). Die „Zusätzlichen Deployment-Aktionen" können auf diesem Host
>    keinen Build ausführen (siehe „Bekannte Server-Eigenheiten" oben) — nach
>    dem Einrichten **sofort** einmal manuell über den Tab „Run Node.js
>    commands" bauen (`ci`, dann `run build`), sonst startet `server.js` gar
>    nicht erst.
> 2. `LANDING_PAGE=teaser` und `ANTHROPIC_API_KEY` in den Env-Feldern setzen.
> 3. Erst dann `dev` → `main` mergen. Der Checkout läuft automatisch, danach
>    erneut manuell bauen (Schritt 1 wiederholen) und **Restart App**. Prod
>    zeigt weiter den Teaser, ausgeliefert jetzt aus `public/teaser.html`.
> 4. Der Livegang des Portals ist danach ein Env-Wert (`LANDING_PAGE`
>    entfernen) **plus** derselbe manuelle Build+Restart-Schritt — kein Env-Wert
>    allein reicht, solange der Build nicht automatisch läuft.
>
> Wer Prod vorerst statisch lassen will, aber trotzdem mergen muss, legt vor dem
> Merge eine **untracked** `index.html` im App-Verzeichnis ab (Kopie von
> `public/teaser.html`). Untracked Dateien überleben den Git-Deploy — dieselbe
> Mechanik wie bei `.env.production.local`.

## Startseite pro Umgebung

Sobald eine Umgebung als Node-App läuft, entscheidet `LANDING_PAGE` zur
Laufzeit, was `/` zeigt. Das Chat-Portal soll auf localhost, dev und staging
sichtbar sein — auf Prod noch nicht:

| Umgebung | `LANDING_PAGE` | `/` zeigt | `/api/chat` |
|---|---|---|---|
| localhost / dev / staging | *nicht gesetzt* | Chat-Portal | aktiv |
| **prod** | `teaser` | `public/teaser.html` | 503 (abgeschaltet) |

Vier Dinge, die dazugehören:

- **Prod muss die Variable setzen** — sobald Prod als Node-App läuft. Solange
  dort nginx eine statische `index.html` ausliefert, ist die Variable
  wirkungslos, weil die App gar nicht gefragt wird. Fehlt sie beim Umstellen,
  zeigt Prod das Portal. Der
  Default ist bewusst so gewählt: die umgekehrte Voreinstellung hätte dev bei
  einem fehlenden Flag stillschweigend auf den Teaser zurückfallen lassen — und
  genau dieser Fehler ist am 07.09.2026 schon einmal passiert.
- **Der Teaser-Modus schaltet auch die API ab.** Eine Umgebung, die das Portal
  nicht zeigt, soll keinen offenen, kostenpflichtigen LLM-Endpoint dahinter
  haben. Wer die API vor dem Livegang der Seite testen will, setzt zusätzlich
  `CHAT_DISABLED=0`.
- **Es ist ein Rewrite, kein Redirect.** Die Adresse bleibt
  `https://rothenburg.digital/`, ausgeliefert wird byte-genau die bisherige
  Seite. Umgesetzt in `src/proxy.ts` (in Next.js 16 der Nachfolger von
  `middleware.ts`).
- **Nichts Ausliefernbares ins Wurzelverzeichnis.** Der Document Root zeigt auf
  das App-Verzeichnis, und nginx bedient vorhandene Dateien selbst, bevor
  Passenger gefragt wird. Eine `index.html` dort beschattet die App komplett —
  siehe `docs/ENTWICKLUNG.md`, Abschnitt „Teaser-Seite und Doc-Root". Statische
  Dateien gehören nach `public/`.

## Key-Rotation

1. Neuen Key beim jeweiligen Anbieter erzeugen (Anthropic-Workspace bzw.
   Mistral-Console) — vorher prüfen, dass die **richtige Organisation** aktiv
   ist, sonst landet der Key an einer Stelle, die man später nicht wiederfindet.
2. In allen Umgebungen eintragen, die diesen Key benutzen (bei der
   Zwei-Key-Strategie: localhost **und** dev, bzw. staging **und** prod).
3. App neu starten (kein Rebuild nötig).
4. Alten Key in der Console **widerrufen** — erst wenn alle Umgebungen umgestellt
   sind, sonst fällt eine davon auf 401.

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
