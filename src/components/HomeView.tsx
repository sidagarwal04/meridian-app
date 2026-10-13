"use client";

import Link from "next/link";
import { PageShell } from "./PageShell";
import { GlobeStage } from "./GlobeStage";
import { HERO_PROJECT } from "@/lib/templates";
import { useAuth } from "./AuthProvider";
import { useI18n } from "@/lib/i18n";

export function HomeView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const createHref = user ? "/videos" : "/login?next=/videos";
  return (
    <PageShell>
      <section className="hero">
        <div className="hero-globe" aria-hidden="true">
          <GlobeStage project={HERO_PROJECT} play="loop" pro size={{ w: 1280, h: 720 }} />
        </div>
        <div className="hero-fade" />
        <div className="hero-cta">
          <Link className="pill" href={createHref}>
            {t("createCta")}
          </Link>
        </div>
      </section>
      <section className="hero-copy">
        <h1>{t("heroTitle")}</h1>
        <p className="kicker">{t("heroKicker")}</p>
        <Link className="pill" href="/examples">
          {t("viewExamples")}
        </Link>
        <p className="lede">{t("heroBody")}</p>
      </section>
    </PageShell>
  );
}
