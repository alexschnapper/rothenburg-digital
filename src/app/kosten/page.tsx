import type { Metadata } from "next";
import Link from "next/link";

import ChatOffNotice from "@/components/ChatOffNotice";
import ExternalLink from "@/components/ExternalLink";
import PageShell, { SIDE_BY_SIDE } from "@/components/PageShell";
import { guard } from "@/lib/guard/config";
import { chatEnabled } from "@/lib/landing";
import { costEur } from "@/lib/llm/pricing";
import { LlmConfigError, llmConfig } from "@/lib/llm/provider";
import { usageSummary, type UsageTotals } from "@/lib/usage/history";
import {
  MISTRAL_INCLUDED_MONTHLY_EUR,
  MISTRAL_INVOICES,
  MISTRAL_MONTHLY_LIMIT_EUR,
} from "@/lib/usage/invoices";

export const metadata: Metadata = {
  title: "Kosten – Rothenburg Digital",
  description:
    "Was der KI-Chat von Rothenburg Digital an Token verbraucht und ungefähr kostet.",
};

// Zahlen ändern sich mit jeder Chat-Anfrage.
export const dynamic = "force-dynamic";

const eur = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    // Kleine Beträge sonst als „0,00 €" — Cent-Bruchteile sind hier die Regel.
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
  }).format(value);
/** Ganze Cent, für Obergrenzen — dort wäre „0,414 €" Scheingenauigkeit. */
const eurCents = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
const int = (value: number) => new Intl.NumberFormat("de-DE").format(value);
const usd = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "USD" }).format(value);

/** `2026-11-04` → `Mi 4.11.` */
function shortDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return date.toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

/** `2026-11` → `November 2026` */
function monthName(key: string): string {
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
}

function StatTile({ label, totals }: { label: string; totals: UsageTotals }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-4 py-3">
      <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p className="text-xl font-extrabold tabular-nums sm:text-2xl">
        {eur(totals.costEur)}
      </p>
      <p className="text-xs tabular-nums text-muted">
        {int(totals.requests)} Anfragen · {int(totals.tokens)} Token
      </p>
    </div>
  );
}

function modelInfo() {
  try {
    const llm = llmConfig();
    return { label: llm.label, modelId: llm.modelId, price: llm.price, usdToEur: llm.usdToEur };
  } catch (error) {
    if (!(error instanceof LlmConfigError)) throw error;
    return null;
  }
}

