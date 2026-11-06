---
name: abschluss
description: Freigegebene Änderung committen, nach OK pushen und einen PR nach dev öffnen. Kein Merge nach staging.
argument-hint: "[issue-nummer]"
disable-model-invocation: true
---

# Abschluss

Setzt voraus, dass Alex die Änderung freigegeben hat, bei sichtbaren
Änderungen nach der localhost-Prüfung. Fehlt die Freigabe, nachfragen.

Die Issue-Nummer ist `$ARGUMENTS`. Ist sie leer, aus dem Branchnamen lesen
(`feat/74-…` → 74). Gibt es kein Issue, entfallen `(#<nr>)` im Commit und
`Closes #<nr>` im PR.

## 1. Commit

- `git status` und `git diff` ansehen. Nur Dateien dieser Änderung
  stagen, einzeln mit Namen. Nicht mitnehmen: `.DS_Store`, `.env*`,
  `.data/`, `.dev-auth`, `.staging-auth`, Playwright-Reports. Die von
  `next dev` erzeugte Änderung an `next-env.d.ts` nur mitnehmen, wenn sie
  zur Arbeit gehört.
- Vorher einmal `npm run typecheck && npm run lint && npm test && npm run test:e2e`,
  falls seit der letzten Prüfung noch Code geändert wurde. Die E2E-Suite
  läuft lokal schnell und ohne Modellkosten; so fällt ein Fehler vor dem PR
  auf statt erst in `verify` auf GitHub Actions.
- Nachricht im Stil der bisherigen Commits, deutsch:

  ```
  <typ>(<bereich>): <Was, aus Sicht der Nutzer> (#<nr>)

  - Stichpunkte: was sich geändert hat und wo (Funktion, Datei)
  - Tests und Doku, die dazugekommen sind

  Co-Authored-By: …   (Zeile aus der aktuellen Attributionsvorgabe)
  ```

  `<typ>` ist `feat`, `fix`, `docs` oder `chore` (Werkzeuge, Repo-Pflege); `<bereich>` z. B. `chat`,
  `opendata`, `guard`, `notfall`, `fehler`, `sicherheit`, `release`.

## 2. Push, nur nach OK

- `gh auth status` muss `alexschnapper` zeigen.
- Alex fragen, ob gepusht werden soll, und erst nach dem OK
  `git push -u origin <branch>`.

## 3. Pull Request nach dev

`gh pr create --base dev` mit Titel = erste Commit-Zeile ohne Typ-Präfix,
z. B. „Notruf-Satz zu 112 vom Server statt vom Modell (#74)“. Body im Stil
von PR #76:

```
Closes #<nr>

## Was
Ein, zwei Sätze, was sich für Nutzer ändert und warum.

- **<Aspekt>:** was und wo (Funktion, Datei)

## Tests
- Unit-/E2E-Tests mit Anzahl, Typecheck und Lint
- Red-Team-Fälle, falls gelaufen (welche, wie viele grün)
- Was auf localhost im Browser geprüft wurde

## Bekannt
Nur wenn es etwas gibt: bekannte Grenzen oder offene Punkte.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Danach die PR-URL nennen.

## Nicht tun

- Den PR **nicht** selbst mergen, außer Alex sagt es ausdrücklich.
- **Kein** Merge oder Push nach `staging` oder `main`. Staging bekommt
  gebündelte Stände erst, wenn Alex sie ausdrücklich freigibt; jeder Merge
  dorthin löst einen echten Deploy aus.
