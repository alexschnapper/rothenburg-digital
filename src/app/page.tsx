import Chat from "@/components/Chat";
import { flags } from "@/lib/flags";

export default function HomePage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Rothenburg Digital
        </h1>
        <p className="mt-2 text-lg opacity-80">
          Barrierefreies Chat-Portal – Fragen Sie, was Sie über die Stadt
          wissen möchten.
        </p>
      </header>

      <Chat />

      <footer className="mt-auto border-t border-[color:var(--color-border)] pt-4 text-sm opacity-70">
        <p>
          Aktive Module:{" "}
          {Object.entries(flags)
            .filter(([, enabled]) => enabled)
            .map(([name]) => name)
            .join(", ") || "nur Basis-Chat"}
        </p>
      </footer>
    </main>
  );
}