export default function KostenPage() {
  const summary = usageSummary();
  const model = modelInfo();
  const maxDaily = Math.max(...summary.daily.map((day) => day.costEur), 0);
  const since = summary.since
    ? new Date(`${summary.since}T12:00:00Z`).toLocaleDateString("de-DE")
    : null;

  // Monate aus Zählung und Rechnungen zusammenführen — Rechnungen können
  // Monate vor Beginn der Zählung betreffen.
  const invoiceByMonth = new Map(MISTRAL_INVOICES.map((invoice) => [invoice.month, invoice]));
  const usageByMonth = new Map(summary.monthly.map((month) => [month.month, month]));
  const months = [...new Set([...usageByMonth.keys(), ...invoiceByMonth.keys()])].sort(
    (a, b) => b.localeCompare(a),
  );
  const invoiceTotal = MISTRAL_INVOICES.reduce((acc, invoice) => acc + invoice.amountEur, 0);
  const firstInvoice = [...invoiceByMonth.keys()].sort()[0];

  // Obergrenze pro Tag: das ganze Tagesbudget zum teureren Ausgabepreis.
  const maxPerDay =
    guard.dailyTokenBudget > 0 && model?.price
      ? costEur({ inputTokens: 0, outputTokens: guard.dailyTokenBudget }, model.price)
      : undefined;

  return (
    <PageShell
      title="Was kostet der Chat?"
      intro={
        <>
          Rothenburg Digital wird privat finanziert. Jede Antwort im Chat kostet
          Geld, weil ein KI-Anbieter sie nach verbrauchten Token abrechnet. Diese
          Seite zeigt offen, wie viel das ist.
        </>
      }
    >
      {!chatEnabled() && (
        <ChatOffNotice>
          In dieser Umgebung fallen deshalb keine neuen KI-Kosten an. Unten steht,
          was bis zum Abschalten verbraucht wurde.
        </ChatOffNotice>
      )}
      <section aria-labelledby="ueberblick-heading" className="flex flex-col gap-3">
        <h2 id="ueberblick-heading" className="text-lg font-bold">
          Überblick
        </h2>
        {summary.since ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <StatTile label="Heute" totals={summary.today} />
            <StatTile label="Letzte 7 Tage" totals={summary.last7Days} />
            <StatTile label="Dieser Monat" totals={summary.thisMonth} />
            <StatTile label={`Gesamt seit ${since}`} totals={summary.total} />
          </div>
        ) : (
          <p role="status" className="max-w-3xl text-sm">
            Noch keine Daten – die Zählung beginnt mit der ersten
            Chat-Anfrage.
          </p>
        )}
      </section>

      {/* Ab Desktop Tage und Monate nebeneinander (#94). */}
      <div className={SIDE_BY_SIDE}>
        {summary.since && (
          <section aria-labelledby="tage-heading" className="flex flex-col gap-3">
            <h2 id="tage-heading" className="text-lg font-bold">
              Die letzten 30 Tage
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">
                  Anfragen, Token und geschätzte Kosten pro Tag, neuester Tag
                  zuerst
                </caption>
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left">
                    <th scope="col" className="py-1 pr-3 font-semibold">Tag</th>
                    <th scope="col" className="w-full py-1 pr-3 font-semibold">
                      <span className="sr-only">Kosten als Balken</span>
                    </th>
                    <th scope="col" className="py-1 pr-3 text-right font-semibold">Anfragen</th>
                    <th scope="col" className="py-1 pr-3 text-right font-semibold">Token</th>
                    <th scope="col" className="py-1 text-right font-semibold">Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {[...summary.daily].reverse().map((day) => (
                    <tr
                      key={day.day}
                      className="border-b border-[color:var(--color-border)] last:border-0"
                    >
                      <th scope="row" className="whitespace-nowrap py-1 pr-3 text-left font-normal">
                        {shortDay(day.day)}
                      </th>
                      <td className="py-1 pr-3" aria-hidden="true">
                        {day.costEur > 0 && (
                          <div
                            className="h-2.5 min-w-1 rounded-r bg-[color:var(--color-focus)]"
                            style={{ width: `${(day.costEur / maxDaily) * 100}%` }}
                          />
                        )}
                      </td>
                      <td className="py-1 pr-3 text-right">{int(day.requests)}</td>
                      <td className="py-1 pr-3 text-right">{int(day.tokens)}</td>
                      <td className="whitespace-nowrap py-1 text-right">{eur(day.costEur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {months.length > 0 && (
          <section aria-labelledby="monate-heading" className="flex flex-col gap-3">
            <h2 id="monate-heading" className="text-lg font-bold">
              Nach Monat
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left">
                    <th scope="col" className="py-1 pr-3 font-semibold">Monat</th>
                    <th scope="col" className="py-1 pr-3 text-right font-semibold">Anfragen</th>
                    <th scope="col" className="py-1 pr-3 text-right font-semibold">Token</th>
                    <th scope="col" className="py-1 pr-3 text-right font-semibold">Geschätzt</th>
                    <th scope="col" className="py-1 text-right font-semibold">Rechnung</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((key) => {
                    const usage = usageByMonth.get(key);
                    const invoice = invoiceByMonth.get(key);
                    return (
                      <tr
                        key={key}
                        className="border-b border-[color:var(--color-border)] last:border-0"
                      >
                        <th scope="row" className="py-1 pr-3 text-left font-normal">
                          {monthName(key)}
                          {invoice?.note && (
                            <span className="block text-xs text-muted">{invoice.note}</span>
                          )}
                        </th>
                        <td className="py-1 pr-3 text-right">{usage ? int(usage.requests) : "–"}</td>
                        <td className="py-1 pr-3 text-right">{usage ? int(usage.tokens) : "–"}</td>
                        <td className="py-1 pr-3 text-right">{usage ? eur(usage.costEur) : "–"}</td>
                        <td className="py-1 text-right font-semibold">
                          {invoice ? eur(invoice.amountEur) : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <section
        aria-labelledby="bezahlt-heading"
        className="flex max-w-3xl flex-col gap-2 rounded-lg border border-[color:var(--color-border)] border-l-4 border-l-brand bg-[color:var(--color-muted)] px-4 py-3 text-sm"
      >
        <h2 id="bezahlt-heading" className="text-base font-bold">
          Tatsächlich bezahlt
        </h2>
        {MISTRAL_INVOICES.length > 0 ? (
          <p>
            Laut Rechnungen von Mistral AI seit {monthName(firstInvoice)}:{" "}
            <strong className="tabular-nums">{eur(invoiceTotal)}</strong>. Die
            Rechnung gilt für alle Umgebungen zusammen, also auch für Tests
            während der Entwicklung – sie kann deshalb höher sein als die
            Schätzung oben.
          </p>
        ) : MISTRAL_INCLUDED_MONTHLY_EUR !== null ? (
          <p>
            Bisher ist keine Rechnung angefallen: Der Tarif bei Mistral AI
            enthält ein Kontingent von{" "}
            <strong className="tabular-nums">
              {eurCents(MISTRAL_INCLUDED_MONTHLY_EUR)} pro Monat
            </strong>{" "}
            für die API-Nutzung, und der Verbrauch aller Umgebungen ist bisher
            darunter geblieben.
          </p>
        ) : (
          <p>
            Noch keine Rechnungsbeträge eingetragen. Sie werden einmal im Monat
            aus der Abrechnung von Mistral AI übernommen, weil der Anbieter sie
            nicht automatisch abrufbar macht.
          </p>
        )}
        {MISTRAL_INVOICES.length > 0 && MISTRAL_INCLUDED_MONTHLY_EUR !== null && (
          <p>
            Im Tarif ist ein Kontingent von{" "}
            {eurCents(MISTRAL_INCLUDED_MONTHLY_EUR)} pro Monat enthalten.
            Berechnet wird nur, was darüber hinausgeht.
          </p>
        )}
      </section>

      <section
        aria-labelledby="grenzen-heading"
        className="flex max-w-3xl flex-col gap-2 rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm"
      >
        <h2 id="grenzen-heading" className="text-base font-bold">
          Grenzen: Die Kosten sind gedeckelt
        </h2>
        <ul className="list-inside list-disc">
          {guard.dailyTokenBudget > 0 && (
            <li>
              Tagesbudget: höchstens {int(guard.dailyTokenBudget)} Token pro Tag
              für alle zusammen
              {maxPerDay !== undefined &&
                `, also höchstens rund ${eurCents(maxPerDay)} pro Tag und ${eurCents(maxPerDay * 31)} im Monat`}
              . Ist es aufgebraucht, pausiert der Chat bis zum nächsten Tag.
              Heute verbraucht: {int(summary.today.tokens)} Token (
              {Math.round((summary.today.tokens / guard.dailyTokenBudget) * 100)} %).
            </li>
          )}
          {guard.maxRequestsPerDay > 0 && (
            <li>
              Pro Internetanschluss (IP-Adresse) höchstens{" "}
              {int(guard.maxRequestsPerDay)} Fragen am Tag.
            </li>
          )}
          <li>Jede Antwort ist auf {int(guard.maxOutputTokens)} Token begrenzt.</li>
          {MISTRAL_MONTHLY_LIMIT_EUR !== null && (
            <li>
              Zusätzlich ist bei Mistral AI ein Ausgabenlimit von{" "}
              {eurCents(MISTRAL_MONTHLY_LIMIT_EUR)} pro Monat gesetzt. Das greift
              auch, falls in der App etwas schiefgeht.
            </li>
          )}
        </ul>
        {maxPerDay !== undefined && (
          <p className="text-muted">
            Die Obergrenze rechnet alle Token zum teureren Preis für
            Ausgabe-Token. Tatsächlich ist der Großteil Eingabe, die echten
            Kosten liegen deutlich darunter.
          </p>
        )}
      </section>

      <section
        aria-labelledby="rechnung-heading"
        className="flex max-w-3xl flex-col gap-2 rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm"
      >
        <h2 id="rechnung-heading" className="text-base font-bold">
          So wird gerechnet
        </h2>
        {model?.price ? (
          <p>
            Anbieter: {model.label}, Modell <code>{model.modelId}</code>.
            Listenpreis: {usd(model.price.inputUsdPerMTok)} pro 1 Million
            Eingabe-Token und {usd(model.price.outputUsdPerMTok)} pro 1 Million
            Ausgabe-Token, umgerechnet mit 1 US-Dollar ={" "}
            {model.usdToEur.toLocaleString("de-DE")} Euro.
          </p>
        ) : (
          <p>Für das aktive Modell ist kein Preis hinterlegt.</p>
        )}
        <p>
          Ein Token ist ungefähr ein Wortteil. Eingabe-Token sind die Frage
          samt Anweisungen und Hintergrunddaten für den Assistenten,
          Ausgabe-Token die Antwort. Eine typische Frage kostet deshalb nur
          Bruchteile eines Cents.
        </p>
        <p>
          Die Beträge sind eine <strong>Schätzung zum Listenpreis</strong>,
          keine Rechnung. Verbindlich ist die Abrechnung des Anbieters.
        </p>
      </section>

      <section
        aria-labelledby="nicht-heading"
        className="flex max-w-3xl flex-col gap-2 rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm"
      >
        <h2 id="nicht-heading" className="text-base font-bold">
          Was hier nicht enthalten ist
        </h2>
        <ul className="list-inside list-disc">
          <li>
            Server, Domain und weitere Betriebskosten – nur die Kosten des
            KI-Anbieters.
          </li>
          <li>
            Testanfragen auf den Entwicklungs- und Vorschau-Umgebungen. Die
            Seite zeigt nur den Verbrauch der Umgebung, auf der Sie sie gerade
            aufrufen.
          </li>
        </ul>
        <p>
          Es werden nur Tagessummen gespeichert, keine einzelnen Fragen und
          nichts, was sich einer Person zuordnen lässt. Mehr dazu unter{" "}
          <Link href="/datenschutz" className="underline">
            Datenschutz
          </Link>
          . Preise des Anbieters:{" "}
          <ExternalLink href="https://mistral.ai/pricing/api">mistral.ai/pricing</ExternalLink>
          .
        </p>
      </section>
    </PageShell>
  );
}
