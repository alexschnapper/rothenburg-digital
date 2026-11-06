# Deployment & Umgebungsvariablen

Diese Anwendung (Next.js) liest alle Secrets zur **Laufzeit** aus `process.env`.
Es gibt **eine** Konvention über alle Umgebungen hinweg — dieselbe Variable,
nur an unterschiedlichen Orten hinterlegt.

## Die Variablen

| Variable | Zweck | Client-sichtbar? |
|---|---|---|
| `LANDING_PAGE` | `teaser` zeigt unter `/` die statische Seite und schaltet den Chat ab; sonst Chat-Portal. **Nur auf Prod setzen** | ❌ nur Server |
| `LLM_PROVIDER` | `mistral` (Default, EU) oder `anthropic` (Ausnahmefall) — siehe „Provider pro Umgebung" | ❌ nur Server |
| `ANTHROPIC_API_KEY` | Anthropic API Key für die Chat-Route | ❌ nur Server |
| `ANTHROPIC_MODEL` | optional; überschreibt das Modell (Default: `claude-sonnet-5`) | ❌ nur Server |
| `MISTRAL_API_KEY` | Mistral API Key (nur bei `LLM_PROVIDER=mistral`) | ❌ nur Server |
| `MISTRAL_MODEL` | optional; Default: `mistral-large-2512` (feste Version, siehe „Modellwahl") | ❌ nur Server |
| `LLM_PRICE_*`, `USD_TO_EUR_PERCENT` | optional; Preisbasis der Kostenanzeige | ❌ nur Server |
| `USAGE_HISTORY_FILE` | Pfad der Verbrauchsdatei für `/kosten` (Default `.data/usage-history.json` im App-Verzeichnis). **Auf dem Server je Umgebung außerhalb des Document Root setzen**, siehe „Kostenseite" | ❌ nur Server |
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

## Wie viele Keys? Zwei Mistral-Keys.

**Zwei Mistral-Keys für vier Umgebungen** — seit #32 läuft jede Umgebung über
denselben Provider, getrennt bleibt nur die Vertrauensgrenze:

| Umgebung | Provider | Key |
|---|---|---|
| localhost + dev | Mistral (EU) | ein Mistral-Key, Workspace „dev" |
| staging + prod | Mistral (EU) | ein Mistral-Key, Workspace „prod" |

Das war vorher anders geregelt (Anthropic für localhost/dev, Mistral für
staging/prod, aus #12). Zwei Provider im selben Projekt haben mehr Verwirrung
als Nutzen gebracht: der App-Key war leicht mit dem Claude-Abo (Claude
Pro/Max, für Claude Code) zu verwechseln, und lokal wurde unter anderen
Bedingungen getestet als live. Ein einheitlicher Provider behebt beides.
`anthropic` bleibt im Code als Option erhalten, ist aber nirgends mehr die
Empfehlung.

Die Begründung für **zwei** Keys statt einem einzigen ist dieselbe wie zuvor
und war nie Geld — **API-Keys und Workspaces kosten nichts**, abgerechnet
werden Token, und die laufen ohnehin in einer Rechnung zusammen. Getrennte
Keys bringen drei andere Dinge: einen kompromittierten Key einzeln widerrufen
zu können, sehen zu können *welche* Umgebung Token verbraucht, und pro
Workspace ein Ausgabenlimit setzen zu können.

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
| **Mistral API** | Pay-per-Token | der `MISTRAL_API_KEY`, den **dieses Portal** standardmäßig benutzt | pro Token |
| **Anthropic API** | Pay-per-Token | `ANTHROPIC_API_KEY`, nur falls `LLM_PROVIDER=anthropic` gesetzt wird (Ausnahmefall) | pro Token |

Das Abo deckt das Portal **nicht** ab; die App braucht einen eigenen API-Key
(Mistral) mit eigener Abrechnung — unabhängig vom Konto, über das Claude Code
läuft. Umgekehrt braucht Claude Code keinen API-Key aus diesem Projekt. Wer
beides für dasselbe hält, legt leicht ein zweites Konto oder Abo an und zahlt
doppelt. Genau diese Verwechslungsgefahr war mit ein Grund, seit #32 auf
allen vier Umgebungen einheitlich Mistral zu verwenden.

**Claude Code kann auch pro Token laufen.** Meldet man sich mit `/login` über
einen API-Key bzw. die Developer Platform an statt über das claude.ai-Konto,
zieht Claude Code die Token aus den API-Credits der Org — dann ist die
Entwicklungsarbeit, nicht das Portal, der große Kostenposten. Prüfen mit
`claude auth status`: `"authMethod": "claude.ai"` und ein `subscriptionType`
(`pro`/`max`) heißt Abo; alles andere heißt Abrechnung pro Token.

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
| **localhost / dev** | `mistral` | einheitlich mit staging/prod testen, kein Verwechseln mit dem Claude-Abo (Claude Code) |
| **staging** | `mistral` | Vorabnahme unter denselben Bedingungen wie Prod, gleicher Key wie Prod |
| **prod** | `mistral` | EU-Verarbeitung (Frankreich); Anthropic bietet Data-Residency nur `us`/`global`, also kein EU-Pinning — für eine Stadtverwaltung ein Beschaffungs- und Datenschutzthema (AVV/SCC) |

`anthropic` bleibt als Option nutzbar (z. B. punktueller Modellvergleich),
ist seit #32 aber auf keiner Umgebung mehr die Empfehlung.

Zwei Dinge, die dabei wichtig sind:

- **Kein stiller Fallback.** Ein unbekannter Wert in `LLM_PROVIDER` führt zu
  HTTP 503 und einer Fehlermeldung im Log — nicht zu einem Rückfall auf
  Anthropic. Ein Tippfehler in der Plesk-Env darf nicht dazu führen, dass eine
  Umgebung, die ausdrücklich EU-Verarbeitung verlangt, unbemerkt über einen
  US-Anbieter läuft.
- **Nachprüfbar im Log.** Beim ersten Chat-Aufruf nach dem Start schreibt die
  App eine Zeile mit dem aktiven Provider, dem Modell, dem Verarbeitungsort
  und dem Commit-Kurzhash des Builds — ohne Key, nur ob einer gesetzt ist:

  ```json
  {"scope":"llm","buildSha":"46656b9","provider":"mistral","model":"mistral-large-2512","dataRegion":"EU (Frankreich)","apiKeySet":true,"priceKnown":true}
  ```

  Das ist die schnellste Antwort auf „läuft Prod wirklich über Mistral?" **und**
  „läuft dort wirklich der neueste Stand?" — ohne Testanfrage. Derselbe
  Commit-Hash steht außerdem im Footer jeder Seite (`src/lib/buildInfo.ts`,
  aus `NEXT_PUBLIC_BUILD_SHA`, das GitHub Actions beim Ausrollen setzt; ohne die
  Variable ermittelt `next.config.mjs` den Wert per `git rev-parse --short HEAD`,
  bei einem manuellen Plesk-Build steht dort „unbekannt").

  Anbieter-Hinweis und Datenschutzseite (`/`, `/datenschutz`, #18) sind
  bewusst `export const dynamic = "force-dynamic"` — sonst würde Next sie zur
  Build-Zeit statisch vorrendern, und der angezeigte Anbieter bliebe nach
  einem reinen Providerwechsel + Neustart (siehe oben: kein Rebuild nötig) auf
  dem alten Stand, obwohl `/api/chat` längst den neuen Anbieter benutzt.

Nach einem Providerwechsel gehört ein Lauf der Angriffs-Suite dazu
(`BASE_URL=… npm run redteam`): die Abwehr selbst ist providerunabhängig, die
**Prompt-Treue des Modells** ist es nicht. Die Suite meldet am Ende, welches
Modell tatsächlich geantwortet hat. Siehe
[`SICHERHEIT-PROMPTS.md`](./SICHERHEIT-PROMPTS.md).

## localhost

```bash
cp .env.example .env.local   # falls noch nicht vorhanden
# MISTRAL_API_KEY in .env.local eintragen
npm install
npm run dev                  # http://localhost:3000
```

`.env.local` ist in `.gitignore` und wird durch den Git-Deploy nie auf den Server
gezogen — genau richtig.

## Server (VPS mit Plesk)

Deploy-Fluss: Git-Push → GitHub → Webhook → Checkout auf dem Server. Danach bringt
GitHub Actions den fertigen Build, siehe „Automatisches Ausrollen". Die manuellen
Schritte aus „Deploy-Aktionen" sind nur noch der Rückfallweg.
Der Key darf **nicht** über Git kommen. Zwei saubere Wege:

### A) Plesk Node.js-Panel (empfohlen)

Plesk → Domain → **Node.js** → **Custom environment variables**:

```
MISTRAL_API_KEY = <Key der jeweiligen Umgebung>
```

Danach **Restart App**. Passenger injiziert die Variable in den Prozess; sie liegt
in keiner Datei im Repo und überlebt jeden Redeploy.

### B) Datei-Fallback (falls kein Env-Feld verfügbar)

Auf dem Server im App-Root, als Site-User:

```bash
printf 'MISTRAL_API_KEY=%s\n' '...' > .env.production.local
chmod 600 .env.production.local
```

Next.js lädt `.env.production.local` in Produktion automatisch; die Datei ist
gitignored.

> ⚠️ Sicherstellen, dass der Webhook-Deploy **kein `git clean -fdx`** ausführt —
> das würde diese untracked Datei löschen. Plesks Standard-Git-Deploy lässt
> untracked Dateien in Ruhe.

### Deploy-Aktionen — **manueller Build, nur noch Rückfallweg**

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
2. Plesk → Domain → **Node.js** → Tab **„Run Node.js commands"** →
   **`ci --include=dev`** ausführen, danach **`run build`**
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

## Automatisches Ausrollen (GitHub Actions)

Nach einem Push auf `dev`, `staging` oder `main` baut der Job `deploy` in
`.github/workflows/ci.yml` die App und schickt nur das Ergebnis an den Server.
Der Server braucht dafür kein Node. `scripts/server-receive.sh` nimmt das Archiv
an, tauscht `.next`, `node_modules` und `public` und startet die App erst danach
neu. Antwortet der neue Stand nicht oder fehlen danach `/teaser.html`,
`/design/tokens.css` oder die Schriftdatei, rollt der Job automatisch zurück,
samt `public`. Der Plesk-Checkout läuft weiter wie bisher, ist für `public` aber
nicht mehr maßgeblich.

> **Warum `public` mit dem Build kommt (#123):** Next.js liest beim Start ein,
> welche Dateien in `public/` liegen. Bei der Vorabnahme von v0.3.2-alpha kam
> der Build per GitHub Actions samt Neustart an, die neuen Dateien
> (`design/tokens.css`, `fonts/…`) erst danach über den Plesk-Git-Checkout. Die
> laufende App lieferte sie als 404 aus, der Teaser stand ohne Farben da.
> Geänderte Dateien, die es vorher schon gab, kamen dagegen durch. Ein
> Neustart behebt das sofort (Plesk → Node.js → **Restart App**).
>
> **Das Skript auf dem Server** (`/deploy/receive.sh`) liegt außerhalb des
> Repos und gilt für alle Umgebungen. Nach einer Änderung an
> `scripts/server-receive.sh` per SFTP ersetzen. Das Skript nimmt auch Archive
> ohne `public` an (Workflow-Stand älterer Branches), dann bleibt `public`
> unverändert.

Der Job läuft nur für Branches, die in der Repo-Variable `DEPLOY_BRANCHES` stehen.
Ohne sie gelten die manuellen Plesk-Schritte aus „Deploy-Aktionen".

**Einrichtung, erst für staging, Prod erst nach erfolgreichem Test:**

1. Lokal je Umgebung ein eigenes Schlüsselpaar ohne Passphrase erzeugen:
   `ssh-keygen -t ed25519 -f deploy_staging -C deploy-staging`
2. Per SFTP `/deploy/receive.sh` auf dem Server ablegen.
3. In `/.ssh/authorized_keys` eine Zeile je Schlüssel eintragen:

   ```
   restrict,command="/bin/sh /deploy/receive.sh staging.rothenburg.digital" ssh-ed25519 AAAA... deploy-staging
   ```

   Das erzwungene Kommando ist die Trennung der Umgebungen: Alle Umgebungen
   teilen sich einen Systemnutzer, der Schlüssel erreicht trotzdem nur sein
   App-Verzeichnis.
4. GitHub → Settings → Environments: `staging` und `production` anlegen. Bei
   `production` **Required reviewers** setzen.
5. Je Environment hinterlegen:
   - Secret `DEPLOY_SSH_KEY`: privater Schlüssel
   - Secret `DEPLOY_KNOWN_HOSTS`: Zeile aus `ssh-keyscan -t ed25519 rothenburg.digital`,
     vorher den Fingerabdruck am Server prüfen
   - Secret `DEPLOY_CHECK_AUTH`: `user:pass` für Basic-Auth, nur staging
   - Variable `DEPLOY_TARGET`: `<systemnutzer>@rothenburg.digital`
   - Variable `DEPLOY_CHECK_URL`: z. B. `https://staging.rothenburg.digital`
6. Branch in der Repo-Variable `DEPLOY_BRANCHES` ergänzen.
7. Den privaten Schlüssel lokal löschen. Geht er verloren, wird ein neuer erzeugt.

Die Node-Version im Workflow muss zur Version im Plesk-Panel passen, siehe
[Node-Version](#node-version).

### Node-Version

**Node 26 LTS** (Support bis 30.04.2029, #33). Die eine Quelle ist `.nvmrc`:
CI liest sie über `node-version-file`, `package.json` nennt sie unter `engines`
(`26.x`), lokal genügt `nvm use`.

Weil `.nvmrc` mit dem Branch wandert, baut CI für eine Umgebung erst dann mit
der neuen Version, wenn der Stand dort ankommt. Das Plesk-Panel zieht nicht von
selbst nach. Beim Wechsel deshalb je Umgebung, in der Reihenfolge dev →
staging → prod:

1. Plesk → Domain → **Node.js** → **Node.js-Version** auf die neue Linie stellen.
2. Den Stand mit der neuen `.nvmrc` in den Branch der Umgebung mergen. GitHub
   Actions baut und rollt aus.
3. Prüfen: `/` lädt, der Footer zeigt den neuen Commit, `/api/chat` beantwortet
   eine Testfrage.

Zwischen Schritt 1 und 2 läuft kurz ein mit der alten Version gebauter Stand
auf der neuen Laufzeit. Das ist unkritisch, die Abhängigkeiten enthalten nur
N-API-Module (`sharp`), die nicht an eine Node-Version gebunden sind. Den Wechsel
trotzdem nicht lange offen lassen.

| Umgebung | Node (Stand 05.11.2026) |
|---|---|
| localhost | 26 |
| dev | 22 → 26 mit #33 |
| staging | 22 → 26, sobald #33 dort ankommt |
| prod | 22 → 26, sobald #33 dort ankommt |

**Stand 30.10.2026:** Eingerichtet für dev, staging und Prod, `DEPLOY_BRANCHES` ist
`dev,staging,main`. Der SSH-Zugang des
Systemnutzers muss dafür auf `/bin/bash (chrooted)` bleiben, bei „Forbidden" scheitert
das Ausrollen. Damit bleibt auch die Passwort-Anmeldung möglich, das Passwort
muss also lang und einmalig sein.

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

## Aktueller Stand der Umgebungen (30.10.2026)

Alle drei Umgebungen laufen als Node-App:

| Umgebung | Branch | Ausrollen | Was ausgeliefert wird |
|---|---|---|---|
| localhost | – | – | App, Chat-Portal |
| **dev** | `dev` | GitHub Actions | Chat-Portal, Basic-Auth davor |
| **staging** | `staging` | GitHub Actions | Chat-Portal, Basic-Auth davor |
| **prod** | `main` | GitHub Actions mit Freigabe von Hand | Teaser, Chat aus |

### Prod einmalig umstellen (erledigt am 30.10.2026)

Die Schritte bleiben als Vorlage für einen Neuaufbau stehen.

Node.js lässt sich erst nach dem Merge aktivieren, weil `main` vorher weder
`server.js` noch `package.json` hat. Plesk verweigert sonst den Start
(„startup file /httpdocs/server.js doesn't exist"). Die Datei wird **nicht** von
Hand angelegt: Sie kommt mit dem Deploy. Zwischen Schritt 4 und 6 ist Prod
deshalb für einige Minuten nicht erreichbar. Für eine Teaser-Seite ist das
vertretbar, die Umstellung gehört aber in eine ruhige Zeit.

1. **Stand prüfen:** CI ist grün, staging ist abgenommen.
2. **Automatik anhalten:** Plesk → `rothenburg.digital` → Git → Deployment-Modus
   auf **Manuell**. Damit landet der Merge erst dann auf dem Server, wenn alles
   bereit ist.
3. **Mergen:** PR `staging` → `main` mergen. Auf dem Server ändert sich noch nichts.
4. **Ausrollen:** Plesk → Git → **Deploy**. Ab jetzt fehlt die `index.html`, dafür
   liegt `server.js` im App-Verzeichnis.
5. **Node-App einrichten:** Plesk → Node.js mit Application Root und Document Root
   nach dem Muster von staging, Startup File `server.js`, Application Mode
   `production` und derselben Node-Version wie staging. Env:
   `LANDING_PAGE=teaser` und `LLM_PROVIDER=mistral`. Die Variablen müssen vor dem
   Start gesetzt sein.
6. **Bauen:** Tab „Run Node.js commands": `ci --include=dev`, dann `run build`,
   danach **Restart App**.
7. **Prüfen:**
   - `/` liefert den Teaser mit 200 ohne Weiterleitung, die Seite enthält kein
     Eingabefeld
   - `/rothenburg_digital.svg` liefert 200
   - `/api/chat` liefert 503
   - `/.env.production.local` und `/.git/config` liefern 403 oder 404
8. **Automatik einschalten:** Deployment-Modus wieder auf **Automatisch**.

**`MISTRAL_API_KEY` bleibt bis zum Livegang des Portals weg.** Der Teaser braucht
keinen Key. Fehlt `LANDING_PAGE` durch einen Fehler, zeigt Prod zwar das Portal,
der Chat antwortet aber mit 503 und verursacht keine Kosten (am 30.10.2026 mit
einem Produktionsbuild geprüft).

**Zurück, falls Schritt 4 bis 7 scheitern:** Node.js deaktivieren und im
Plesk-Dateimanager
`public/teaser.html` als `index.html` und `public/rothenburg_digital.svg` ins
App-Verzeichnis kopieren. nginx liefert dann wieder die statische Seite aus,
danach in Ruhe die Ursache suchen. Vor dem nächsten Build beide Kopien entfernen,
sonst verdecken sie die App. Eine `index.html` lässt sich **nicht vor** dem Merge
ablegen: Sie ist auf `main` versioniert und wird beim Deploy mit entfernt.

### Release-Weg nach der Umstellung

Jede Änderung läuft durch localhost, `dev` und `staging`:

1. Lokal prüfen, nach `dev` pushen, CI abwarten.
2. Nach `staging` mergen. GitHub Actions rollt aus, danach dort abnehmen.
3. PR `staging` → `main` öffnen. `main` verlangt den grünen Check `verify` und
   einen Stand, der `main` enthält.
4. Nach dem Merge in GitHub Actions unter **Review deployments** freigeben. Bis
   dahin läuft die alte Version weiter.
5. `main` zurück nach `staging` und `dev` bringen, sonst meldet der nächste PR
   den Stand als veraltet. Am einfachsten per Fast-Forward
   (`git push origin main:staging main:dev`); das erlaubt das Ruleset unten,
   einen Force-Push nicht.

Der Commit-Hash im Footer zeigt, welcher Stand läuft.

#### Ruleset „Dauerhafte Branches“ (seit 05.11.2026)

In den Repository-Einstellungen ist **„Automatically delete head branches“**
eingeschaltet, damit Arbeitsbranches nach dem Merge verschwinden. Beim Release
v0.3.0-alpha hat GitHub deshalb nach dem Merge von PR #87 (`dev` → `staging`)
den Head-Branch **`dev` gelöscht**. Wiederhergestellt wurde er aus dem lokalen
Stand (`git push origin 0ddb6ca:refs/heads/dev`); der Commit war bereits in
`staging` enthalten, verloren ging nichts.

Seitdem schützt das Ruleset **„Dauerhafte Branches“** (Settings → Rules →
Rulesets, angelegt per `gh api -X POST …/rulesets`) die drei dauerhaften
Branches:

| | |
|---|---|
| Ziel | `dev`, `staging`, `main` |
| Regeln | Löschen verboten, Force-Push verboten (`deletion`, `non_fast_forward`) |
| Ausnahmen | keine, auch nicht für Admins |
| Status | aktiv |

Das Auto-Delete für Arbeitsbranches bleibt an: Es scheitert an den
geschützten Branches, die Branches bleiben einfach stehen. Beim nächsten
Release (PR #90 `dev` → `staging`, PR #91 `staging` → `main`) blieben `dev`
und `staging` erhalten.

Der Schutz von `main` (PR-Pflicht, Check `verify`, aktueller Stand) ist
davon getrennt und unverändert.

**Vor jedem Release kurz prüfen**, dass das Ruleset noch aktiv ist:

```bash
gh api repos/alexschnapper/rothenburg-digital/rulesets \
  -q '.[] | "\(.name): \(.enforcement)"'
# Dauerhafte Branches: active
```

Fehlt `dev` trotzdem einmal nach einem Merge: Wiederherstellen über den
Hinweis „Restore branch“ im gemergten PR oder
`git push origin <letzter-commit>:refs/heads/dev`.

### Portal auf Prod freischalten

`MISTRAL_API_KEY` setzen, `LANDING_PAGE` entfernen, **Restart App**. Ein Rebuild
ist dafür nicht nötig, das Flag wird zur Laufzeit gelesen. Danach prüfen, dass `/`
das Portal zeigt und `/api/chat` antwortet.

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

1. Neuen Key in der Mistral-Console erzeugen — vorher prüfen, dass die
   **richtige Organisation/Workspace** aktiv ist, sonst landet der Key an
   einer Stelle, die man später nicht wiederfindet.
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

## Modellwahl

Default ist `mistral-large-2512`, eine **feste Version**. Aliase wie
`mistral-large-latest` zeigen auf das Modell, das Mistral gerade wählt, und
können ohne Ankündigung wechseln — das Verhalten des Chats ändert sich dann
mit, ohne dass im Repo etwas passiert ist. Welche Version hinter einem Alias
steht, zeigt `GET https://api.mistral.ai/v1/models` (Feld `aliases`).

**Vergleich am 04.11.2026, Large gegen Small** (`mistral-small-2603`), gleiche
Red-Team-Suite und Kontrollfragen:

| | Large | Small |
|---|---|---|
| Red-Team-Suite | 48/49 | 47/49 |
| Kosten pro Frage | ca. 0,2 Cent | ca. 0,07 Cent |
| Erfundener Betrieb („Zum Goldenen Stern") | „nicht eingetragen" | **erfindet Adresse und Öffnungszeiten** |
| Wetterfrage | richtig beantwortet | Ablehnungsformel |
| Höchstens fünf Restaurants | hält | 6, ohne Kartenlinks |

Small ist damit trotz des Preises keine Option: Die Antworten müssen sich an
die mitgelieferten Daten halten. Kandidat für einen späteren Test ist
`mistral-large-4` (neuer, nicht hinter `-latest`, Preis vorher prüfen).

**Wechsel:** `MISTRAL_MODEL` im Plesk-Node.js-Panel setzen, App neu starten.
Steht das Modell nicht in `src/lib/llm/pricing.ts`, zeigen Chat und `/kosten`
keine Kosten — dann dort eintragen oder `LLM_PRICE_*` setzen. Vorher die
Red-Team-Suite gegen das neue Modell laufen lassen (siehe
[`SICHERHEIT-PROMPTS.md`](./SICHERHEIT-PROMPTS.md)).

## Preisanzeige

Der Chat zeigt Token und geschätzte Kosten. Die Preise stehen in
`src/lib/llm/pricing.ts` (Stand 07.09.2026) und werden **serverseitig**
gerechnet — der Client hat keine eigene Preisliste, die nach einem
Providerwechsel falsch wäre.

Für ein Modell ohne hinterlegten Preis zeigt die UI bewusst **keine** Schätzung,
sondern nennt nur den Modellnamen. Wer einen Preis braucht, ohne Code zu ändern,
setzt `LLM_PRICE_INPUT_USD_PER_MTOK` und `LLM_PRICE_OUTPUT_USD_PER_MTOK`. Prüfe
die Preise beim Modellwechsel — eine veraltete Zahl ist schlechter als keine.

## Kostenseite (#48)

`/kosten` zeigt öffentlich Anfragen, Token und geschätzte Kosten pro Tag,
Woche, Monat und gesamt. Mistral bietet per API-Key **keine**
Verbrauchsabfrage an (`/v1/billing/usage` gibt 404, geprüft am 04.11.2026),
die App schreibt deshalb selbst mit: nur Tagessummen, als JSON-Datei
(`src/lib/usage/history.ts`).

- **Keine Datenbank nötig:** ein Prozess pro Umgebung, eine Zeile pro Tag.
- **Speicherort:** `USAGE_HISTORY_FILE`, je Umgebung eine eigene Datei
  außerhalb des Document Root, neben dem vorhandenen Ordner `deploy/`:

  | Umgebung | `USAGE_HISTORY_FILE` |
  |---|---|
  | dev | `/var/www/vhosts/rothenburg.digital/data/dev/usage-history.json` |
  | staging | `/var/www/vhosts/rothenburg.digital/data/staging/usage-history.json` |
  | prod | `/var/www/vhosts/rothenburg.digital/data/prod/usage-history.json` |

  Voller Serverpfad, nicht der Pfad aus der SSH-Jail — die App läuft außerhalb
  der Jail. Den Ordner legt die App selbst an. Setzen im Plesk-Node.js-Panel
  der jeweiligen Domain unter „Benutzerdefinierte Umgebungsvariablen", danach
  „App neu starten" (kein Rebuild nötig). Beim ersten Start schreibt die App
  `[usage] Verlauf: <Pfad>` ins Log — daran lässt sich prüfen, dass der Wert
  angekommen ist.
- **Warum nicht der Default:** `.data/` im App-Verzeichnis übersteht zwar
  einen Deploy (`scripts/server-receive.sh` tauscht nur `.next` und
  `node_modules`). Bei Prod ist das App-Verzeichnis aber `httpdocs`; liegt das
  Document Root nicht auf `httpdocs/public`, wäre die Datei per Web abrufbar.
  Außerdem hängt es dann von den Einstellungen des Plesk-Git-Checkouts ab, ob
  nicht versionierte Dateien erhalten bleiben.
- **Je Umgebung getrennt:** Jede Umgebung zählt nur ihren eigenen Verbrauch.
  Die öffentlich relevante Zahl ist die von Prod.
- **Schätzung, keine Rechnung:** gerechnet mit den Listenpreisen aus
  `src/lib/llm/pricing.ts` zum Zeitpunkt der Anfrage. Die tatsächliche
  Abrechnung steht in der Mistral-Console.
- **Rechnungsbeträge von Hand:** Kosten per API gibt es bei Mistral nur über
  die Admin-API, und die nur im Enterprise-Tarif. Deshalb einmal im Monat den
  Rechnungsbetrag aus der Console in `src/lib/usage/invoices.ts` eintragen
  (`MISTRAL_INVOICES`), committen, ausrollen. Die Rechnung gilt für alle
  Umgebungen zusammen. Das in der Console gesetzte Monatslimit gehört nach
  `MISTRAL_MONTHLY_LIMIT_EUR`, dann zeigt `/kosten` es unter „Grenzen".
  Das im Tarif enthaltene Monatskontingent steht in
  `MISTRAL_INCLUDED_MONTHLY_EUR` (Stand November 2026: Pay-as-you-go mit
  8,50 €, bisher keine Rechnung).
- **Grenzen:** `/kosten` zeigt Tagesbudget, Fragen pro IP-Adresse und Länge
  einer Antwort aus `src/lib/guard/config.ts`, dazu die Obergrenze pro Tag
  (ganzes Tagesbudget zum Ausgabepreis gerechnet).

## Fehlerseiten (#54)

**In der App** (Next.js): `src/app/not-found.tsx` (404, mit Fakt zum Tag aus
den offenen Daten), `src/app/error.tsx` (500) und `src/app/global-error.tsx`.
Im Chat zeigt `src/components/ChatError.tsx` Code, Bezeichnung, bei 429 die
Wartezeit aus `Retry-After` und ab 500 „Fehler melden". Texte der Codes:
`src/lib/httpStatus.ts`.

**Vor der App** (nginx/Plesk): Antwortet die Node-App nicht — etwa beim
Neustart nach jedem Deploy oder nach einem Absturz —, liefert nginx die
Fehlerseite aus, ebenso bei der Basic-Auth auf dev/staging (401). Next.js
kann das nicht abfangen. Dafür liegen statische Seiten ohne externe Dateien in
`error_docs/`:

| Datei | Code |
|---|---|
| `unauthorized.html` | 401 |
| `forbidden.html` | 403 |
| `not_found.html` | 404 |
| `internal_server_error.html` | 500 |
| `bad_gateway.html` | 502 |
| `maintenance.html` | 503 |
| `gateway_timeout.html` | 504 |

Die Dateinamen müssen genau denen entsprechen, die Plesk erwartet — 503 heißt
dort `maintenance.html`, nicht `service_unavailable.html`
([Plesk-Doku](https://docs.plesk.com/en-US/obsidian/customer-guide/websites-and-domains/extended-website-management/setting-up-custom-error-pages/setting-up-custom-error-pages-on-linux-servers.65653/)).
Für 504 hat Plesk keine eigene Datei; `gateway_timeout.html` greift nur mit
einer zusätzlichen nginx-Anweisung (Schritt 3). Einrichtung je Domain (noch
nicht durchgeführt, zuerst auf dev testen):

1. Plesk → Websites & Domains → Domain → **Hosting-Einstellungen**:
   „Benutzerdefinierte Fehlerdokumente" aktivieren.
2. Die Dateien aus `error_docs/` per Dateimanager in den Ordner `error_docs`
   der Domain hochladen und die vorhandenen gleichnamigen ersetzen.
3. Für 504: Apache- & nginx-Einstellungen → „Zusätzliche nginx-Anweisungen":
   `error_page 504 /error_docs/gateway_timeout.html;`
4. Prüfen, ob Ordner und Einstellung stimmen: Node.js-App der Domain kurz
   deaktivieren. Plesk liefert die Domain dann als statische Website aus —
   `/` ergibt **403** (keine Startseite, keine Ordnerliste), eine unbekannte
   Adresse **404**. Erscheinen dabei unsere Seiten, greift `error_docs`.
   Danach die App wieder aktivieren. Ein echter Ausfall (502/503) lässt sich
   so **nicht** nachstellen; der zeigt sich erst bei einem Neustart der App.

Offen: Neben `error_docs` gibt es den Ordner `nodejs_error_docs`
(vermutlich Fehlerseiten der Node.js-Erweiterung bzw. von Passenger, wenn die
App nicht startet). Dazu gibt es keine Plesk-Doku; nicht ändern, bevor klar
ist, welche Dateien er enthält und wann sie erscheinen.

**„Fehler melden"** öffnet ein vorausgefülltes GitHub-Issue (Formular
`.github/ISSUE_TEMPLATE/fehlermeldung.yml`, Link aus `src/lib/bugReport.ts`):
Code, Pfad ohne Query-String, Zeitpunkt, Build, Fehlerkennung. Nötig ist ein
GitHub-Konto; der Server schreibt nichts. Meldungen ohne Konto: #10.

