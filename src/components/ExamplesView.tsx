"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GlobeStage } from "./GlobeStage";
import { PageShell } from "./PageShell";
import { TEMPLATES } from "@/lib/templates";
import { THEMES, applyTheme, transportMeta, type ThemeId } from "@/lib/types";
import { countVisitedPlaces, flagEmoji, haversineKm } from "@/lib/geo";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "./AuthProvider";

export function ExamplesView() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [active, setActive] = useState(TEMPLATES[0].id);
  const [overrideTheme, setOverrideTheme] = useState<ThemeId | null>(null);

  const selected = TEMPLATES.find((item) => item.id === active) ?? TEMPLATES[0];
  const createHref = user ? "/videos" : "/login?next=/videos";

  const activeProject = useMemo(() => {
    if (!overrideTheme) return selected.project;
    return {
      ...selected.project,
      style: applyTheme(selected.project.style, overrideTheme),
    };
  }, [selected, overrideTheme]);

  const activeDistanceKm = useMemo(() => {
    let km = 0;
    const stops = activeProject.stops;
    for (let i = 1; i < stops.length; i++) {
      km += haversineKm(stops[i - 1], stops[i]);
    }
    return Math.round(km);
  }, [activeProject]);

  return (
    <PageShell>
      <div className="page">
        <div className="page-hero-head">
          <span className="hero-badge">
            <span className="badge-dot" /> Curated Route Showcase
          </span>
          <h1>{t("examplesTitle")}</h1>
          <p className="lead">
            Click any itinerary below to watch its 3D camera path, transport transitions, and globe styling in real time.
          </p>
        </div>

        {/* Featured Theater Player */}
        <div className="theater-showcase-card">
          <div className="hero-stage-bar">
            <div className="window-dots">
              <i />
              <i />
              <i />
            </div>
            <div className="hero-theme-pills" role="group" aria-label="Theme override">
              {(Object.keys(THEMES) as ThemeId[]).map((themeKey) => {
                const currentTheme = overrideTheme ?? selected.project.style.theme;
                return (
                  <button
                    key={themeKey}
                    type="button"
                    className={currentTheme === themeKey ? "active" : ""}
                    onClick={() => setOverrideTheme(themeKey)}
                  >
                    <span className="mini-dot" style={{ background: THEMES[themeKey].line }} />
                    {THEMES[themeKey].label}
                  </button>
                );
              })}
            </div>
            <span className="window-tag">● Playing {selected.title}</span>
          </div>

          <div className="theater-stage-grid">
            <div className="theater-canvas-wrap">
              <GlobeStage
                key={`${selected.id}-${overrideTheme ?? "default"}`}
                project={activeProject}
                play="loop"
                pro
                size={{ w: 1280, h: 720 }}
              />
            </div>
            <div className="theater-details">
              <span className="section-kicker">Featured Itinerary</span>
              <h2>{selected.title}</h2>
              <p className="theater-blurb">{selected.blurb}</p>

              <div className="theater-stats">
                <div>
                  <strong>{countVisitedPlaces(activeProject.stops)}</strong>
                  <span>Places</span>
                </div>
                <div>
                  <strong>{activeDistanceKm.toLocaleString()} km</strong>
                  <span>Total distance</span>
                </div>
                <div>
                  <strong>{THEMES[activeProject.style.theme].label}</strong>
                  <span>Map theme</span>
                </div>
              </div>

              <div className="theater-stop-timeline">
                {activeProject.stops.map((stop, idx) => (
                  <div key={stop.id} className="theater-stop-row">
                    <span className="idx">{idx + 1}</span>
                    <span>
                      {stop.code ? `${flagEmoji(stop.code)} ` : ""}
                      <strong>{stop.name}</strong>
                      {stop.country ? <small> · {stop.country}</small> : null}
                    </span>
                    {activeProject.legs[idx] ? (
                      <span className="theater-leg-pill">
                        {transportMeta(activeProject.legs[idx].transport).icon}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <Link className="btn primary wide" href={createHref}>
                ✦ Build a route like this →
              </Link>
            </div>
          </div>
        </div>

        {/* All Examples Grid */}
        <div className="section-heading" style={{ marginTop: 48 }}>
          <span className="section-kicker">All Templates</span>
          <h2>Choose a trip to preview</h2>
        </div>

        <div className="example-grid">
          {TEMPLATES.map((template) => {
            const isSelected = template.id === selected.id;
            return (
              <button
                key={template.id}
                type="button"
                className={`example-card interactive-example ${isSelected ? "selected-card" : ""}`}
                onClick={() => {
                  setActive(template.id);
                  setOverrideTheme(null);
                  window.scrollTo({ top: 120, behavior: "smooth" });
                }}
              >
                <div className="card-globe-preview">
                  <GlobeStage project={template.project} play="freeze-end" pro size={{ w: 640, h: 360 }} />
                  <span className="card-theme-badge">{THEMES[template.project.style.theme].label}</span>
                  {isSelected ? <span className="now-playing-pill">● Playing above</span> : null}
                </div>
                <div className="example-copy">
                  <div className="card-meta-row">
                    <span>
                      {countVisitedPlaces(template.project.stops)}{" "}
                      {countVisitedPlaces(template.project.stops) === 1 ? "place" : "places"}
                    </span>
                    <span>·</span>
                    <span>
                      {template.project.stops
                        .map((s) => (s.code ? flagEmoji(s.code) : ""))
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  </div>
                  <h2>{template.title}</h2>
                  <p>{template.blurb}</p>
                </div>
              </button>
            );
          })}
        </div>

        <section className="home-cta-banner" style={{ marginTop: 56 }}>
          <div className="cta-banner-inner">
            <h2>{t("createYours")}</h2>
            <p>{t("createYoursBody")}</p>
            <Link className="btn primary lg" href={createHref}>
              ✦ {t("createVideo")} →
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
