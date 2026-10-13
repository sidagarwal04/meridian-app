"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Logo } from "./Logo";
import { useI18n } from "@/lib/i18n";

export function SiteHeader({ showNav = true }: { showNav?: boolean }) {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const createHref = user ? "/videos" : "/login?next=/videos";

  return (
    <header className="site-header">
      <Logo />
      {showNav ? (
        <nav className="nav-center" aria-label="Primary">
          <Link href={createHref} className={pathname === "/videos" ? "active" : ""}>
            {t("create")}
          </Link>
          <Link href="/examples" className={pathname === "/examples" ? "active" : ""}>
            {t("viewExamples")}
          </Link>
          <Link href="/features" className={pathname?.startsWith("/features") ? "active" : ""}>
            {t("features")}
          </Link>
          <Link href="/pricing" className={pathname === "/pricing" ? "active" : ""}>
            {t("pricing")}
          </Link>
          <Link href="/support" className={pathname === "/support" ? "active" : ""}>
            {t("support")}
          </Link>
        </nav>
      ) : null}
      <div className="header-actions">
        <Link href={createHref} className="btn primary sm header-cta">
          ✦ {t("createVideo")}
        </Link>
        {user ? (
          <Link href="/videos" className="avatar" aria-label={t("myVideos")} title={user.name}>
            {user.image ? <img src={user.image} alt="" /> : user.name.slice(0, 1).toUpperCase()}
          </Link>
        ) : (
          <Link href="/login" className="btn ghost sm header-signin">
            {t("signIn")}
          </Link>
        )}
        <button
          className="icon-btn"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      {open ? (
        <div className="menu-panel">
          <Link href={createHref} onClick={() => setOpen(false)}>
            🎬 {t("myVideos")}
          </Link>
          <Link href="/examples" onClick={() => setOpen(false)}>
            🌍 {t("viewExamples")}
          </Link>
          <Link href="/features" onClick={() => setOpen(false)}>
            ✨ {t("features")}
          </Link>
          <Link href="/pricing" onClick={() => setOpen(false)}>
            💎 {t("pricing")}
          </Link>
          <Link href="/support" onClick={() => setOpen(false)}>
            🛟 {t("support")}
          </Link>
          <Link href="/contacts" onClick={() => setOpen(false)}>
            ✉️ {t("contacts")}
          </Link>
          <div className="menu-divider" />
          {user ? (
            <button
              onClick={() => {
                signOut();
                setOpen(false);
              }}
            >
              ↪ {t("signOut")}
            </button>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)}>
              🔑 {t("signIn")}
            </Link>
          )}
        </div>
      ) : null}
    </header>
  );
}
