/**
 * Entfernt interne Prompt-Marker aus Modellantworten (Issue #34).
 *
 * `<fremdquelle …>` (`external.ts`) und `<buergerfrage …>` (`prompt.ts`) sind
 * reine Auszeichnung für das Modell. Gibt es sie trotzdem aus — oder erfindet
 * es sie, wie bei einer halluzinierten Wetterprognose geschehen —, zeigt
 * `react-markdown` sie ohne rehype-raw als wörtlichen Text an. Der Inhalt
 * zwischen den Markern bleibt stehen, nur die Tags selbst fallen weg: der
 * System-Prompt verbietet die Ausgabe ohnehin, das hier ist die Absicherung
 * dahinter.
 *
 * Läuft im Browser (Chat.tsx) und vor dem Speichern in der Sitzung
 * (`/api/chat`), damit ein ausgegebener Marker nicht als vermeintlich echte
 * Fremdquelle in den nächsten Modellkontext zurückwandert.
 */
const INTERNAL_MARKER = /<\/?(fremdquelle|buergerfrage)\b[^>]*>/gi;

export function stripInternalMarkers(text: string): string {
  return text.replace(INTERNAL_MARKER, "");
}
