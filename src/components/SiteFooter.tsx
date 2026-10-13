"use client";

import Link from "next/link";
import { LANGUAGES, useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t, lang, setLang } = useI18n();
  return (
    <footer className="site-footer">
      <ul>
        <li><Link href="/features">{t("features")}</Link></li>
        <li><Link href="/pricing">{t("pricing")}</Link></li>
        <li><Link href="/support">{t("support")}</Link></li>
        <li><Link href="/contacts">{t("contacts")}</Link></li>
        <li><Link href="/terms">{t("terms")}</Link></li>
        <li><Link href="/privacy">{t("privacy")}</Link></li>
      </ul>
      <label className="lang">
        <span className="sr-only">Language</span>
        <select value={lang} onChange={(event) => setLang(event.target.value)} aria-label="Language">
          {LANGUAGES.map((language) => (
            <option key={language.id} value={language.id}>
              {language.label}
            </option>
          ))}
        </select>
      </label>
      <p className="fine">Country shapes from Natural Earth via world-atlas. Place search uses OpenStreetMap Nominatim. Roads use OSRM.</p>
      <p className="footer-credit">
        Made with <span className="footer-heart" aria-label="love">♥</span> for travel enthusiasts by{" "}
        <a href="https://meetsid.dev" target="_blank" rel="noopener noreferrer">
          Sid
        </a>
      </p>
    </footer>
  );
}
