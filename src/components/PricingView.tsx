"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { PageShell } from "./PageShell";

const PERKS = [
  {
    icon: "🎬",
    title: "Unlimited 1080p 60fps Exports",
    desc: "Render crisp Full HD MP4, MOV, WebM, MKV, or animated GIF routes in 16:9 landscape, 9:16 vertical, or 1:1 square with zero credit limits.",
  },
  {
    icon: "📍",
    title: "Up to 100 Places & 100 Photos",
    desc: "Plot multi-continent expeditions and attach up to 12 polaroid photos per stop that pop up during camera pauses.",
  },
  {
    icon: "🚄",
    title: "All 12 Air, Land & Sea Vehicles",
    desc: "Combine airplanes, helicopters, trains, cars, buses, motorcycles, tuk-tuks, campers, bikes, walking, and boats.",
  },
  {
    icon: "📂",
    title: "GPX, KML, GeoJSON & Maps Import",
    desc: "Drop recorded GPS tracks from Strava/Garmin, paste a Google Maps directions URL, or type an itinerary in plain text.",
  },
  {
    icon: "🎨",
    title: "5 Cartographic Themes & Custom Colors",
    desc: "Switch between Earth, Eco, Night, Paper, and Cyber palettes — or pick custom route, backdrop, and label hex colors.",
  },
  {
    icon: "🎵",
    title: "Synthesized Audio & Transport SFX",
    desc: "Mix in 8 procedural soundtracks and per-leg vehicle sound effects (engines, rails, sails, footsteps), and toggle the Meridian mark freely.",
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
            <span className="badge-dot" /> 100% Free Studio · No Subscriptions
          </span>
          <h1>Every Pro feature is included for free</h1>
          <p className="lead">
            Sign in with Google and unlock the complete Meridian Studio. No watermarks, no credit packs, and no paywalls.
          </p>
        </div>

        {/* Main Pricing Spotlight Card */}
        <div className="pricing-spotlight-card">
          <div className="pricing-spotlight-left">
            <span className="pricing-tier-pill">ALL-ACCESS STUDIO PASS</span>
            <div className="pricing-price-row">
              <span className="price-big">$0</span>
              <span className="price-sub">forever · unlimited videos</span>
            </div>
            <p>
              Videos render directly on your device using WebGL/Canvas and Web Audio, so there are no cloud rendering fees to pass on to you.
            </p>
            <div className="hero-actions">
              <Link className="btn primary lg" href={ctaHref}>
                ✦ {user ? "Open My Expeditions →" : "Sign in with Google — Free →"}
              </Link>
              <Link className="btn ghost lg" href="/examples">
                Watch Examples
              </Link>
            </div>
          </div>

          <div className="pricing-checklist">
            <h3>Everything unlocked out of the box</h3>
            <ul>
              <li>✓ Unlimited video exports &amp; route shares</li>
              <li>✓ 1920×1080 Full HD at 60 FPS</li>
              <li>✓ Real OSRM road, bike &amp; walking routing</li>
              <li>✓ GPX, KML &amp; GeoJSON track simplification</li>
              <li>✓ Country flag badges &amp; territory highlighting</li>
              <li>✓ Optional watermark toggle</li>
            </ul>
          </div>
        </div>

        {/* 6-Card Bento Grid */}
        <div className="home-features" style={{ marginTop: 32 }}>
          {PERKS.map((perk) => (
            <div key={perk.title} className="feature-highlight-card">
              <span className="feature-icon">{perk.icon}</span>
              <h3>{perk.title}</h3>
              <p>{perk.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
