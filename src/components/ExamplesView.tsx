"use client";

import Link from "next/link";
import { useState } from "react";
import { GlobeStage } from "./GlobeStage";
import { PageShell } from "./PageShell";
import { TEMPLATES } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "./AuthProvider";

export function ExamplesView() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [active, setActive] = useState(TEMPLATES[0].id);
  const selected = TEMPLATES.find((item) => item.id === active) ?? TEMPLATES[0];
  return (
    <PageShell>
      <div className="page">
        <div className="example-card">
          <GlobeStage key={selected.id} project={selected.project} play="auto" pro size={{ w: 1280, h: 720 }} />
          <div className="example-copy">
            <h2>{selected.title}</h2>
            <p>{selected.blurb}</p>
          </div>
        </div>
        <h1 className="examples-heading">{t("examplesTitle")}</h1>
        <div className="example-grid">
          {TEMPLATES.map((template) => (
            <button key={template.id} className="example-card" onClick={() => setActive(template.id)}>
              <GlobeStage project={template.project} play="freeze-end" pro size={{ w: 640, h: 360 }} />
              <div className="example-copy">
                <h2>{template.title}</h2>
                <p>{template.blurb}</p>
              </div>
            </button>
          ))}
        </div>
        <section className="hero-copy">
          <h2>{t("createYours")}</h2>
          <p>{t("createYoursBody")}</p>
          <Link className="pill" href={user ? "/videos" : "/login?next=/videos"}>
            {t("createVideo")}
          </Link>
        </section>
      </div>
    </PageShell>
  );
}
