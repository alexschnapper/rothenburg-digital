<div align="center">
  <img src="./public/rothenburg_digital.svg" alt="Rothenburg.digital Logo" width="96" height="96" style="border-radius: 20px;">
  
  # rothenburg.digital
  
  **Das offene Praxis-Labor für Rothenburg ob der Tauber.**
  
  *Ein Proof of Concept des OK Lab Rothenburg – eine Initiative von Alexander Schnapper.*
  
  [![Website](https://img.shields.io/badge/Live%20Demo-rothenburg.digital-c2410c?style=flat-square)](https://rothenburg.digital/)
  [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](./LICENSE)
  [![WCAG AAA](https://img.shields.io/badge/Barrierefreiheit-WCAG%20AAA-15803d?style=flat-square)](https://www.w3.org/WAI/WCAG22/quickref/)
  [![Status](https://img.shields.io/badge/Status-In%20Entwicklung%20(Fr%C3%BChjahr%202027)-0284c7?style=flat-square)](https://github.com/alexschnapper/rothenburg-digital/milestones)
</div>

---

### 🧪 Über das Projekt

**rothenburg.digital** ist ein zivilgesellschaftliches Civic-Tech-Projekt zur Erprobung barrierefreier Datenflüsse, offener Sensorik und Klimaresilienz – in Kooperation mit lokalen Akteuren und Initiativen. Es entsteht als Proof of Concept im Rahmen des **OK Lab Rothenburg**, initiiert und entwickelt von Alexander Schnapper.

Das System ist bewusst **keine weitere Insel-Plattform**, sondern konzipiert als:

* **🔌 Offener Daten-Feeder & Integrations-Layer:** Lokale Daten werden in offenen, standardisierten Formaten aufbereitet, damit bestehende Systeme sie übernehmen können – etwa **Land.Open.Data** oder Knowledge Graphs.
* **📡 Erprobungsfeld für Edge- und LoRaWAN-Sensorik:** Messnetze, Gateways und Edge-Auswertung werden vor Ort praxisnah getestet – offen, nachbaubar und übertragbar auf andere Kommunen.

Das Projekt entsteht zu **100 % quelloffen (GPLv3)**, DSGVO-konform und wird auf unabhängigen Servern in Deutschland betrieben.

🔗 **Website:** [https://rothenburg.digital/](https://rothenburg.digital/)

> **Rollenabgrenzung:** rothenburg.digital ist keine offizielle Tourismusseite und keine Konkurrenz zu [rothenburg-tourismus.de](https://www.rothenburg-tourismus.de/). Als unabhängiges OK Lab testen wir neue, offene Schnittstellen und Datenformate (u. a. für Land.Open.Data), um Barrierearmut, Hitzeschutz und urbane Sensorik praxistauglich zu machen.

---

### 🌟 Schwerpunkte

* **♿ Echte Inklusion**
  * WCAG AAA als Maßstab für alle Oberflächen: höchste Kontraste, vollständige Tastatur- und Screenreader-Bedienung.
  * 1-Klick-Umschalter für **Einfache Sprache** (kurze Sätze, bekannte Wörter).
  * Stufenfreie Wegeführung auf historischem Altstadt-Pflaster und reizarme Rückzugsorte (Neurodivergenz/Sensory-Friendly).
* **📡 Urbane Sensorik & Klima**
  * LoRaWAN-Messnetze für Bodenfeuchte und Stadtklima (im Aufbau, siehe [Pilot-Stränge](#-pilot-stränge-2027)).
  * Bereits angebunden: amtliche Luftqualitätswerte des Umweltbundesamts, ergänzt um einen lokalen Sensor ([Sensor.Community](https://sensor.community/)) als Richtwert; E-Ladesäulen (AC/DC) und das Altstadt-Parkleitsystem (P1–P5).
* **🔒 Open Data & Souveränität**
  * 100 % Open Source (GPLv3), DSGVO-konform, interoperabel.
  * Offene Formate und Schnittstellen statt geschlossener Datensilos.
* **💬 Dialog-Prototyp:** Ein mehrsprachiger, barrierefreier Chat (Deutsch, Englisch, Niederländisch, Japanisch u. a.) zeigt, wie sich offene Daten verständlich abfragen lassen.

---

### 🌱 Pilot-Stränge 2027

Geplante Piloten im Rahmen des OK Lab Rothenburg – noch nicht umgesetzt:

1. **🌳 Baum-Sensorik & Stadtgärtnerei (Bodenfeuchte / Gieß-Dashboard)**
   * **Ziel:** Trockenstress an städtischen Jungbäumen sichtbar machen und Bewässerungsfahrten optimieren – nach Vorbildern wie *Gieß den Kiez* (Berlin) oder Projekten in Leipzig und Stuttgart.
   * **Technik:** Kapazitive Bodenfeuchte- und Temperatursensoren per LoRaWAN im Wurzelbereich ausgewählter Stadtbäume.
   * **Mehrwert:** Greifbarer Nutzen für Klimaschutzmanagement und Stadtgärtnerei; anschaulich für Bürgerschaft und Gremien.
2. **🌡️ Mikroklima & Hitze-Hotspots (DIY-Umweltsensoren)**
   * **Ziel:** Das reale Mikroklima der engen, versiegelten Altstadt mit Kaltluftkorridoren (Burggarten, Taubertal) vergleichen.
   * **Technik:** Sensor.Community-Hardware (z. B. ESP32/ESP8266 mit BME280 für Temperatur/Luftfeuchte, SPS30/SDS011 für Feinstaub) oder LoRaWAN-Wetterstationen.
   * **Mehrwert:** Datenbasis für Hitzeschutzmaßnahmen und eine spätere „Cool-Route“ für Einheimische und Gäste.
3. **🅿️ Test-Parkraumerfassung (Besucherlenkung vor der Stadtmauer)**
   * **Ziel:** Prototypische Belegungserkennung ausgewählter Parkflächen (z. B. P1–P5), um Verkehrsströme früh zu lenken und Parksuchverkehr in den Gassen zu verringern.
   * **Technik:** LoRaWAN-Bodensensoren (geomagnetisch/Radar, mehrjähriger Batteriebetrieb) auf wenigen Test-Stellplätzen – oder optische Zählung an Ein-/Ausfahrt mit lokaler Edge-KI, DSGVO-konform ohne Kennzeichen-Speicherung.
   * **Mehrwert:** Hohe Relevanz für Besucherlenkung und Verkehrsüberwachung bei Großevents und zu Stoßzeiten.

#### 📶 Das Rückgrat: offenes LoRaWAN mit The Things Network

Da es noch keine Sensor-Infrastruktur gibt, ist der Aufbau eines offenen LoRaWAN-Netzes der erste Schritt:

* **Offen & bürgernah:** Einbindung in [The Things Network (TTN)](https://www.thethingsnetwork.org/) – so können Bürgerinnen und Bürger, Schulen oder Gewerbetreibende eigene Sensoren ohne Zusatzkosten einbinden.
* **Hardware-Bedarf:** 1–2 Outdoor-Gateways (z. B. MikroTik wAP LR8 oder RAK Wireless) an erhöhten Punkten (z. B. nahe der Stadtmauer oder auf einem privaten Dach) decken oft schon weite Teile der Altstadt und der Parkflächen ab.

---

### 🗺️ Roadmap & Meilensteine

Fortschritt und Details in den [Milestones](https://github.com/alexschnapper/rothenburg-digital/milestones) — jeder Punkt hängt an einem Issue.

* **Grundgerüst** – umgesetzt auf `dev`: Next.js-PWA mit One-Box-Chat über das Vercel AI SDK
  ([#1](https://github.com/alexschnapper/rothenburg-digital/issues/1),
  [#11](https://github.com/alexschnapper/rothenburg-digital/issues/11))
* **`v0.1-alpha`** (Anfang November 2026): EU-Modell über Mistral ([#12](https://github.com/alexschnapper/rothenburg-digital/issues/12)),
  Missbrauchs-Abwehr am Chat ([#13](https://github.com/alexschnapper/rothenburg-digital/issues/13)),
  Showcase-Szenarien & Mitarbeiter-Tipp-Format ([#3](https://github.com/alexschnapper/rothenburg-digital/issues/3)),
  Grounding gegen halluzinierte Fakten ([#27](https://github.com/alexschnapper/rothenburg-digital/issues/27))
* **`v0.2-beta`** (Ende November 2026): Einfache-Sprache-Umschalter ([#2](https://github.com/alexschnapper/rothenburg-digital/issues/2)),
  Basis-Mehrsprachigkeit ([#4](https://github.com/alexschnapper/rothenburg-digital/issues/4)),
  Luftqualität im Chat mit amtlichen Daten und lokalem Sensor.Community-Sensor ([#5](https://github.com/alexschnapper/rothenburg-digital/issues/5)),
  E-Mobilität & Parkleitsystem ([#6](https://github.com/alexschnapper/rothenburg-digital/issues/6))
* **`v0.3-beta`** (Mitte Dezember 2026): direkte OSM-Kartenlinks über echte Geokodierung ([#29](https://github.com/alexschnapper/rothenburg-digital/issues/29))
* **`v1.0-release`** (voraussichtlich Ende Februar 2027): offlinefähige PWA
  ([#9](https://github.com/alexschnapper/rothenburg-digital/issues/9)),
  Embed-Widget für externe Webseiten ([#8](https://github.com/alexschnapper/rothenburg-digital/issues/8)),
  vollständiger Rollout

---

### 🛠️ Tech-Stack

* **Framework:** Next.js (App Router, PWA)
* **AI / Orchestrierung:** Vercel AI SDK (DSGVO-konforme EU-Modelle / Mistral AI)
* **Design & A11y:** Tailwind CSS, Semantic HTML, Screenreader-optimiert, Ausrichtung auf WCAG AAA
* **Sensorik (geplant):** LoRaWAN über The Things Network, Sensor.Community-Hardware, Edge-Auswertung
* **Hosting:** Unabhängiger Linux VPS mit Plesk (Nginx / Node.js Runtime) in Deutschland

---

### 🧑‍💻 Entwicklung

Entwickelt wird auf `dev`; `main` trägt den veröffentlichten Stand.

```bash
npm install
cp .env.example .env.local   # MISTRAL_API_KEY eintragen
npm run dev                  # http://localhost:3000
```

* **Lokal starten, Feature-Flags, Projektstruktur:** [`docs/ENTWICKLUNG.md`](./docs/ENTWICKLUNG.md)
* **Umgebungsvariablen & Deployment (Plesk/Passenger):** [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

---

### 🤝 Mitmachen & Feedback

Das OK Lab Rothenburg lebt vom Mitmachen. Wir freuen uns über Mitwirkende, Ideen und Anregungen aus der Bürgerschaft, von lokalen Initiativen, Schulen und Open-Source-Begeisterten – ob mit Code, Sensor- oder Gateway-Standorten oder Rückmeldungen zur Barrierefreiheit:

* 💡 **Ideen einreichen:** Erstelle gerne ein [GitHub Issue](https://github.com/alexschnapper/rothenburg-digital/issues) mit dem Label `community-proposal`.
* 🐛 **Fehler melden:** Bitte über den [Issue-Tracker](https://github.com/alexschnapper/rothenburg-digital/issues) erfassen.

---

### ⚖️ Disclaimer & Lizenz

rothenburg.digital ist ein Proof of Concept des OK Lab Rothenburg – eine unabhängige Open-Source-Initiative, konzipiert und entwickelt von **Alexander Schnapper**.  
*Kein offizielles Angebot der Stadt Rothenburg ob der Tauber oder des Rothenburg Tourismus Service (RTS) – offen für Dialog und Kooperation.*

Der Quellcode ist lizenziert unter der [GNU General Public License v3.0 (GPLv3)](./LICENSE).
