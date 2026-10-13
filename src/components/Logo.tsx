import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Meridian home">
      <svg viewBox="0 0 36 24" className="brand-mark" aria-hidden="true">
        <path d="M2 16c4-9 8 8 13 0s7-8 12-3 5 4 7 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="2.2" cy="16" r="1.7" fill="currentColor" />
        <circle cx="33.6" cy="15" r="1.7" fill="currentColor" />
      </svg>
      {compact ? null : <span>Meridian</span>}
    </Link>
  );
}
