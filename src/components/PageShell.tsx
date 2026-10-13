import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PageShell({ children, fill = false }: { children: React.ReactNode; fill?: boolean }) {
  const body = (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
  if (!fill) return body;
  return <div className="shell-fill">{body}</div>;
}
