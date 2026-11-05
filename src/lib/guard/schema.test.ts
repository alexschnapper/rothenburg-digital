import { describe, expect, it } from "vitest";

import { chatRequestSchema } from "@/lib/guard/schema";

const messages = [{ id: "1", role: "user", parts: [{ type: "text", text: "Hallo" }] }];

describe("chatRequestSchema: Umschalter „Einfache Sprache“ (#2)", () => {
  it("nimmt true, false oder kein Feld an", () => {
    expect(chatRequestSchema.safeParse({ messages, simpleLanguage: true }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages, simpleLanguage: false }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages }).success).toBe(true);
  });

  it.each([["true"], [1], [{ an: true }], [null]])("lehnt %j ab", (value) => {
    expect(chatRequestSchema.safeParse({ messages, simpleLanguage: value }).success).toBe(false);
  });
});
