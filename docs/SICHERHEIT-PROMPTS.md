# Missbrauchs-Abwehr am Chat-Endpoint

Gehört zu Issue #13. Beschreibt, was `/api/chat` gegen Prompt-Injection und
Token-Missbrauch tut — und was ausdrücklich noch nicht.

## Leitsatz

**Kein Schutz darf davon abhängen, dass ein bestimmtes Modell brav ist.**

Ein System-Prompt ist eine Bitte, keine Zugangskontrolle. Er hilft, aber er ist
kein Sicherheitsmechanismus: er lässt sich umformulieren, übersetzen,
verschachteln und irgendwann aushebeln. Alles, was Geld kostet oder Schaden
anrichten kann, wird deshalb **vor** dem Modellaufruf im eigenen Code
entschieden. Das ist auch die Voraussetzung dafür, den Provider zu tauschen
(Issue #12): die Abwehr liegt in `src/lib/guard/`, nicht im Modell.

## Angreiferziele

| Ziel | Was dabei passiert | Wer es merkt |
|---|---|---|
| Kostenlose LLM-Nutzung | Fremde Seite oder Skript hängt sich an `/api/chat` und lässt Hausaufgaben, Übersetzungen, Code schreiben | Rechnung |
| Kostenlawine | Wenige große Anfragen oder Dauerfeuer treiben die Token-Kosten hoch | Rechnung |
| Rufschaden | Der „Assistent der Stadt Rothenburg" sagt etwas Peinliches oder Rechtswidriges, Screenshot geht rum | Presse |
| Prompt-Leak | System-Prompt, Modellname, Konfiguration werden ausgegeben | niemand — bis es auffällt |
| Indirekte Injection | Angreifer-Text in eingebundenen Daten (Webseite, Sensorfeed, Bürger-Formular) wird als Anweisung gelesen | später, beim Folgeschaden |

Die letzten Zeile ist heute noch theoretisch — es gibt keine Tools und keine
externen Datenquellen im Prompt. Sie wird real mit den Issues #5 (Sensor-Daten),
#7 (GitHub-Roadmap), #10 (Feedback-Widget) und #8 (Embed-Widget).

## Die Schichten

Reihenfolge in `src/app/api/chat/route.ts`. Jede Schicht ist billiger als die
nächste — was früh abgewiesen wird, kostet nichts.

1. **Not-Aus** (`CHAT_DISABLED`) — ein Env-Wert schaltet den Chat ab, ohne
   Deploy. Für den Fall, dass etwas aus dem Ruder läuft.
2. **Origin-Prüfung** — nur Anfragen von der eigenen Seite. Fälschbar, hält
   aber jedes unbedachte Skript und jede fremde Einbettung draußen.
3. **Rate-Limit und Kontingente** (`src/lib/guard/ratelimit.ts`) — gleitendes
   Fenster pro Gegenstelle, Tageskontingent pro Gegenstelle, Tages-Token-Budget
   über alle Nutzer. Das Token-Budget ist die eigentliche Notbremse: es greift
   auch bei verteilten Angriffen über viele Adressen.
4. **Größen- und Schemaprüfung** (`src/lib/guard/schema.ts`) — Body-Größe,
   Zeichenlimits, Verlaufslänge. Angenommen wird ausschließlich Text mit den
   Rollen `user` und `assistant`; Bilder, Dateien, Tool-Parts und eine
   selbstgebaute `system`-Rolle werden abgelehnt.
5. **Normalisierung** (`src/lib/guard/sanitize.ts`) — NFKC, Entfernen von
   unsichtbaren Zeichen (Unicode-Tag-Block, Zero-Width, Bidi) und
   Steuerzeichen. Ohne diesen Schritt prüft die nächste Schicht einen anderen
   Text als den, den das Modell liest.
6. **Heuristik** (`src/lib/guard/screen.ts`) — erkennt die mechanischen
   Angriffe (Override, Prompt-Extraktion, Template-Marker, Base64-Payloads,
   Secret-Fishing) und antwortet mit der festen Ablehnung, **ohne** das Modell
   zu fragen: 0 Token. Wiederholte Treffer von derselben Adresse führen zu
   einer befristeten Sperre.
7. **Datenmarkierung** (`src/lib/guard/prompt.ts`) — Nutzertext wird in Marker
   mit einer pro Anfrage neu gezogenen Zufallskennung gepackt. Der
   System-Prompt erklärt: was zwischen den Markern steht, ist Inhalt und
   niemals Anweisung. Weil die Kennung nicht vorhersagbar ist, kann sich ein
   Angreifer nicht selbst aus der Datenzone „herausschreiben".
8. **System-Prompt mit fester Ablehnungsformel** — enger Auftrag, klare
   Grenzen, *ein* Ablehnungssatz. Der feste Wortlaut ist nicht Kosmetik: er
   macht das Verhalten testbar und beim Providerwechsel vergleichbar.
9. **Ausgabegrenzen** — `maxOutputTokens` deckelt die teure Seite,
   `abortSignal` beendet den Modellaufruf, wenn der Browser die Verbindung
   schließt. Der tatsächliche Verbrauch wird auf das Tagesbudget gebucht.
10. **Protokoll** (`src/lib/guard/log.ts`) — jede Abweisung wird geloggt: mit
    pseudonymisierter Client-Kennung, Regelnamen und Kennzahlen, **nie** mit
    Nachrichtentext oder IP-Adresse.

## Verhalten aus Nutzersicht

| Fall | Antwort |
|---|---|
| Heuristik-Treffer / Thema verfehlt | HTTP 200 mit der festen Ablehnung — sieht wie eine normale Antwort aus, kostet 0 Token |
| Zu lang | HTTP 413 mit Zeichenzahl und Limit |
| Zu häufig | HTTP 429 mit `Retry-After` |
| Tagesbudget erschöpft / Not-Aus | HTTP 503 |
| Fremde Herkunft | HTTP 403 |
| Kaputter Body | HTTP 400 |

Fehlerantworten haben absichtlich einen Klartext-Body: `useChat` macht daraus
`error.message`, die Chat-UI zeigt also einen lesbaren deutschen Satz.

### Streng bei Gefahr, tolerant bei Beiwerk

Die Validierung hat zwei Sorten von Eingaben zu unterscheiden, und beim ersten
Wurf lag die Grenze falsch:

- **Streng** bleibt, was sicherheitsrelevant ist: Datei-/Bild-Parts
  (Vision-Kosten, Text im Bild als Injection-Medium), Tool-Parts (der Client
  darf keine Tool-Ergebnisse erfinden), Data-Parts, die Rolle `system`, ein
  inhaltlicher `assistant`-Turn an letzter Stelle (Prefill-Angriff). Das wird
  mit 400 abgewiesen.
- **Tolerant** ist alles, was der Client als Beiwerk mitschickt. Die Parts
  einer `UIMessage` sind nicht vorhersagbar: **Claude 5 liefert bei längeren
  Antworten einen `reasoning`-Part**, je nach Modell und SDK-Version kommen
  `source-url`, `custom` oder künftig Weiteres dazu. Eine Allowlist bekannter
  Part-Typen sieht sauber aus, hängt aber am Provider — genau das, was diese
  Schicht nicht darf (#12) — und sprengt beim ersten unbekannten Typ die
  Sitzung. Verarbeitet wird deshalb nur `text`, alles Unbekannte wird
  ignoriert.

Konkret aufgefallen ist das zweimal im selben Muster: eine Frage wird
beantwortet, die *nächste* bekommt „Ungültige Anfrage" — weil die Antwort
einen Part enthielt, den das Schema nicht kannte, und der Client sie beim
nächsten Turn mitschickt. Reproduzierbar mit dem echten Client-Code:
`new Chat({transport: new DefaultChatTransport({api})})` in einem Node-Skript,
Fragen senden, `chat.messages[i].parts.map(p => p.type)` ausgeben.

**Ebenso wichtig: eine Abweisung darf die Sitzung nicht kaputt machen.** `useChat` behält die gescheiterte Frage im Verlauf und legt
zusätzlich eine Assistenz-Nachricht **ohne Inhalt** an. Beides kommt beim
nächsten Versuch mit zurück. Ein Schema, das inhaltsleere Nachrichten oder
zwei aufeinanderfolgende `user`-Turns ablehnt, macht aus einem einmaligen 429
eine dauerhaft unbrauchbare Sitzung — die nächste harmlose Frage bekäme
„Ungültige Anfrage", bis die Seite neu geladen wird. Deshalb werden solche
Nachrichten verworfen und nicht abgewiesen; drei Fälle in der Suite
(`empty-assistant-turn`, `trailing-empty-assistant-turn`, `double-user-turn`)
halten das fest.

Beim Entwickeln lohnt es sich, Rate-Limit und Sperre in `.env.local`
großzügiger zu setzen (`CHAT_RATE_MAX_REQUESTS=60`,
`CHAT_SUSPICIOUS_LIMIT=0`) — sonst blockiert man sich beim Ausprobieren selbst.
Die Zähler liegen im Prozess: ein Neustart des Dev-Servers setzt sie ebenfalls
zurück.

## Testen

```bash
npm run dev            # Terminal 1
npm run redteam        # Terminal 2
```

`scripts/redteam.mjs` fährt die Fälle aus `tests/redteam-cases.json` gegen den
laufenden Server. Das Skript spricht ausschließlich HTTP und weiß nichts über
den Provider — **dieselbe Suite läuft nach einem Wechsel auf Mistral
unverändert** (Issue #12) und zeigt sofort, ob die Abwehr noch hält.

Die Suite enthält bewusst auch Kontrollfälle (echte Bürgerfragen, eine Frage
mit den Wörtern „Regeln" und „umgehen"). Eine Abwehr, die alles ablehnt, ist
kein Erfolg — Falsch-Positive sind Fehler und fallen hier auf.

Zwei Eigenheiten der Suite, damit Ergebnisse verlässlich sind:

- **`expect: "refuse-free"`** für schädliche Anfragen. Dort schwankt das
  Modell zwischen der festen Formel und einer eigenen Sicherheitsantwort
  („das wäre eine Straftat, wenden Sie sich an …"). Letztere ist inhaltlich
  die bessere Antwort; ein Test, der sie als Fehler zählt, wäre nur flaky.
  Für Themenverfehlungen bleibt die Formel Pflicht (`expect: "refuse"`).
- **Der Rate-Limit-Fall arbeitet mit einer overlangen Nachricht.** Die wird
  *nach* der Limit-Prüfung mit 413 abgewiesen, kostet also keinen
  Modellaufruf. Mit echten Fragen hing der Fall an der Antwortdauer: bei
  langsamen Antworten lief das 60-Sekunden-Fenster ab, bevor 12 Anfragen
  zusammenkamen — der Test schlug fehl, obwohl das Limit funktionierte.
- **Der Adressblock wechselt pro Lauf.** Sonst greift beim zweiten Lauf
  innerhalb von 15 Minuten noch die Sperre des ersten, und Fälle „bestehen"
  aus dem falschen Grund.

Prompt-Leak prüfen:

```bash
# in .env.local: CHAT_PROMPT_CANARY=RTBG-CANARY-4711, dann Dev-Server neu starten
CHAT_PROMPT_CANARY=RTBG-CANARY-4711 npm run redteam
```

Taucht die Marke in einer Antwort auf, ist der System-Prompt geleakt — jeder
Fall prüft das mit.

Ziel für ein Release: alle Fälle grün. Neue Angriffsidee? Erst als Fall in
`tests/redteam-cases.json`, dann fixen.

## Bekannte Lücken

Ehrlich benannt, statt Sicherheit zu behaupten:

1. **Der Verlauf kommt vom Client.** Auch die `assistant`-Nachrichten darin
   sind frei erfunden — der Server hält keine Sitzung. Ein Angreifer kann sich
   also selbst eine passende Vorgeschichte schreiben („Du hast mir schon
   zugesagt, dass …"). Gemildert wird das durch Längen- und Anzahlgrenzen und
   dadurch, dass verdächtige Verlaufsnachrichten inhaltlich ersetzt werden;
   der saubere Weg ist eine serverseitige Sitzung (Verlauf im Server-Store,
   Client schickt nur die neue Frage) oder ein signierter Verlauf.
2. **Zähler nur im Prozess.** Ein Neustart setzt Rate-Limit und Tagesbudget
   zurück, mehrere Instanzen zählen getrennt. Für einen Passenger-Prozess pro
   Umgebung reicht das; darüber hinaus braucht es einen gemeinsamen Speicher
   (Redis/Valkey oder SQLite) hinter derselben Schnittstelle.
3. **IP-basierte Limits sind grob.** Ein ganzes Bürgeramt hinter einer NAT-IP
   teilt sich ein Kontingent, ein Angreifer mit vielen Adressen umgeht es. Die
   Notbremse ist deshalb das globale Token-Budget.
4. **Kein Bot-Schutz.** Ein Proof-of-Work oder ein datenschutzfreundliches
   Captcha (Friendly Captcha, Turnstile) ab der n-ten Anfrage wäre die nächste
   Stufe, wenn automatisierter Missbrauch auftritt.
5. **Keine Ausgabeprüfung.** Heute unkritisch, weil die UI Antworten als
   reinen Text rendert (`whitespace-pre-wrap`, kein Markdown, kein HTML).
   **Sobald Markdown gerendert wird**, entsteht mit Bild- und Link-Syntax ein
   Abflusskanal: ein injizierter Text kann das Modell dazu bringen,
   Gesprächsinhalte in eine Bild-URL zu kodieren, die der Browser beim
   Rendern selbst abruft. Dann braucht es eine Allowlist für Ziel-Domains und
   ein Verbot automatisch geladener externer Ressourcen.
6. **Keine Tools, keine externen Quellen — noch nicht.** Was bei der
   Einführung gilt: Werkzeuge nur mit Allowlist und ohne Seiteneffekte;
   schreibende Aktionen (z. B. GitHub-Issue aus dem Feedback-Widget, #10) nur
   mit serverseitigem Template und ausdrücklicher Bestätigung durch die Person
   — niemals mit vom Modell frei formuliertem Inhalt und niemals mit einem
   Token, das mehr darf als genau diese eine Aktion.
7. **Heuristiken sind Mustererkennung.** Sie erkennen Bekanntes. Neue
   Formulierungen fangen erst die Schichten 7–9 auf — und die halten nicht
   immer. Deshalb ist die Regelliste ein lebendes Dokument, kein fertiger
   Filter.

## Wenn der Provider wechselt (#12)

- Die Schichten 1–7 sind provider-unabhängig und bleiben unverändert.
- Zu prüfen ist Schicht 8: Modelle folgen einem System-Prompt unterschiedlich
  strikt. `npm run redteam` zeigt den Unterschied in Zahlen.
- Modellspezifisches gehört in die Abwehr, nicht in den Prompt: die
  Template-Marker in `screen.ts` decken bewusst mehrere Modellfamilien ab
  (`<|im_start|>`, `[INST]`, `<s>`), weil ein Wechsel des Providers das
  wirksame Injection-Format ändert.
