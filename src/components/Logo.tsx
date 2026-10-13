import Link from "next/link";

export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#F8FAFC" strokeWidth="1.5" />
      <path d="M4.5 12.15C7.6 14.2 16.4 14.2 19.5 12.15" fill="none" stroke="#F8FAFC" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4.5C16.5 7.2 16.5 16.8 12 19.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Meridian home">
      <BrandMark />
      {compact ? null : <span>Meridian</span>}
    </Link>
  );
}
