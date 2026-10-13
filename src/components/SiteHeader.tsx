"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Logo } from "./Logo";
import { useI18n } from "@/lib/i18n";

export function SiteHeader({ showNav = true }: { showNav?: boolean }) {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <Logo />
      {showNav ? (
        <nav className="nav-center" aria-label="Primary">
          <Link href={user ? "/videos" : "/login?next=/videos"}>{t("create")}</Link>
          <Link href="/features">{t("features")}</Link>
          <Link href="/pricing">{t("pricing")}</Link>
        </nav>
      ) : null}
      <div className="header-actions">
        {user ? (
          <Link href="/videos" className="avatar" aria-label={t("myVideos")}>
            {user.image ? <img src={user.image} alt="" /> : user.name.slice(0, 1).toUpperCase()}
          </Link>
        ) : null}
        <button className="icon-btn" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span />
          <span />
          <span />
        </button>
      </div>
      {open ? (
        <div className="menu-panel">
          <Link href={user ? "/videos" : "/login?next=/videos"} onClick={() => setOpen(false)}>
            {t("myVideos")}
          </Link>
          <Link href="/features" onClick={() => setOpen(false)}>
            {t("features")}
          </Link>
          <Link href="/pricing" onClick={() => setOpen(false)}>
            {t("pricing")}
          </Link>
          <Link href="/examples" onClick={() => setOpen(false)}>
            {t("viewExamples")}
          </Link>
          <Link href="/support" onClick={() => setOpen(false)}>
            {t("support")}
          </Link>
          <Link href="/contacts" onClick={() => setOpen(false)}>
            {t("contacts")}
          </Link>
          {user ? (
            <button
              onClick={() => {
                signOut();
                setOpen(false);
              }}
            >
              {t("signOut")}
            </button>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)}>
              {t("signIn")}
            </Link>
          )}
        </div>
      ) : null}
    </header>
  );
}
