import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Support" };

const FAQ = [
  [
    "How do I create a travel map video?",
    "Sign in with Google, open My Expeditions, and click Create Meridian. Search cities or click directly on the interactive globe to add stops, choose transport icons between stops, and click Preview or Export Video.",
  ],
  [
    "How do I reorder or remove stops on the route?",
    "In the Studio Route tab, drag any stop by its ⋮⋮ handle, click the ↑ and ↓ buttons, or click × to remove it. You can also click any pin directly on the 2D map (or in the bottom route bar on the map) to move it earlier/later or delete it.",
  ],
  [
    "What if I pan or zoom the map and lose my route?",
    "Use the ⊡ Fit Route or 🌐 World View buttons in the top-right corner of the Studio map at any time to re-center the globe. Switch to '✋ Orbit / Select' mode in the top-left toolbar if you want to explore the map without adding pins on click.",
  ],
  [
    "Where are my videos and photos stored?",
    "Your routes, stops, transport modes, and style settings sync across your devices via your Google account so you can switch between laptop and mobile. Personal photos attached to stops are never uploaded to our servers — they stay locally in the browser (IndexedDB) on the device where you added them.",
  ],
  [
    "Is Meridian really 100% free?",
    "Yes. After signing in with Google, all 12 transport modes, 1080p 60fps exports, GPX/KML/GeoJSON imports, custom colors, and synthesized soundtracks are completely free.",
  ],
  [
    "What video formats can I download?",
    "You can export in MP4 (recommended for universal playback), QuickTime MOV, WebM, Matroska MKV, or animated GIF in 16:9 landscape, 9:16 vertical, or 1:1 square — recorded directly from the canvas with mixed soundtrack and transport sound effects.",
  ],
];

export default function Page() {
  return (
    <PageShell>
      <div className="page">
        <div className="page-hero-head">
          <span className="hero-badge">
            <span className="badge-dot" /> Help Center &amp; FAQ
          </span>
          <h1>Support</h1>
          <p className="lead">Quick answers for building, styling, and exporting your travel map animations.</p>
        </div>

        <div className="home-features" style={{ marginBottom: 36 }}>
          <Link href="/features/create-your-first-map" className="feature-highlight-card">
            <span className="feature-icon">🚀</span>
            <h3>Quick-Start Tutorial</h3>
            <p>Learn how to plot cities, pick transport modes, and export your first animation in under a minute.</p>
          </Link>
          <Link href="/features/import-gpx" className="feature-highlight-card">
            <span className="feature-icon">📂</span>
            <h3>Importing GPX, KML &amp; Maps</h3>
            <p>Bring in recorded GPS tracks or paste Google Maps directions links automatically.</p>
          </Link>
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="feature-highlight-card"
          >
            <span className="feature-icon">💡</span>
            <h3>Report an Issue or Request a Feature</h3>
            <p>Found a bug or have an idea for Meridian? Open an issue or feature request on GitHub with our templates.</p>
          </a>
        </div>

        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q} open>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>

        <div className="hero-actions" style={{ justifyContent: "center", marginTop: 32 }}>
          <Link className="btn ghost lg" href="/features">
            Read all feature guides →
          </Link>
          <a
            className="btn ghost lg"
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            🐙 View on GitHub →
          </a>
        </div>
      </div>
    </PageShell>
  );
}
