import type { Severity, Traffic } from "@/lib/opendata/quality";

/**
 * Farbe nie allein (WCAG 1.4.1): Symbol und Wort tragen dieselbe Aussage.
 * Textfarben mit mindestens 7:1 Kontrast auf dem jeweiligen Grund (AAA).
 */
export const TRAFFIC: Record<Traffic, { icon: string; label: string; className: string }> = {
  rot: {
    icon: "✖",
    label: "Fehler",
    className: "border-red-700 text-red-800 dark:border-red-400 dark:text-red-200",
  },
  gelb: {
    icon: "!",
    label: "Warnung",
    className: "border-amber-700 text-amber-900 dark:border-amber-400 dark:text-amber-200",
  },
  gruen: {
    icon: "✓",
    label: "In Ordnung",
    className: "border-green-700 text-green-800 dark:border-green-400 dark:text-green-200",
  },
};

export const SEVERITY_MARK: Record<Severity, { icon: string; className: string }> = {
  fehler: {
    icon: "✖",
    className:
      "border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100",
  },
  warnung: {
    icon: "!",
    className:
      "border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100",
  },
  hinweis: {
    icon: "i",
    className:
      "border-sky-700 bg-sky-50 text-sky-900 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-100",
  },
};

export function StatusBadge({ status }: { status: Traffic }) {
  const { icon, label, className } = TRAFFIC[status];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border-2 px-3 py-0.5 text-xs font-bold ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
