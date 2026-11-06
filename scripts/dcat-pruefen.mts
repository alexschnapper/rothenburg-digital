/**
 * DCAT-AP-Katalog gegen den offiziellen Validator der EU prüfen (Issue #107).
 *
 * Baut den Katalog lokal mit `toCatalog()` aus den aktuellen Daten der Stadt
 * und schickt ihn an die REST-Schnittstelle des ITB-Validators, Profile für
 * DCAT-AP 3.0.1. Der Inhalt geht als BASE64 mit, denn Adressen lädt die
 * Schnittstelle nicht selbst („externally-provided URIs are disabled“).
 *
 * Aufruf: `npm run dcat:pruefen`. Ohne Secrets, ohne Modellkosten.
 *
 * Das Ergebnis steht in `reports/dcat-ap.json`. Die Datei ändert sich nur,
 * wenn sich der Status oder die Verstöße ändern; Warnungen allein zählen
 * nicht als Änderung. So meldet der Workflow nur, was gegenüber der Vorwoche
 * neu ist: „neu mit Verstößen“ oder „wieder in Ordnung“.
 *
 * Exit-Code:
 *   0  Base und Ranges ohne Verstöße (Empfehlungen aus „Full“ zählen nicht)
 *   1  Verstöße in Base oder Ranges
 *   2  Prüfung nicht möglich: Validator oder Daten der Stadt nicht erreichbar.
 *      Die Ergebnisdatei bleibt dann unverändert.
 *
 * Umgebungsvariablen (nur für den Workflow `.github/workflows/datenqualitaet.yml`):
 *   DCAT_DATEI      schreibt das Ergebnis als Markdown in diese Datei
 *   GITHUB_OUTPUT   setzt `dcat` auf `ok`, `verstoesse` oder `nicht-pruefbar`
 *                   und `dcat_changed` auf `true` oder `false`
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { germanDate } from "@/lib/opendata/common";
import { FEED_NAMES, loadCatalogFeeds, toCatalog } from "@/lib/opendata/feeds";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resultPath = join(root, "reports/dcat-ap.json");

const VALIDATOR = "https://www.itb.ec.europa.eu/shacl/dcat-ap/api/validate";
const TIMEOUT_MS = 60_000;

type Profile = { id: string; label: string; required: boolean };

const PROFILES: Profile[] = [
  { id: "dcatap.3_0_1_base", label: "Base (Pflichtangaben)", required: true },
  { id: "dcatap.3_0_1_range", label: "Ranges (Typen)", required: true },
  { id: "dcatap.3_0_1_codelists", label: "Controlled Vocabularies (EU-Listen)", required: false },
  { id: "dcatap.3_0_1_full", label: "Full (mit Empfehlungen)", required: false },
];

type Result = {
  "@type"?: string;
  "sh:resultSeverity"?: { "@id": string };
  "sh:resultPath"?: { "@id": string } | string;
  "sh:resultMessage"?: string;
  "sh:focusNode"?: { "@id": string };
};

type Finding = { severity: string; path: string; message: string; count: number };

const pathOf = (result: Result) => {
  const path = result["sh:resultPath"];
  return typeof path === "string" ? path : (path?.["@id"] ?? "–");
};

/** Alle Adressen (`@id`) im Katalog, auch verschachtelte. */
function idsIn(value: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) idsIn(item, ids);
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "@id" && typeof item === "string") ids.add(item);
      else idsIn(item, ids);
    }
  }
  return ids;
}

/**
 * Meldungen, die nicht unseren Katalog betreffen, sondern Daten, die der
 * Validator selbst mitlädt:
 * - Adressen, die im Katalog nicht vorkommen, etwa die ADMS-Listen unter
 *   `purl.org/adms/…` (im Profil „Full“).
 * - Fünf namenlose Knoten ohne `foaf:name`, auch bei einem leeren Katalog.
 *   Unser Herausgeber hat eine eigene Adresse (`publisher` in `feeds.ts`),
 *   kann also nicht gemeint sein.
 * Namenlose Knoten aus unserem Katalog (Gebiet, Namensnennung, Kontakt)
 * bleiben drin: Ihre Meldungen haben einen anderen Pfad.
 */
const isValidatorNoise = (result: Result, ids: Set<string>) => {
  const focus = result["sh:focusNode"]?.["@id"] ?? "";
  if (focus.startsWith("_:")) return pathOf(result) === "foaf:name";
  return !ids.has(focus);
};

const SEVERITY: Record<string, string> = {
  "sh:Violation": "Verstoß",
  "sh:Warning": "Warnung",
  "sh:Info": "Hinweis",
};

