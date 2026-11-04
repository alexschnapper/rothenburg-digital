/** Externer Link, der in neuem Tab öffnet — mit Hinweis für Screenreader. */
export default function ExternalLink({
  href,
  children,
  className = "underline",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (öffnet in neuem Tab)</span>
    </a>
  );
}
