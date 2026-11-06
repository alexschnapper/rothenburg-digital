---
name: issue
description: Ein GitHub-Issue umsetzen — Branch von dev anlegen, umsetzen, prüfen und vor dem Commit zur localhost-Prüfung anhalten.
argument-hint: <issue-nummer>
disable-model-invocation: true
---

# Issue #$ARGUMENTS umsetzen

Ablauf vom Issue bis kurz vor dem Commit. Committet wird erst mit `/abschluss`.

## 1. Vorbereiten

- `gh auth status` prüfen. Aktiv muss `alexschnapper` sein; das Firmenkonto
  bekommt beim Push 403. Steht ein anderes Konto da, Alex auf
  `gh auth switch -u alexschnapper` hinweisen und nicht selbst umschalten.
- `gh issue view $ARGUMENTS --comments` lesen. Ist das Issue unklar oder
  widersprüchlich, vor dem Umsetzen nachfragen.
- `git status`: Liegen fremde, uncommittete Änderungen herum (außer
  `next-env.d.ts` und `.DS_Store`), Alex fragen statt sie mitzunehmen.
- Branch von aktuellem `dev`:
  `git fetch origin && git switch -c <typ>/$ARGUMENTS-<kurzer-slug> origin/dev`.
  `<typ>` ist `feat`, `fix` oder `docs`, der Slug kurz und deutsch wie bei den
  bisherigen Branches (`feat/74-notruf-serverseitig`).

## 2. Umsetzen

- Vor Next.js-Code den passenden Guide in `node_modules/next/dist/docs/` lesen
  (siehe AGENTS.md).
- Stil des umgebenden Codes übernehmen: deutsche Kommentare in derselben
  Dichte, bestehende Helfer wiederverwenden.
- Was der Server sicher entscheiden kann (Links, Quellen, Lizenzen,
  Notruf-Satz), kommt vom Server und nicht aus dem Prompt (#63, #66, #74).
- Neue Logik in `src/lib/**` bekommt Vitest-Tests. Sichtbares Verhalten im
  Chat bei Bedarf in `e2e/` (dort `/api/chat` mocken, keine Modellkosten).
- Betrifft die Änderung Abwehr oder Prompt, Red-Team-Fälle in
  `tests/redteam-cases.json` bzw. `tests/redteam-opendata-cases.json`
  ergänzen oder anpassen.
- Doku nachziehen, wo das Verhalten beschrieben ist (`docs/ENTWICKLUNG.md`,
  `docs/SICHERHEIT-PROMPTS.md`, `docs/DEPLOYMENT.md`).

## 3. Selbst prüfen

Der Reihe nach, Fehler beheben, bevor es weitergeht:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run test:e2e` bei jeder Codeänderung, nicht nur bei UI oder
   Chat-Client. Die Suite läuft lokal in gut zehn Sekunden, mockt `/api/chat`
   und kostet nichts; sie prüft auch Feeds, Routen und Seiteninhalte. Ein
   Fehler fällt so vor dem PR auf statt erst in `verify` auf GitHub Actions.
   Entfallen kann sie nur bei reinen Doku-Änderungen.
5. `npm run build`, wenn Konfiguration, Routen oder Server-Code betroffen sind

**Red-Team sparsam:** Nur wenn Prompt oder Abwehr geändert wurden, und dann
einmal nur die betroffenen Fälle gegen den laufenden Dev-Server, z. B.
`ONLY=notfall npm run redteam` (bei Fällen aus offenen Daten zusätzlich
`CASES=tests/redteam-opendata-cases.json`). Keine 3×/5×-Wiederholungen;
erneut nur, wenn ein Ergebnis wirklich unklar ist. Das lokale Tagesbudget
kostet echtes Mistral-Guthaben.

## 4. Anhalten zur localhost-Prüfung

Bei sichtbaren Änderungen (UI, Seiten, Chat-Antworten):

- `npm run dev` im Hintergrund starten, falls er nicht schon läuft.
- Alex eine kurze, **nummerierte Prüfliste** geben: welche URL, welche
  Eingabe, was zu sehen sein soll.
- Entscheidet der Webserver mit (statische Dateien, Header, Weiterleitungen,
  Doc-Root), ausdrücklich sagen, dass localhost dafür nicht reicht und es
  auf `dev.rothenburg.digital` oder per `node server.js` geprüft werden muss.

Bei nicht sichtbaren Änderungen (Doku, Config, Dependencies) genügt eine
Zusammenfassung.

Am Ende kurz berichten: was geändert wurde, welche Prüfungen grün sind, was
offen oder bekannt ist. **Nicht committen, nicht pushen.** Weiter geht es mit
`/abschluss`, sobald Alex freigibt.
