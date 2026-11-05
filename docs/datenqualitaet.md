# Datenqualität der offenen Daten

Automatisch erstellt am 05.11.2026 von `scripts/datenqualitaet.mts` (Issue #80). Nicht von Hand bearbeiten.

Geprüft: 18 Datensätze der Stadt Rothenburg ob der Tauber bei [bydata](https://rothenburg.bydata.de/). 2 mit Fehlern, 14 mit Warnungen, 2 in Ordnung. Die Regeln stehen in `src/lib/opendata/quality.ts`. Die Befunde beschreiben die Daten, nicht die Menschen, die sie pflegen.

## Änderungen gegenüber dem letzten Bericht

**Neu:**

- Einkaufsmöglichkeiten: **Warnung:** Einträge an verschiedenen Straßen liegen auf exakt demselben Kartenpunkt, mindestens einer davon also an der falschen Stelle. (4) Zum Beispiel: Käthes Spielzeugladen; Christkindlmarkt; Käthe Wohlfahrt Weihnachtsdorf.
- Einzelhandel: **Warnung:** Einträge an verschiedenen Straßen liegen auf exakt demselben Kartenpunkt, mindestens einer davon also an der falschen Stelle. (4) Zum Beispiel: Käthes Spielzeugladen; Christkindlmarkt; Käthe Wohlfahrt Weihnachtsdorf.

## Übersicht

| Datensatz | Stand | Einträge | Lizenz | Ergebnis | Nutzung in rothenburg.digital |
|---|---|---|---|---|---|
| [Defibrillatoren](https://rothenburg.bydata.de/datasets/skg-venus-defibrillatoren?locale=de) | 11.09.2026 | 4 | CC0 | 🟡 Warnung | Genutzt: Notfall & Hitze, Chat |
| [Direktvermarkter GOT Rothenburg](https://rothenburg.bydata.de/datasets/skg-venus-direktvermarkter-got-rothenburg?locale=de) | 15.09.2026 | 1 | CC0 | 🟡 Warnung | Genutzt: Einkaufen, Chat |
| [Direktvermarkter Pop-Up Rothenburg](https://rothenburg.bydata.de/datasets/skg-venus-direktvermarkter-popup-rothenburg?locale=de) | 11.09.2026 | 11 | CC0 | 🟡 Warnung | Genutzt: Einkaufen, Chat |
| [E-Ladesäulen](https://rothenburg.bydata.de/datasets/skg-venus-e-ladesaeulen?locale=de) | 15.09.2026 | 1 | CC0 | 🟡 Warnung | Genutzt: Parken & E-Laden, Chat |
| [Einkaufsmöglichkeiten](https://rothenburg.bydata.de/datasets/skg-venus-einkaufsmoeglichkeiten?locale=de) | 13.10.2026 | 54 | CC BY-SA 4.0 | 🟡 Warnung | Genutzt: Einkaufen, Chat |
| [Einzelhandel](https://rothenburg.bydata.de/datasets/skg-venus-einzelhandel?locale=de) | 13.10.2026 | 54 | CC BY-SA 4.0 | 🟡 Warnung | Genutzt: Einkaufen, Chat |
| [Genießen ob der Tauber](https://rothenburg.bydata.de/datasets/skg-venus-geniessen-ob-der-tauber?locale=de) | 11.09.2026 | 2 | CC0 | 🟡 Warnung | Über einen anderen Datensatz abgedeckt: Essen & Trinken, Chat |
| [Handmade](https://rothenburg.bydata.de/datasets/skg-venus-handmade?locale=de) | 13.10.2026 | 6 | CC BY 4.0 | 🟡 Warnung | Genutzt: Einkaufen, Chat |
| [Hitzeorte](https://rothenburg.bydata.de/datasets/skg-venus-hitzeorte?locale=de) | 16.10.2026 | 5 | CC0 | 🟡 Warnung | Genutzt: Notfall & Hitze, Chat |
| [Jüdisches Rothenburg](https://rothenburg.bydata.de/datasets/skg-venus-juedisches-rothenburg?locale=de) | 11.09.2026 | 7 | CC0 | 🟡 Warnung | Über einen anderen Datensatz abgedeckt: Sehenswürdigkeiten, Chat |
| [Museum](https://rothenburg.bydata.de/datasets/skg-venus-museum?locale=de) | 16.10.2026 | 1 | CC0 | 🟡 Warnung | Über einen anderen Datensatz abgedeckt: Sehenswürdigkeiten, Chat |
| [Parkplätze und Wohnmobilstellplätze](https://rothenburg.bydata.de/datasets/skg-venus-parkplaetze?locale=de) | 22.10.2026 | 6 | CC0 | 🟢 in Ordnung | Genutzt: Parken & E-Laden, Chat |
| [Restaurants](https://rothenburg.bydata.de/datasets/skg-venus-restaurants?locale=de) | 22.10.2026 | 28 | CC BY 4.0 | 🟡 Warnung | Genutzt: Essen & Trinken, Chat |
| [Sehenswürdigkeiten](https://rothenburg.bydata.de/datasets/skg-venus-sehenswuerdigkeiten?locale=de) | 16.10.2026 | 37 | CC BY 4.0 | 🔴 Fehler | Genutzt: Sehenswürdigkeiten, Chat |
| [Stadtführungen](https://rothenburg.bydata.de/datasets/skg-venus-stadtfuehrungen?locale=de) | 30.10.2026 | 0 | CC BY 4.0 | 🔴 Fehler | Nicht genutzt |
| [Top 10 Rothenburg](https://rothenburg.bydata.de/datasets/skg-venus-top-10-rothenburg?locale=de) | 16.10.2026 | 2 | CC0 | 🟡 Warnung | Über einen anderen Datensatz abgedeckt: Sehenswürdigkeiten, Chat |
| [Top Events Rothenburg](https://rothenburg.bydata.de/datasets/skg-venus-top-events-rothenburg?locale=de) | 30.10.2026 | 69 | CC0 | 🟢 in Ordnung | Teilweise genutzt |
| [Wanderwege](https://rothenburg.bydata.de/datasets/skg-venus-wanderwege?locale=de) | 11.09.2026 | 1 | CC BY 4.0 | 🟡 Warnung | Nicht genutzt |

Begründungen zur Nutzung stehen in `src/lib/opendata/inventory.ts` (Issue #66).

### Weitere Daten im Portal, nicht geprüft

- **Gemeindekennzahlen (GKSt): Tourismus, Baufertigstellungen, Beschäftigte, Schulen, Lebendgeborene** (Bayerisches Landesamt für Statistik): Amtliche Jahresstatistik ohne Ortsbezug, nicht von der Stadt gepflegt. Vorerst nicht genutzt; Kandidat für eine spätere Seite „Rothenburg in Zahlen“.
- **Grundwassermessstellen (3)** (Gewässerkundlicher Dienst Bayern): Nicht im Portal der Stadt. Wird mit dem Sensorik-Pilot (#73) neu bewertet.
- **Automatische Zählstellen A7, 2014–2023** (Bundesanstalt für Straßenwesen): Nicht im Portal der Stadt, abgeschlossene Zeitreihe ohne Bezug zur Altstadt. Bewusst nicht genutzt.

## Befunde je Datensatz

### Defibrillatoren

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 11.09.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Hinweis:** Einträge ohne jede Beschreibung. (4) Zum Beispiel: Defibrillator Halle Erlbacher Straße Rothenburg ob der Tauber Sportanlage; Defibrillator Burggarten Toilettenanlage Burgtor; Defibrillator Mehrzweckhalle Rothenburg ob der Tauber.

### Direktvermarkter GOT Rothenburg

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 15.09.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.

### Direktvermarkter Pop-Up Rothenburg

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 11.09.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.

### E-Ladesäulen

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 15.09.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Warnung:** Laut https://www.rothenburg.de/besuchen/mobilitaet/e-tankstellen fehlen: P1, P4, P5, Bahnhof.

### Einkaufsmöglichkeiten

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 13.10.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Warnung:** Einträge an verschiedenen Straßen liegen auf exakt demselben Kartenpunkt, mindestens einer davon also an der falschen Stelle. (4) Zum Beispiel: Käthes Spielzeugladen; Christkindlmarkt; Käthe Wohlfahrt Weihnachtsdorf.
- **Hinweis:** Straße oder Ort fehlen in der Adresse. (1) Zum Beispiel: VrEiMaN Ökolebensmittel.
- **Warnung:** Öffnungszeiten stehen in einer Form, die sich nicht maschinell lesen lässt. (1) Zum Beispiel: Candy Castle - Bonbonmanufaktur.
- **Hinweis:** Webadressen ohne „https://“ oder nicht als Adresse lesbar. (4) Zum Beispiel: Kleiner Weihnachtsladen; Früchte und Feinkost Endreß; Rosenpavillion.
- **Hinweis:** Einträge ohne eigene Lizenzangabe. (4) Zum Beispiel: REWE Dominik Stahl; Teddyland; Möbel Kölblin GmbH.
- **Warnung:** Einträge nennen eine andere Lizenz als der Datensatz (CC BY-SA 4.0). (49) Zum Beispiel: Claudia Hädicke Künstlerin; Kleiner Weihnachtsladen; Living Paper.

### Einzelhandel

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 13.10.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Warnung:** Einträge an verschiedenen Straßen liegen auf exakt demselben Kartenpunkt, mindestens einer davon also an der falschen Stelle. (4) Zum Beispiel: Käthes Spielzeugladen; Christkindlmarkt; Käthe Wohlfahrt Weihnachtsdorf.
- **Hinweis:** Straße oder Ort fehlen in der Adresse. (1) Zum Beispiel: VrEiMaN Ökolebensmittel.
- **Warnung:** Öffnungszeiten stehen in einer Form, die sich nicht maschinell lesen lässt. (1) Zum Beispiel: Candy Castle - Bonbonmanufaktur.
- **Hinweis:** Webadressen ohne „https://“ oder nicht als Adresse lesbar. (4) Zum Beispiel: Kleiner Weihnachtsladen; Früchte und Feinkost Endreß; Rosenpavillion.
- **Hinweis:** Einträge ohne eigene Lizenzangabe. (4) Zum Beispiel: REWE Dominik Stahl; Teddyland; Möbel Kölblin GmbH.
- **Warnung:** Einträge nennen eine andere Lizenz als der Datensatz (CC BY-SA 4.0). (49) Zum Beispiel: Claudia Hädicke Künstlerin; Kleiner Weihnachtsladen; Living Paper.

### Genießen ob der Tauber

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 11.09.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Hinweis:** Webadressen ohne „https://“ oder nicht als Adresse lesbar. (1) Zum Beispiel: Ratsstube Rothenburg.
- **Hinweis:** Einträge ohne jede Beschreibung. (1) Zum Beispiel: Ratsstube Rothenburg.

### Handmade

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 13.10.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Warnung:** Öffnungszeiten stehen in einer Form, die sich nicht maschinell lesen lässt. (1) Zum Beispiel: Candy Castle - Bonbonmanufaktur.
- **Warnung:** Einträge nennen eine andere Lizenz als der Datensatz (CC BY 4.0). (5) Zum Beispiel: Wood Art; Pop up Rothenburg; Rothenburg Pictures.

### Hitzeorte

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 16.10.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Warnung:** Öffnungszeiten stehen in einer Form, die sich nicht maschinell lesen lässt. (1) Zum Beispiel: Mittelalterliches Kriminalmuseum.

### Jüdisches Rothenburg

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 11.09.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.

### Museum

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 16.10.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Warnung:** Öffnungszeiten stehen in einer Form, die sich nicht maschinell lesen lässt. (1) Zum Beispiel: Mittelalterliches Kriminalmuseum.

### Parkplätze und Wohnmobilstellplätze

- **Hinweis:** Webadressen ohne „https://“ oder nicht als Adresse lesbar. (4) Zum Beispiel: Parkplatz P4 Rothenburg ob der Tauber; Parkplatz P2 Rothenburg ob der Tauber; Parkplatz P3 Rothenburg ob der Tauber.

### Restaurants

- **Hinweis:** Straße oder Ort fehlen in der Adresse. (1) Zum Beispiel: Grand Cru Chocolaterie am Plönlein.
- **Hinweis:** Webadressen ohne „https://“ oder nicht als Adresse lesbar. (3) Zum Beispiel: Ratsstube Rothenburg; Restaurant Michaelangelo; Hotel Rothenburger Hof.
- **Hinweis:** Einträge ohne jede Beschreibung. (7) Zum Beispiel: Ratsstube Rothenburg; BrotHaus Zuckerbäckerei Rothenburg o.d.T.; Brot & Zeit Rothenburg o.d.T..
- **Hinweis:** Einträge ohne eigene Lizenzangabe. (5) Zum Beispiel: Brot & Zeit Rothenburg o.d.T.; BrotHaus Café im E-Center Rothenburg o.d.T.; BrotHaus Café im Schlachthof.
- **Warnung:** Einträge nennen eine andere Lizenz als der Datensatz (CC BY 4.0). (8) Zum Beispiel: Bronnenmühle Unter den Linden Rothenburg ob der Tauber; Ratsstube Rothenburg; Gasthaus Alter Keller.

### Sehenswürdigkeiten

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 16.10.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Hinweis:** Straße oder Ort fehlen in der Adresse. (5) Zum Beispiel: Klingentor; Klosterturm; Bettelvogtsturm.
- **Fehler:** Die Postleitzahl hat nicht fünf Ziffern. (1) Zum Beispiel: Burgtor.
- **Warnung:** Öffnungszeiten stehen in einer Form, die sich nicht maschinell lesen lässt. (3) Zum Beispiel: Rathausturm Rothenburg ob der Tauber; Ratstrinkstube Rothenburg ob der Tauber Tourist Info; Mittelalterliches Kriminalmuseum.
- **Warnung:** Einträge nennen eine andere Lizenz als der Datensatz (CC BY 4.0). (36) Zum Beispiel: Ruckesser; Faulturm; Rathaus Rothenburg ob der Tauber.

### Stadtführungen

- **Fehler:** Der Datensatz enthält keine Einträge.

### Top 10 Rothenburg

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 16.10.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Warnung:** Öffnungszeiten stehen in einer Form, die sich nicht maschinell lesen lässt. (1) Zum Beispiel: Mittelalterliches Kriminalmuseum.

### Top Events Rothenburg

- **Hinweis:** Webadressen ohne „https://“ oder nicht als Adresse lesbar. (69) Zum Beispiel: Toppler Theater; Rothenburger Reiterlesmarkt.
- **Hinweis:** Termine ohne Datum. (1) Zum Beispiel: Toppler Theater.

### Wanderwege

- **Warnung:** Als „wöchentlich" aktualisiert angegeben, zuletzt geändert am 11.09.2026. Entweder fehlt eine Aktualisierung, oder die Angabe zur Häufigkeit passt nicht.
- **Hinweis:** Einträge ohne eigene Lizenzangabe. (1) Zum Beispiel: W6: Rothenburger Panoramaweg.
