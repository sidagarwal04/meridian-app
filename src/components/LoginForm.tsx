"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";

export function LoginForm({ googleReady }: { googleReady: boolean }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const next = params.get("next") || "/videos";
  const error = params.get("error");

  return (
    <PageShell>
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-grid">
            <div>
              <h1>{t("welcome")}</h1>
              <p>{t("welcomeA")}</p>
              <p>{t("welcomeB")}</p>
            </div>
            <div className="plane" aria-hidden="true">✈</div>
          </div>
          <p>{t("signInWith")}</p>
          {googleReady ? (
            <button className="btn google-btn wide" type="button" onClick={() => signIn("google", { callbackUrl: next })}>
              <GoogleMark />
              Continue with Google
            </button>
          ) : (
            <div className="setup-note">
              <p>Google sign-in needs a free OAuth client from Google Cloud. Add these to <code>.env.local</code>, then restart the dev server:</p>
              <ol>
                <li>Create an OAuth client (Web application) in Google Cloud Console.</li>
                <li>
                  Set the authorized redirect URI to <code>http://localhost:3456/api/auth/callback/google</code>.
                </li>
                <li>
                  Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>.
                </li>
              </ol>
            </div>
          )}
          {error ? <p className="notice">Google could not complete sign-in. Check the client ID, secret, and redirect URI, then try again.</p> : null}
          <p className="hint">{t("demoNote")}</p>
          <p className="agree">
            {t("agree")} <Link href="/terms">{t("terms")}</Link> {t("and")} <Link href="/privacy">{t("privacy")}</Link>.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.3 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