async function validate(content: string, ids: Set<string>, profile: Profile): Promise<Finding[]> {
  const response = await fetch(VALIDATOR, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/ld+json" },
    body: JSON.stringify({
      contentToValidate: Buffer.from(content).toString("base64"),
      embeddingMethod: "BASE64",
      contentSyntax: "application/ld+json",
      validationType: profile.id,
      reportSyntax: "application/ld+json",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Validator antwortet mit HTTP ${response.status}`);

  const report = (await response.json()) as { "@graph"?: Result[] };
  const counts = new Map<string, Finding>();
  for (const result of report["@graph"] ?? []) {
    if (result["@type"] !== "sh:ValidationResult" || isValidatorNoise(result, ids)) continue;
    const severity = SEVERITY[result["sh:resultSeverity"]?.["@id"] ?? ""] ?? "Hinweis";
    const path = pathOf(result);
    const message = result["sh:resultMessage"] ?? "";
    const key = `${severity}|${path}|${message}`;
    const finding = counts.get(key) ?? { severity, path, message, count: 0 };
    finding.count += 1;
    counts.set(key, finding);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

const violations = (findings: Finding[]) =>
  findings.filter((finding) => finding.severity === "Verstoß").reduce((sum, finding) => sum + finding.count, 0);

type Status = "ok" | "verstoesse" | "nicht-pruefbar";

/** Inhalt von `reports/dcat-ap.json`. */
type StoredResult = {
  geprueft: string;
  status: Exclude<Status, "nicht-pruefbar">;
  profile: { id: string; label: string; verstoesse: number; befunde: Finding[] }[];
};

/** Was als Änderung zählt: Status und Verstöße, nicht die Warnungen. */
const fingerprint = (result: StoredResult) =>
  JSON.stringify({
    status: result.status,
    verstoesse: result.profile.map((profile) => [
      profile.id,
      profile.befunde.filter((finding) => finding.severity === "Verstoß"),
    ]),
  });

const STATUS_TEXT: Record<StoredResult["status"], string> = {
  ok: "besteht",
  verstoesse: "mit Verstößen",
};

function finish(status: Status, markdown: string, code: number, changed = false): never {
  console.log(markdown);
  if (process.env.DCAT_DATEI) writeFileSync(process.env.DCAT_DATEI, `${markdown}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `dcat=${status}\ndcat_changed=${changed}\n`);
  }
  process.exit(code);
}

const previous: StoredResult | null = existsSync(resultPath)
  ? JSON.parse(readFileSync(resultPath, "utf8"))
  : null;

const feeds = await loadCatalogFeeds();
const missing = FEED_NAMES.filter((name) => !feeds[name]);
// Ohne die Daten fehlen Lizenz und Quellen im Katalog; die Prüfung wäre dann
// zu milde und sagte nichts über den Katalog auf der Seite.
if (missing.length > 0) {
  finish("nicht-pruefbar", `## DCAT-AP-Prüfung\n\nNicht prüfbar: Daten der Stadt für ${missing.join(", ")} gerade nicht abrufbar.`, 2);
}

const catalog = toCatalog(feeds, "https://rothenburg.digital");
const content = JSON.stringify(catalog);
const ids = idsIn(catalog);
const lines: string[] = [];
const stored: StoredResult["profile"] = [];
let failed = false;

for (const profile of PROFILES) {
  let findings: Finding[];
  try {
    findings = await validate(content, ids, profile);
  } catch (error) {
    finish("nicht-pruefbar", `## DCAT-AP-Prüfung\n\nNicht prüfbar: ${(error as Error).message} (${profile.id}).`, 2);
  }
  const count = violations(findings);
  if (profile.required && count > 0) failed = true;
  stored.push({ id: profile.id, label: profile.label, verstoesse: count, befunde: findings });

  const verdict = count === 0 ? "✓ besteht" : `✖ ${count} Verstöße`;
  const notes = findings.length - findings.filter((finding) => finding.severity === "Verstoß").length;
  lines.push(`### ${profile.label}: ${verdict}${notes > 0 ? `, ${notes} Arten von Hinweisen` : ""}`, "");
  for (const finding of findings) {
    lines.push(`- ${finding.severity} (${finding.count}×) \`${finding.path}\`: ${finding.message}`);
  }
  if (findings.length > 0) lines.push("");
}

const result: StoredResult = {
  geprueft: new Date().toISOString().slice(0, 10),
  status: failed ? "verstoesse" : "ok",
  profile: stored,
};
const changed = !previous || fingerprint(previous) !== fingerprint(result);
if (changed) writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);

const head = [
  "## DCAT-AP-Prüfung",
  "",
  "Katalog `/daten/katalog.jsonld` gegen den EU-Validator, DCAT-AP 3.0.1.",
  "",
  !previous
    ? `Erste Prüfung: ${STATUS_TEXT[result.status]}.`
    : changed
      ? `Geändert gegenüber der Prüfung vom ${germanDate(previous.geprueft)}: vorher ${STATUS_TEXT[previous.status]}, jetzt ${STATUS_TEXT[result.status]}.`
      : `Unverändert seit der Prüfung vom ${germanDate(previous.geprueft)}.`,
  "",
];
finish(result.status, [...head, ...lines].join("\n").trimEnd(), failed ? 1 : 0, changed);
