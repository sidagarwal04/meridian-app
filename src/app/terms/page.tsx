import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Terms of Service" };

const HIGHLIGHTS = [
  {
    icon: "🎬",
    title: "Your Videos Are Yours",
    desc: "Any travel map animation you render in Meridian belongs to you. Post, present, monetize, or keep it with zero restrictions.",
  },
  {
    icon: "✦",
    title: "100% Free Studio",
    desc: "Sign in with Google and use every transport icon, cartographic theme, and 1080p 60fps export. No subscriptions or credit packs.",
  },
  {
    icon: "💻",
    title: "Synced Routes & Local Rendering",
    desc: "Routes and style settings sync across your devices, while personal stop photos and video rendering stay locally on your device.",
  },
];

const SECTIONS = [
  {
    num: "01",
    title: "Ownership & Content Rights",
    body: "Meridian is a local travel-map animation studio. Videos you render are yours to publish on social platforms, include in commercial or personal presentations, or archive. You retain full ownership of the routes and media you assemble.",
  },
  {
    num: "02",
    title: "Free Access & Account Usage",
    body: "Meridian is provided free of charge. After signing in with Google, every transport mode, globe theme, GPX/KML/GeoJSON import, and high-definition export is unlocked without watermarks, recurring subscriptions, or paid video credits.",
  },
  {
    num: "03",
    title: "User Media & Third-Party Map Data",
    body: "Only attach photos and media that you own or have permission to use. Map tiles, geocoding lookups, and road-routing geometries are supplied by third-party open cartography and routing providers and remain subject to their respective licenses and terms.",
  },
  {
    num: "04",
    title: "Service Availability & Routing Fallback",
    body: "Meridian is provided on an \"as-is\" basis without warranties of uninterrupted availability. When a public road, bike, or foot router cannot connect two stops — such as across oceans or unmapped terrain — the route leg automatically falls back to a direct great-circle arc.",
  },
];

export default function Page() {
  return (
    <PageShell>
      <div className="page">
        <div className="page-hero-head">
          <span className="hero-badge">
            <span className="badge-dot" /> Legal &amp; Usage Terms
          </span>
          <h1>Terms of Service</h1>
          <p className="lead">
            Plain-language terms for creating, exporting, and sharing travel map animations with Meridian.
          </p>
        </div>

        <div className="home-features" style={{ marginBottom: 32 }}>
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="feature-highlight-card">
              <span className="feature-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="legal-sections">
          {SECTIONS.map((sec) => (
            <section key={sec.num} className="legal-section-card">
              <span className="legal-section-num">{sec.num}</span>
              <div className="legal-section-copy">
                <h2>{sec.title}</h2>
                <p>{sec.body}</p>
              </div>
            </section>
          ))}
        </div>

        <div className="legal-footer-bar">
          <span>Looking for how your data is handled?</span>
          <div className="hero-actions">
            <Link className="btn ghost" href="/privacy">
              Privacy Policy →
            </Link>
            <Link className="btn ghost" href="/support">
              Support &amp; FAQ
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
