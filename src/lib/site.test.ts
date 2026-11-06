import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { ABOUT, INITIATIVE, INTRO, ROLE_DISCLAIMER, RTS, TAGLINE } from "@/lib/site";

/**
 * Begriffs-Check (#115). Markdown und die statische Teaser-Seite können
 * `site.ts` nicht einbinden; hier fällt auf, wenn dort eine veraltete
 * Schreibweise steht. Im Code sollen die Namen nur aus `site.ts` kommen.
 *
 * Release-Notes unter `docs/releases/` bleiben, wie sie waren: Sie
 * beschreiben den Stand von damals.
 */

const ROOT = join(__dirname, "../..");

type Rule = { pattern: RegExp; hint: string };

/** Schreibweisen, die in Texten nicht mehr vorkommen sollen. */
const TEXT_RULES: Rule[] = [
  {
    // „OK Labs“ (die Bewegung allgemein) ist erlaubt
    pattern: /OK Lab(?!s)(?! Rothenburg \(in Gründung\))/g,
    hint: `immer „${INITIATIVE.name}“`,
  },
  {
    // erlaubt: „(RTS)“ hinter dem Namen, „RTS-Graph“, Feature-Flag „RTS-Showcase“
    // und die Konstante `RTS` als Code
    pattern: /(?<![(`])\bRTS\b(?!-Graph|-Showcase|\)|`)/g,
    hint: `„RTS“ nicht allein, sondern „${RTS.full}“`,
  },
  {
    pattern: /Rothenburg Tourismus Service(?! \(RTS\))/g,
    hint: `mit Abkürzung: „${RTS.full}“`,
  },
  {
    pattern: /Tourismus-Service|Tourismus Service Rothenburg|Rothenburger Tourismus/g,
    hint: `„${RTS.full}“`,
  },
];

/** Namen, die im Code nur aus `site.ts` kommen sollen. */
const CODE_LITERALS = [
  "OK Lab",
  "Rothenburg Tourismus Service",
  "Tourismus-Service",
  "Stadt Rothenburg ob der Tauber",
  "github.com/alexschnapper/rothenburg-digital",
];

function filesIn(dir: string, extensions: string[], skip: (path: string) => boolean = () => false): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter((path) => !skip(path));
}

/** Fundstellen als `datei:zeile „Treffer“ → Hinweis`. */
function findings(files: string[], match: (line: string) => string[]): string[] {
  return files.flatMap((file) =>
    readFileSync(join(ROOT, file), "utf8")
      .split("\n")
      .flatMap((line, index) => match(line).map((hit) => `${file}:${index + 1} ${hit}`)),
  );
}

describe("Begriffs-Check (#115)", () => {
  it("Texte nutzen die aktuellen Schreibweisen", () => {
    const files = [
      "README.md",
      ".env.example",
      "public/teaser.html",
      ...filesIn("docs", [".md"], (path) => path.startsWith(join("docs", "releases"))),
    ];
    const hits = findings(files, (line) =>
      TEXT_RULES.flatMap((rule) => [...line.matchAll(rule.pattern)].map((m) => `„${m[0]}“ → ${rule.hint}`)),
    );
    expect(hits).toEqual([]);
  });

  it("Code bezieht Namen und Adressen aus site.ts", () => {
    const files = filesIn("src", [".ts", ".tsx"], (path) => path.endsWith(".test.ts") || path.endsWith("site.ts"));
    const hits = findings(files, (line) =>
      CODE_LITERALS.filter((literal) => line.includes(literal)).map((literal) => `„${literal}“ → aus @/lib/site`),
    );
    expect(hits).toEqual([]);
  });
});

describe("Leitsatz und Kurzvorstellung", () => {
  // Der Teaser kann site.ts nicht einbinden; der Wortlaut muss trotzdem gleich sein.
  const teaser = readFileSync(join(ROOT, "public/teaser.html"), "utf8");

  it("Teaser zeigt denselben Leitsatz und dieselbe Kurzvorstellung wie die App", () => {
    expect(teaser).toContain(`<p class="claim">${TAGLINE}</p>`);
    expect(teaser).toContain(`<p class="lead">${INTRO}</p>`);
  });

  it("README nennt denselben Leitsatz", () => {
    expect(readFileSync(join(ROOT, "README.md"), "utf8")).toContain(TAGLINE);
  });
});

describe("Zentrale Angaben", () => {
  it("Rollenabgrenzung und Kurzbeschreibung nennen die vollen Namen", () => {
    expect(ROLE_DISCLAIMER).toBe(
      "Kein offizielles Angebot der Stadt Rothenburg ob der Tauber oder des Rothenburg Tourismus Service (RTS).",
    );
    expect(ABOUT).toContain("OK Lab Rothenburg (in Gründung)");
  });
});
