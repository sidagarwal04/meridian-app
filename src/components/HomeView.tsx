"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageShell } from "./PageShell";
import { GlobeStage } from "./GlobeStage";
import { HERO_PROJECT, TEMPLATES } from "@/lib/templates";
import { THEMES, applyTheme, transportMeta, type ThemeId } from "@/lib/types";
import { countVisitedPlaces, flagEmoji, haversineKm } from "@/lib/geo";
import { useAuth } from "./AuthProvider";
import { useI18n } from "@/lib/i18n";

export function HomeView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const createHref = user ? "/videos" : "/login?next=/videos";

  const showcaseRoutes = useMemo(
    () => [
      { id: "hero", title: "Global Flight Odyssey", blurb: "New York across Europe and Asia to Tokyo.", project: HERO_PROJECT },
      ...TEMPLATES.slice(0, 4),
    ],
    []
  );

  const [selectedRouteId, setSelectedRouteId] = useState("hero");
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("earth");

  const activeShowcase = showcaseRoutes.find((r) => r.id === selectedRouteId) ?? showcaseRoutes[0];
  const liveProject = useMemo(
    () => ({
      ...activeShowcase.project,
      style: {
        ...applyTheme(activeShowcase.project.style, selectedTheme),
        speed: 1.5,
        showLogo: false,
      },
    }),
    [activeShowcase, selectedTheme]
  );

  const routeDistanceKm = useMemo(() => {
    let km = 0;
    const stops = liveProject.stops;
    for (let i = 1; i < stops.length; i++) {
      km += haversineKm(stops[i - 1], stops[i]);
    }
    return Math.round(km);
  }, [liveProject]);

  return (
    <PageShell>
      {/* Ambient Hero Section */}
      <section className="hero-modern">
        <div className="hero-content">
          <div className="hero-eyebrow-row">
            <span className="hero-badge">
              <span className="badge-dot" /> {t("heroKicker")} · 3D Cartographic Studio
            </span>
            <span className="hero-pill-tag">1080p · 60 FPS · Free</span>
          </div>

          <h1 className="hero-title">
            Turn every journey into a <span className="text-gradient">cinematic 3D map</span> video.
          </h1>

          <p className="hero-subtitle">
            {t("heroBody")} Plot flights, high-speed trains, road trips, and sea crossings on an interactive 3D globe — ready for YouTube, Reels, TikTok, or presentations in seconds.
          </p>

          <div className="hero-actions">
            <Link className="btn primary lg" href={createHref}>
              ✦ {t("createCta")} →
            </Link>
            <Link className="btn ghost lg" href="/examples">
              ▶ {t("viewExamples")}
            </Link>
          </div>

          <div className="hero-metrics">
            <div className="metric-card">
              <strong>1080p @ 60fps</strong>
              <span>MP4, MOV, WebM &amp; GIF</span>
            </div>
            <div className="metric-card">
              <strong>12+ Transports</strong>
              <span>Air, rail, road &amp; sea</span>
            </div>
            <div className="metric-card">
              <strong>5 Map Themes</strong>
              <span>Earth, Night, Eco &amp; more</span>
            </div>
          </div>
        </div>

        {/* Interactive Live 3D Globe Theater */}
        <div className="hero-stage-card">
          <div className="hero-stage-bar">
            <div className="window-dots">
              <i />
              <i />
              <i />
            </div>
            <div className="hero-theme-pills" role="group" aria-label="Preview globe theme">
              {(Object.keys(THEMES) as ThemeId[]).map((themeKey) => (
                <button
                  key={themeKey}
                  type="button"
                  className={selectedTheme === themeKey ? "active" : ""}
                  onClick={() => setSelectedTheme(themeKey)}
                >
                  <span
                    className="mini-dot"
                    style={{ background: THEMES[themeKey].line }}
                  />
                  {THEMES[themeKey].label}
                </button>
              ))}
            </div>
            <span className="window-tag">● Live 3D</span>
          </div>

          <div className="hero-globe-frame">
            <GlobeStage
              key={`${selectedRouteId}-${selectedTheme}`}
              project={liveProject}
              play="loop"
              pro
              size={{ w: 1280, h: 720 }}
            />
            <div className="hero-globe-overlay-top">
              <span className="telemetry-pill">
                📍 {countVisitedPlaces(liveProject.stops)}{" "}
                {countVisitedPlaces(liveProject.stops) === 1 ? "place" : "places"} · {routeDistanceKm.toLocaleString()} km
              </span>
              <span className="telemetry-pill">
                {transportMeta(liveProject.legs[0]?.transport ?? "plane").icon}{" "}
                {transportMeta(liveProject.legs[0]?.transport ?? "plane").label}
              </span>
            </div>
          </div>

          {/* Interactive Route Switcher inside Hero Stage */}
          <div className="hero-stage-footer">
            <div className="hero-route-tabs" role="tablist" aria-label="Sample routes">
              {showcaseRoutes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedRouteId === item.id}
                  className={selectedRouteId === item.id ? "active" : ""}
                  onClick={() => setSelectedRouteId(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </div>
            <div className="hero-stops-ticker">
              {liveProject.stops.map((s, idx) => (
                <span key={s.id} className="ticker-stop">
                  {idx > 0 ? <em className="ticker-arrow">→</em> : null}
                  {s.code ? `${flagEmoji(s.code)} ` : ""}
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bento Feature Grid */}
      <section className="home-section">
        <div className="section-heading">
          <span className="section-kicker">Workflow</span>
          <h2>From itinerary to cinema in three steps</h2>
          <p>No keyframes, no complex timelines. Just list your places and let Meridian animate the camera.</p>
        </div>

        <div className="home-features">
          <div className="feature-highlight-card">
            <div className="feature-step-row">
              <span className="feature-icon">📍</span>
              <span className="step-num">STEP 01</span>
            </div>
            <h3>Plot, Reorder &amp; Import Stops</h3>
            <p>
              Search global cities, click directly on the interactive globe, paste a Google Maps directions link, or upload GPX, KML, and GeoJSON tracks. Drag and drop stops anytime.
            </p>
            <div className="feature-mini-chips">
              <span>🔍 City search</span>
              <span>🗺 Map click</span>
              <span>📂 GPX / KML</span>
            </div>
          </div>

          <div className="feature-highlight-card">
            <div className="feature-step-row">
              <span className="feature-icon">🚄</span>
              <span className="step-num">STEP 02</span>
            </div>
            <h3>Multi-Modal Travel &amp; Polaroids</h3>
            <p>
              Combine flights, high-speed trains, road trips, camper vans, and boats in a single route. Attach up to 100 photos that pop up as the camera pauses on each stop.
            </p>
            <div className="feature-mini-chips">
              <span>✈ Great-circle arcs</span>
              <span>🚗 Real OSRM roads</span>
              <span>🖼 Stop photos</span>
            </div>
          </div>

          <div className="feature-highlight-card">
            <div className="feature-step-row">
              <span className="feature-icon">🎬</span>
              <span className="step-num">STEP 03</span>
            </div>
            <h3>1080p 60fps Export with Audio</h3>
            <p>
              Switch between 16:9 YouTube, 9:16 Reels/TikTok, and 1:1 Square formats. Mix in browser-synthesized ambient, synthwave, or cinematic soundtracks and download instantly.
            </p>
            <div className="feature-mini-chips">
              <span>📺 16:9 · 9:16 · 1:1</span>
              <span>🎵 9 Soundtracks</span>
              <span>⬇ MP4 · MOV · WebM · GIF</span>
            </div>
          </div>
        </div>
      </section>

      {/* Curated Templates Preview Section */}
      <section className="home-section">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">Inspiration</span>
            <h2>Ready-made journeys you can remix</h2>
          </div>
          <Link href="/examples" className="btn ghost">
            Explore all examples →
          </Link>
        </div>

        <div className="example-grid">
          {TEMPLATES.slice(0, 3).map((template) => {
            const visited = countVisitedPlaces(template.project.stops);
            return (
              <div key={template.id} className="example-card showcase-card">
                <div className="card-globe-preview">
                  <GlobeStage project={template.project} play="freeze-end" pro size={{ w: 640, h: 360 }} />
                  <span className="card-theme-badge">{THEMES[template.project.style.theme].label}</span>
                </div>
                <div className="example-copy">
                  <div className="card-meta-row">
                    <span>
                      {visited} {visited === 1 ? "place" : "places"}
                    </span>
                    <span>·</span>
                    <span>
                      {template.project.stops
                        .slice(0, 3)
                        .map((s) => (s.code ? flagEmoji(s.code) : ""))
                        .join(" ")}
                    </span>
                  </div>
                  <h2>{template.title}</h2>
                  <p>{template.blurb}</p>
                  <div className="card-footer-actions">
                    <Link href={createHref} className="btn ghost sm wide">
                      Open in Studio →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="home-cta-banner">
        <div className="cta-banner-inner">
          <span className="hero-badge">✦ 100% Free with Google Sign-In</span>
          <h2>Ready to animate your next adventure?</h2>
          <p>
            Create unlimited travel map videos with up to 100 places, custom colors, road routing, and 1080p 60fps downloads.
          </p>
          <div className="hero-actions">
            <Link className="btn primary lg" href={createHref}>
              ✦ {t("createVideo")} Now
            </Link>
            <Link className="btn ghost lg" href="/features">
              Read Feature Guides
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
