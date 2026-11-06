/**
 * Hinweis auf Seiten rund um den Chat, wenn er in dieser Umgebung abgeschaltet
 * ist (#109, `chatEnabled()` in `src/lib/landing.ts`). Die Seiten bleiben
 * erreichbar, etwa über alte Links, und sagen ehrlich, dass gerade nichts
 * verarbeitet wird.
 */
export default function ChatOffNotice({ children }: { children?: React.ReactNode }) {
  return (
    <p
      role="note"
      className="max-w-3xl rounded-lg border-2 border-[color:var(--color-border-strong)] bg-[color:var(--color-muted)] p-3 text-sm"
    >
      <span className="font-bold">Der Chat ist in dieser Umgebung abgeschaltet.</span>{" "}
      {children}
    </p>
  );
}
