import { expect, test, type Page } from "@playwright/test";

/**
 * `/api/chat` wird für jeden Test gemockt (`page.route`) — kein echter
 * Modellaufruf, kein API-Key nötig. Format exakt wie
 * `result.toUIMessageStreamResponse()` es liefert (AI SDK v5,
 * `src/app/api/chat/route.ts`): SSE-Zeilen mit `data: {...}`, abgeschlossen
 * durch `data: [DONE]`. Header aus `UI_MESSAGE_STREAM_HEADERS` im `ai`-Paket.
 */
function sseBody(markdown: string): string {
  const events = [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "0" },
    { type: "text-delta", id: "0", delta: markdown },
    { type: "text-end", id: "0" },
    { type: "finish-step" },
    {
      type: "finish",
      finishReason: "stop",
      messageMetadata: {
        inputTokens: 123,
        outputTokens: 45,
        model: "mistral-large-latest",
        costEur: 0.0012,
        price: { inputUsdPerMTok: 0.5, outputUsdPerMTok: 1.5, usdToEur: 0.92 },
      },
    },
  ];
  return (
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") +
    "data: [DONE]\n\n"
  );
}

async function mockChatReply(page: Page, markdown: string): Promise<void> {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: sseBody(markdown),
    });
  });
}

test.describe("Chat", () => {
  test("rendert Markdown und wendet die Link-Allowlist an (#15)", async ({
    page,
  }) => {
    await mockChatReply(
      page,
      "Das **Café Einhorn** ist beliebt.\n\n" +
        "1. Adresse: Marktplatz\n" +
        "2. [Tourismus-Seite](https://www.rothenburg-tourismus.de)\n" +
        "3. [Fremde Seite](https://angreifer.example)",
    );

    await page.goto("/");
    await page.getByRole("textbox", { name: "Ihre Nachricht" }).fill(
      "Was ist ein beliebtes Café?",
    );
    await page.getByRole("button", { name: "Senden" }).click();

    const reply = page.getByRole("article", { name: "Antwort des Assistenten" });
    await expect(reply).toBeVisible();

    // Markdown-Formatierung
    await expect(reply.locator("strong", { hasText: "Café Einhorn" })).toBeVisible();
    await expect(reply.locator("li")).toHaveCount(3);

    // Allowlist-Domain wird zum echten, sicheren Link (Issue #15)
    const allowedLink = reply.getByRole("link", { name: "Tourismus-Seite" });
    await expect(allowedLink).toHaveAttribute(
      "href",
      "https://www.rothenburg-tourismus.de/",
    );
    await expect(allowedLink).toHaveAttribute("target", "_blank");
    await expect(allowedLink).toHaveAttribute("rel", "noopener noreferrer");

    // Fremde Domain wird nur als Text dargestellt, nicht als Link
    await expect(
      reply.getByRole("link", { name: "Fremde Seite" }),
    ).toHaveCount(0);
    await expect(reply.getByText("Fremde Seite")).toBeVisible();
  });

  test("unterdrückt eingebettete Bilder aus der Antwort (#15)", async ({
    page,
  }) => {
    await mockChatReply(
      page,
      "Schau mal: ![Alt-Text eines Bildes](https://angreifer.example/pixel.png)",
    );

    await page.goto("/");
    await page.getByRole("textbox", { name: "Ihre Nachricht" }).fill("Zeig mir was.");
    await page.getByRole("button", { name: "Senden" }).click();

    const reply = page.getByRole("article", { name: "Antwort des Assistenten" });
    await expect(reply).toContainText("Alt-Text eines Bildes");
    await expect(reply.locator("img")).toHaveCount(0);
  });

  test("Eingabefeld und Senden-Button sind während des Ladens deaktiviert", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      // Bewusst verzögert, um den Ladezustand beobachten zu können.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sseBody("Kurze Antwort."),
      });
    });

    await page.goto("/");
    const textarea = page.getByRole("textbox", { name: "Ihre Nachricht" });
    await textarea.fill("Wann hat das Bürgerbüro geöffnet?");
    await page.getByRole("button", { name: "Senden" }).click();

    await expect(page.getByRole("status")).toHaveText("Antwort wird geschrieben…");
    await expect(textarea).toBeDisabled();

    await expect(
      page.getByRole("article", { name: "Antwort des Assistenten" }),
    ).toContainText("Kurze Antwort.");
    await expect(textarea).toBeEnabled();
  });
});
