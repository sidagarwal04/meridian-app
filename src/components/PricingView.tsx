"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { PageShell } from "./PageShell";
import { GITHUB_REPO_URL } from "./SiteFooter";

const INCLUDED = [
  {
    icon: "🎬",
    title: "1080p 60fps Video & GIF Exports",
    desc: "Export unlimited Full HD MP4, QuickTime MOV, WebM, Matroska MKV, or animated GIF routes in 16:9 landscape, 9:16 vertical, or 1:1 square.",
  },
  {
    icon: "📍",
    title: "Up to 100 Stops & 100 Polaroid Photos",
    desc: "Plot multi-continent expeditions and attach up to 12 photos per stop that fan out as polaroids during camera pauses.",
  },
  {
    icon: "🚄",
    title: "12 Air, Land & Sea Transport Modes",
    desc: "Combine airplanes, helicopters, trains, cars, buses, motorcycles, tuk-tuks, campers, bikes, walking, and boats with real OSRM road routing.",
  },
  {
    icon: "📂",
    title: "GPX, KML, GeoJSON & Maps Import",
    desc: "Drop recorded GPS tracks from Strava or Garmin, paste a Google Maps directions link, or type an itinerary in plain text.",
  },
  {
    icon: "🎨",
    title: "5 Globe Themes & Custom Palettes",
    desc: "Switch between Earth, Eco, Night, Paper, and Cyber styles — or customize ocean backdrop, route line, and callout label hex colors.",
  },
  {
    icon: "🎵",
    title: "Procedural Soundtracks & Vehicle SFX",
    desc: "Mix in 8 beat-driven soundtracks and realistic per-leg vehicle audio (jet turbines, rail clatter, engines, sails, footsteps) synthesized in your browser.",
  },
];

export function PricingView() {
  const { user } = useAuth();
  const ctaHref = user ? "/videos" : "/login?next=/videos";

  return (
    <PageShell>
      <div className="page">
        <div className="page-hero-head">
          <span className="hero-badge">
            <span className="badge-dot" /> 100% Free &amp; Open Source · No Tiers
          </span>
          <h1>Free for everyone. Zero subscriptions.</h1>
          <p className="lead">
            Meridian has no paid plans, credit packs, or locked features. Sign in with Google and use the full studio at no cost.
          </p>
        </div>

        {/* Main Pricing Spotlight Card */}
        <div className="pricing-spotlight-card">
          <div className="pricing-spotlight-left">
            <span className="pricing-tier-pill">SINGLE PLAN · EVERYTHING INCLUDED</span>
            <div className="pricing-price-row">
              <span className="price-big">$0</span>
              <span className="price-sub">forever · unlimited exports</span>
            </div>
            <p>
              Animations render directly in your browser using WebGL/Canvas and Web Audio, so there are no cloud rendering costs — and nothing locked behind a paywall.
            </p>
            <div className="hero-actions">
              <Link className="btn primary lg" href={ctaHref}>
                ✦ {user ? "Open My Meridians →" : "Sign in with Google →"}
              </Link>
              <a
                className="btn ghost lg"
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Source on GitHub ↗
              </a>
            </div>
          </div>

          <div className="pricing-checklist">
            <h3>What you get out of the box</h3>
            <ul>
              <li>✓ Unlimited video exports &amp; shareable route links</li>
              <li>✓ Cross-device route sync with Google Sign-In</li>
              <li>✓ 1920×1080 Full HD at 60 FPS (MP4, MOV, WebM, MKV, GIF)</li>
              <li>✓ All 12 transport modes &amp; OSRM road/trail routing</li>
              <li>✓ GPX, KML, GeoJSON &amp; Google Maps URL imports</li>
              <li>✓ Meridian corner badge toggle (keep it on or turn it off anytime)</li>
            </ul>
          </div>
        </div>

        {/* 6-Card Bento Grid */}
        <div className="home-features" style={{ marginTop: 32 }}>
          {INCLUDED.map((item) => (
            <div key={item.title} className="feature-highlight-card">
              <span className="feature-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
