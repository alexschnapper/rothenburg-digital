import { describe, expect, it } from "vitest";

import { openingToday, touristInfoStatus } from "@/lib/touristInfo";

/** Zeitpunkt in deutscher Zeit (UTC+1 im Winter, UTC+2 im Sommer). */
const winter = (iso: string) => new Date(`${iso}+01:00`);
const summer = (iso: string) => new Date(`${iso}+02:00`);

describe("touristInfoStatus", () => {
  it("meldet nach 17 Uhr an einem Werktag: für heute geschlossen", () => {
    // Der Fall aus Issue #34: Dienstag, 3.11.2026, 17:50 Uhr
    expect(touristInfoStatus(winter("2026-11-03T17:50:00"))).toBe(
      "Öffnungszeit heute 9:00–17:00 Uhr. Für heute ist bereits geschlossen.",
    );
  });

  it("meldet während der Öffnungszeit: geöffnet", () => {
    expect(touristInfoStatus(winter("2026-11-03T10:00:00"))).toBe(
      "Öffnungszeit heute 9:00–17:00 Uhr. Gerade ist geöffnet.",
    );
  });

  it("meldet vor Öffnung, wann sie öffnet", () => {
    expect(touristInfoStatus(winter("2026-11-03T08:15:00"))).toBe(
      "Öffnungszeit heute 9:00–17:00 Uhr. Gerade ist noch geschlossen, sie öffnet heute um 9:00 Uhr.",
    );
  });

  it("rechnet in deutscher Zeit, nicht in der Server-Zeitzone", () => {
    // 16:30 UTC = 17:30 Uhr in Rothenburg
    expect(touristInfoStatus(new Date("2026-11-03T16:30:00Z"))).toContain(
      "bereits geschlossen",
    );
  });

  it("gibt null zurück für ein Dezember-Wochenende ohne Markttermine", () => {
    expect(touristInfoStatus(winter("2027-12-04T11:00:00"))).toBeNull();
  });

  it("Reiterlesmarkt 2026: Wochenende 10–17 Uhr, auch im November", () => {
    expect(touristInfoStatus(winter("2026-12-05T11:00:00"))).toBe(
      "Öffnungszeit heute 10:00–17:00 Uhr. Gerade ist geöffnet.",
    );
    // Sa 21.11. — ohne Markt wären es 10–13 Uhr
    expect(openingToday(winter("2026-11-21T11:00:00"))).toEqual({
      open: true,
      from: 600,
      to: 1020,
    });
  });

  it("Totensonntag während des Markts: kein Status", () => {
    expect(touristInfoStatus(winter("2026-11-22T11:00:00"))).toBeNull();
  });

  it("Samstag vor dem Markt bleibt 10–13 Uhr", () => {
    expect(openingToday(winter("2026-11-14T11:00:00"))).toEqual({
      open: true,
      from: 600,
      to: 780,
    });
  });

  it("gibt null zurück zwischen Weihnachten und Silvester, auch werktags", () => {
    expect(touristInfoStatus(winter("2026-12-28T11:00:00"))).toBeNull();
  });

  it("Werktag im Dezember vor Weihnachten: 9–17 Uhr", () => {
    expect(touristInfoStatus(winter("2026-12-08T11:00:00"))).toBe(
      "Öffnungszeit heute 9:00–17:00 Uhr. Gerade ist geöffnet.",
    );
  });
});

describe("openingToday", () => {
  it("November: Samstag 10–13 Uhr, Sonntag geschlossen", () => {
    expect(openingToday(winter("2026-11-07T12:00:00"))).toEqual({
      open: true,
      from: 600,
      to: 780,
    });
    expect(openingToday(winter("2026-11-08T12:00:00"))).toEqual({ open: false });
  });

  it("Allerheiligen (1.11.) ist geschlossen", () => {
    expect(openingToday(winter("2026-11-01T12:00:00"))).toEqual({ open: false });
  });

  it("Karfreitag bis Ostermontag 10–15 Uhr (Ostern 2027: 28.3.)", () => {
    expect(openingToday(winter("2027-03-26T12:00:00"))).toEqual({
      open: true,
      from: 600,
      to: 900,
    });
    expect(openingToday(summer("2027-03-29T12:00:00"))).toEqual({
      open: true,
      from: 600,
      to: 900,
    });
  });

  it("Sommer-Wochenende 10–17 Uhr, Herbst-Wochenende 10–15 Uhr", () => {
    expect(openingToday(summer("2027-07-10T12:00:00"))).toEqual({
      open: true,
      from: 600,
      to: 1020,
    });
    expect(openingToday(summer("2027-09-11T12:00:00"))).toEqual({
      open: true,
      from: 600,
      to: 900,
    });
  });
});
