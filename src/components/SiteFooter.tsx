"use client";

import Link from "next/link";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { GitHubMark } from "./SiteHeader";

export const GITHUB_REPO_URL = "https://github.com/sidagarwal04/meridian-app";
export const GITHUB_ISSUES_URL = "https://github.com/sidagarwal04/meridian-app/issues/new/choose";

export function SiteFooter() {
  const { t, lang, setLang } = useI18n();

  return (
    <footer className="site-footer">
      <ul>
        <li><Link href="/features">{t("features")}</Link></li>
        <li><Link href="/pricing">{t("pricing")}</Link></li>
        <li><Link href="/support">{t("support")}</Link></li>
        <li><Link href="/terms">{t("terms")}</Link></li>
        <li><Link href="/privacy">{t("privacy")}</Link></li>
      </ul>

      <div className="footer-meta-row">
        <div className="footer-gh-pill" role="group" aria-label="GitHub repository and issue tracker">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-gh-segment"
          >
            <GitHubMark size={15} />
            <span>Open Source</span>
          </a>
          <span className="footer-gh-sep" aria-hidden="true" />
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-gh-segment accent"
          >
            <span>{t("issuesFeatures")} ↗</span>
          </a>
        </div>

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
      </div>

      <p className="footer-credit">
        Made with <span className="footer-heart" aria-label="love">♥</span> for travel enthusiasts by{" "}
        <a href="https://meetsid.dev" target="_blank" rel="noopener noreferrer">
          Sid
        </a>
      </p>
    </footer>
  );
}
