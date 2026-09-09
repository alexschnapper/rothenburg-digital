import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendSessionTurn,
  loadSession,
  sessionCookieHeader,
  SESSION_COOKIE,
} from "@/lib/guard/session";

function reqWithCookie(cookie?: string): Request {
  return new Request("http://localhost/api/chat", {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

describe("loadSession", () => {
  it("beginnt ohne Cookie eine neue, leere Sitzung", () => {
    const session = loadSession(reqWithCookie());
    expect(session.turns).toEqual([]);
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("liefert eine unbekannte Sitzungs-ID als neue, leere Sitzung (#14)", () => {
    const session = loadSession(
      reqWithCookie(`${SESSION_COOKIE}=00000000-0000-0000-0000-000000000000`),
    );
    expect(session.turns).toEqual([]);
    // Neue ID, nicht die unbekannte aus dem Cookie — sonst würde eine
    // erratene ID eine fremde Sitzung "reservieren".
    expect(session.id).not.toBe("00000000-0000-0000-0000-000000000000");
  });

  it("findet eine zuvor angehängte Sitzung über das Cookie wieder", () => {
    const { id } = loadSession(reqWithCookie());
    appendSessionTurn(id, { role: "user", text: "Hallo" }, 20);
    appendSessionTurn(id, { role: "assistant", text: "Hallo zurück" }, 20);

    const reloaded = loadSession(reqWithCookie(`${SESSION_COOKIE}=${id}`));
    expect(reloaded.id).toBe(id);
    expect(reloaded.turns).toEqual([
      { role: "user", text: "Hallo" },
      { role: "assistant", text: "Hallo zurück" },
    ]);
  });

  it("liest das Cookie auch neben anderen Cookies heraus", () => {
    const { id } = loadSession(reqWithCookie());
    appendSessionTurn(id, { role: "user", text: "Test" }, 20);

    const reloaded = loadSession(
      reqWithCookie(`foo=bar; ${SESSION_COOKIE}=${id}; baz=qux`),
    );
    expect(reloaded.id).toBe(id);
    expect(reloaded.turns).toHaveLength(1);
  });
});

describe("appendSessionTurn", () => {
  it("kürzt auf die maximale Anzahl Nachrichten", () => {
    const { id } = loadSession(reqWithCookie());
    for (let i = 0; i < 5; i += 1) {
      appendSessionTurn(id, { role: "user", text: `Frage ${i}` }, 3);
    }
    const reloaded = loadSession(reqWithCookie(`${SESSION_COOKIE}=${id}`));
    expect(reloaded.turns).toHaveLength(3);
    expect(reloaded.turns.map((t) => t.text)).toEqual([
      "Frage 2",
      "Frage 3",
      "Frage 4",
    ]);
  });
});

describe("Sitzungs-TTL", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("läuft nach der TTL ab und liefert danach eine leere Sitzung", () => {
    const { id } = loadSession(reqWithCookie());
    appendSessionTurn(id, { role: "user", text: "Hallo" }, 20);

    vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 1000);

    const reloaded = loadSession(reqWithCookie(`${SESSION_COOKIE}=${id}`));
    expect(reloaded.turns).toEqual([]);
    expect(reloaded.id).not.toBe(id);
  });
});

describe("sessionCookieHeader", () => {
  it("setzt HttpOnly, SameSite=Strict und Path=/", () => {
    const header = sessionCookieHeader("abc123", false);
    expect(header).toContain(`${SESSION_COOKIE}=abc123`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain("Path=/");
    expect(header).not.toContain("Secure");
  });

  it("setzt Secure nur wenn verlangt", () => {
    expect(sessionCookieHeader("abc123", true)).toContain("Secure");
  });
});
