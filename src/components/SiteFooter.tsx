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
      <div className="footer-meta-row">
        <div className="footer-gh-pill" role="navigation" aria-label="Footer links">
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
          <span className="footer-gh-sep" aria-hidden="true" />
          <Link href="/terms" className="footer-gh-segment">
            <span>{t("terms")}</span>
          </Link>
          <span className="footer-gh-sep" aria-hidden="true" />
          <Link href="/privacy" className="footer-gh-segment">
            <span>{t("privacy")}</span>
          </Link>
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
