# Deployment & Umgebungsvariablen

Diese Anwendung (Next.js) liest alle Secrets zur **Laufzeit** aus `process.env`.
Es gibt **eine** Konvention über alle Umgebungen hinweg — dieselbe Variable,
nur an unterschiedlichen Orten hinterlegt.

## Die Variablen

| Variable | Zweck | Client-sichtbar? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API Key für die Chat-Route | ❌ nur Server |
| `ANTHROPIC_MODEL` | optional; überschreibt das Modell (Default: `claude-sonnet-5`) | ❌ nur Server |
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

## localhost

```bash
cp .env.example .env.local   # falls noch nicht vorhanden
# ANTHROPIC_API_KEY in .env.local eintragen
pnpm install
pnpm dev                     # http://localhost:3000
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

```bash
pnpm install --frozen-lockfile
pnpm build
```

Start über Plesk → Node.js:

- **Application Startup File** = `server.js` (Passenger-kompatibler Einstiegspunkt;
  `next start` funktioniert mit Passenger nicht direkt).
- Nach jedem Deploy: **Restart App**.
- `pnpm build` ist Pflicht — ohne `.next` startet `server.js` nicht.

## Key-Rotation

1. Neuen Key im Anthropic-Workspace erzeugen.
2. In der jeweiligen Umgebung eintragen (Plesk-Env bzw. `.env.production.local`).
3. App neu starten (kein Rebuild nötig).
4. Alten Key in der Console **widerrufen**.

Rutscht ein Key versehentlich in einen Commit: sofort in der Console widerrufen —
Entfernen aus der Git-History reicht nicht.

## Modell-Hinweis

Claude-5-Modelle (`claude-sonnet-5`) lehnen den Parameter `temperature: 0` ab.
Das AI SDK v4 setzt `temperature` sonst hart auf `0`, daher setzt
`src/app/api/chat/route.ts` explizit `temperature: 1` (den API-Default).
