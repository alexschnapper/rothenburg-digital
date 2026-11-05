import { describe, expect, it } from "vitest";

import { askedWeekday, asksForNow, keywords } from "@/lib/opendata/query";

/** Mi 4.11.2026, 12:00 deutsche Zeit */
const WEDNESDAY = new Date("2026-11-04T12:00+01:00");

describe("keywords", () => {
  it("lässt Füll- und Gattungswörter weg", () => {
    expect(keywords("Welches Restaurant hat jetzt noch Schäufele?")).toEqual(["schäufele"]);
  });
});

describe("asksForNow", () => {
  it.each(["Hat jetzt noch was offen?", "Was ist gerade geöffnet?", "Which café is open now?"])(
    "erkennt „%s“",
    (question) => expect(asksForNow(question)).toBe(true),
  );

  it("ignoriert Fragen ohne Zeitbezug", () => {
    expect(asksForNow("Wo gibt es italienisches Essen?")).toBe(false);
  });
});

describe("askedWeekday", () => {
  it("liest genannte Wochentage, auch zusammengesetzt", () => {
    expect(askedWeekday("Was hat am Sonntagnachmittag offen?", WEDNESDAY)).toBe(6);
    expect(askedWeekday("Open on Monday?", WEDNESDAY)).toBe(0);
  });

  it("löst heute, morgen und übermorgen in deutscher Zeit auf", () => {
    expect(askedWeekday("Was hat heute Abend offen?", WEDNESDAY)).toBe(2);
    expect(askedWeekday("Und morgen?", WEDNESDAY)).toBe(3);
    expect(askedWeekday("Und übermorgen?", WEDNESDAY)).toBe(4);
  });

  it("gibt ohne Tagesangabe null zurück", () => {
    expect(askedWeekday("Wo gibt es Pizza?", WEDNESDAY)).toBeNull();
  });
});
