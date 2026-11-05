import { describe, expect, it } from "vitest";

import { stripInternalMarkers } from "@/lib/guard/output";

describe("stripInternalMarkers", () => {
  it("entfernt einen ausgegebenen fremdquelle-Marker, behält den Inhalt", () => {
    const text =
      '<fremdquelle id="wetter_31102026" herkunft="DWD-Lokalprognose"> - **Samstag**: 12 °C </fremdquelle>\n\nTipp: Regenjacke';
    expect(stripInternalMarkers(text)).toBe(
      " - **Samstag**: 12 °C \n\nTipp: Regenjacke",
    );
  });

  it("entfernt buergerfrage-Marker samt Kennung im schließenden Tag", () => {
    expect(
      stripInternalMarkers('<buergerfrage id="abc">Frage</buergerfrage id="abc">'),
    ).toBe("Frage");
  });

  it("lässt normalen Text und andere spitze Klammern unverändert", () => {
    const text = "Feinstaub < 20 µg/m³, Temperatur > 0 °C, <b>fett</b>";
    expect(stripInternalMarkers(text)).toBe(text);
  });
});
