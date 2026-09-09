#!/usr/bin/env node
/**
 * Tageszusammenfassung der Missbrauchs-Abwehr (Issue #17).
 *
 * Holt eine Momentaufnahme von `/api/admin/usage` und gibt sie lesbar auf
 * stdout aus. Bewusst kein eigener Mail-Versand: als Cron-Job mit `MAILTO=`
 * in der Crontab landet die Ausgabe automatisch im Postfach, alternativ per
 * `>> logfile.log` in eine Datei umleiten — beides ohne eine einzige Zeile
 * SMTP-Code in diesem Projekt.
 *
 * Aufruf:
 *   ADMIN_TOKEN=... node scripts/daily-summary.mjs
 *   ADMIN_TOKEN=... BASE_URL=https://dev.rothenburg.digital node scripts/daily-summary.mjs
 *
 * Crontab-Beispiel (einmal täglich kurz vor Mitternacht):
 *   MAILTO=admin@example.com
 *   50 23 * * * ADMIN_TOKEN=... BASE_URL=https://dev.rothenburg.digital node /pfad/zu/scripts/daily-summary.mjs
 */

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

if (!ADMIN_TOKEN) {
  console.error("ADMIN_TOKEN fehlt — siehe Kopfkommentar dieses Skripts.");
  process.exit(1);
}

const response = await fetch(`${BASE_URL}/api/admin/usage`, {
  headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
});

if (!response.ok) {
  console.error(
    `Abruf fehlgeschlagen: HTTP ${response.status} ${await response.text()}`,
  );
  process.exit(1);
}

const s = await response.json();

const nfEur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 4,
});
const nfInt = new Intl.NumberFormat("de-DE");
const nfPercent = new Intl.NumberFormat("de-DE", {
  style: "percent",
  maximumFractionDigits: 1,
});

console.log(`Tageszusammenfassung Rothenburg Digital — ${s.day}`);
console.log("-".repeat(50));
console.log(
  `Token heute:       ${nfInt.format(s.tokensToday)} von ${nfInt.format(s.budget)} (${s.budgetPercent}%)`,
);
if (s.costEurToday !== undefined) {
  console.log(`Geschätzte Kosten:  ${nfEur.format(s.costEurToday)}`);
}
console.log(`Angefragte Adressen: ${nfInt.format(s.trackedKeys)}`);
console.log(`Geprüfte Fragen:    ${nfInt.format(s.screenedToday)}`);
console.log(
  `Abgelehnt:          ${nfInt.format(s.blockedToday)} (${nfPercent.format(s.blockRate)})`,
);

if (s.topBlockedRules.length > 0) {
  console.log("Häufigste Regeln:");
  for (const { rule, count } of s.topBlockedRules) {
    console.log(`  - ${rule}: ${nfInt.format(count)}`);
  }
}

if (s.budgetPercent >= 80) {
  console.log("");
  console.log(
    `⚠️  Tagesbudget zu ${s.budgetPercent}% ausgeschöpft — docs/SICHERHEIT-PROMPTS.md, „Was tun, wenn die Blockrate springt".`,
  );
}
