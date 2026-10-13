const DEFAULT_ADMIN_EMAILS = ["sidaxy@gmail.com"];

function parseEmailList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails(): string[] {
  const configured = [
    ...parseEmailList(process.env.ADMIN_EMAILS),
    ...parseEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAILS),
  ];
  const merged = new Set([...DEFAULT_ADMIN_EMAILS, ...configured]);
  return Array.from(merged);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getAdminEmails().includes(normalized);
}
