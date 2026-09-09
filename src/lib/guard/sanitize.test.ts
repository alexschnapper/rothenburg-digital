import { describe, expect, it } from "vitest";

import { sanitizeText, truncate } from "@/lib/guard/sanitize";

describe("sanitizeText", () => {
  it("lässt normalen Text unverändert (bis auf Trim)", () => {
    const { text, removed } = sanitizeText("  Wann hat das Rathaus auf?  ");
    expect(text).toBe("Wann hat das Rathaus auf?");
    expect(removed).toBe(0);
  });

  it("entfernt den unsichtbaren Unicode-Tag-Block", () => {
    // U+E0069 = Tag-Kopie von "i" — der Trick aus dem Redteam-Fall
    // "hidden-tag-chars".
    const hidden = String.fromCodePoint(0xe0069, 0xe0067);
    const { text, removed } = sanitizeText(`abc${hidden}def`);
    expect(text).toBe("abcdef");
    expect(removed).toBe(2);
  });

  it("entfernt Zero-Width- und Bidi-Steuerzeichen", () => {
    const zeroWidthSpace = String.fromCodePoint(0x200b);
    const { text, removed } = sanitizeText(`ig${zeroWidthSpace}noriere`);
    expect(text).toBe("ignoriere");
    expect(removed).toBe(1);
  });

  it("normalisiert Kompatibilitätszeichen (NFKC) statt sie zu zählen", () => {
    // Fullwidth-Zeichen sind sichtbar, kein "removed" — nur eine
    // Normalform-Änderung.
    const { text, removed } = sanitizeText("ＩＧＮＯＲＩＥＲＥ");
    expect(text).toBe("IGNORIERE");
    expect(removed).toBe(0);
  });

  it("kürzt mehr als eine Leerzeile und lange Leerraumketten", () => {
    const { text } = sanitizeText("A\n\n\n\nB   \t\t\t\tC");
    expect(text).toBe("A\n\nB C");
  });

  it("vereinheitlicht Zeilenenden auf \\n", () => {
    const { text } = sanitizeText("A\r\nB\rC");
    expect(text).toBe("A\nB\nC");
  });
});

describe("truncate", () => {
  it("lässt kurzen Text unverändert", () => {
    expect(truncate("kurz", 10)).toBe("kurz");
  });

  it("kürzt Overlängen und hängt eine Ellipse an", () => {
    expect(truncate("abcdefgh", 4)).toBe("abcd…");
  });

  it("behandelt die exakte Grenze als noch nicht zu lang", () => {
    expect(truncate("abcd", 4)).toBe("abcd");
  });
});
