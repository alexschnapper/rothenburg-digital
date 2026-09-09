import { afterEach, describe, expect, it, vi } from "vitest";

import { chatEnabled, landingMode } from "@/lib/landing";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("landingMode", () => {
  it("ist standardmäßig 'chat' (Prod muss explizit abschalten, #24)", () => {
    vi.stubEnv("LANDING_PAGE", "");
    expect(landingMode()).toBe("chat");
  });

  it("wird 'teaser' bei LANDING_PAGE=teaser", () => {
    vi.stubEnv("LANDING_PAGE", "teaser");
    expect(landingMode()).toBe("teaser");
  });

  it("ist tolerant gegenüber Groß-/Kleinschreibung und Leerraum", () => {
    vi.stubEnv("LANDING_PAGE", "  Teaser  ");
    expect(landingMode()).toBe("teaser");
  });

  it("fällt bei unbekanntem Wert auf 'chat' zurück", () => {
    vi.stubEnv("LANDING_PAGE", "irgendwas");
    expect(landingMode()).toBe("chat");
  });
});

describe("chatEnabled", () => {
  it("folgt landingMode(), wenn CHAT_DISABLED nicht gesetzt ist", () => {
    vi.stubEnv("LANDING_PAGE", "teaser");
    vi.stubEnv("CHAT_DISABLED", "");
    expect(chatEnabled()).toBe(false);

    vi.stubEnv("LANDING_PAGE", "");
    expect(chatEnabled()).toBe(true);
  });

  it("CHAT_DISABLED=1 schaltet den Chat unabhängig vom Modus ab", () => {
    vi.stubEnv("LANDING_PAGE", "");
    vi.stubEnv("CHAT_DISABLED", "1");
    expect(chatEnabled()).toBe(false);
  });

  it("CHAT_DISABLED=0 schaltet den Chat trotz Teaser-Modus explizit an", () => {
    vi.stubEnv("LANDING_PAGE", "teaser");
    vi.stubEnv("CHAT_DISABLED", "0");
    expect(chatEnabled()).toBe(true);
  });
});
