/**
 * Feature-Flag-System über Umgebungsvariablen.
 *
 * Alle Flags haben NEXT_PUBLIC_-Präfix, damit sie im Client-Bundle verfügbar
 * sind. Werte werden zur Build-Zeit eingebettet — Änderungen erfordern einen
 * Neubuild.
 *
 * Default: false (unfertige Tools sind auf Prod ausgeschaltet).
 */

const isTruthy = (value: string | undefined): boolean =>
  value === "1" || value?.toLowerCase() === "true";

export const flags = {
  sensorCommunity: isTruthy(process.env.NEXT_PUBLIC_FEATURE_SENSOR_COMMUNITY),
  rtsShowcase: isTruthy(process.env.NEXT_PUBLIC_FEATURE_RTS_SHOWCASE),
} as const;

export type FeatureFlag = keyof typeof flags;

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag];
}
