import { describe, expect, it } from "vitest";

import { KNOWN_STATUS_CODES, httpStatus } from "@/lib/httpStatus";

describe("httpStatus", () => {
  it("liefert deutsche Bezeichnungen für die Codes, die hier vorkommen", () => {
    expect(httpStatus(404).name).toBe("Nicht gefunden");
    expect(httpStatus(429).name).toBe("Zu viele Anfragen");
    expect(KNOWN_STATUS_CODES).toEqual(
      expect.arrayContaining([400, 401, 403, 404, 413, 429, 500, 502, 503, 504]),
    );
  });

  it("hat für unbekannte Codes eine allgemeine Erklärung", () => {
    expect(httpStatus(418)).toMatchObject({ code: 418, name: "Fehler" });
    expect(httpStatus(507)).toMatchObject({ code: 507, name: "Serverfehler" });
  });
});
