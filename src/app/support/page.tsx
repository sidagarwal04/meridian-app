import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Support" };

const FAQ = [
  [
    "How do I create a travel map video?",
    "Sign in with Google, open My Videos, and click Create Video. Search cities or click directly on the interactive globe to add stops, choose transport icons between stops, and click Preview or Export Video.",
  ],
  [
    "How do I reorder or remove stops on the route?",
    "In the Studio Route tab, drag any stop by its ⋮⋮ handle, click the ↑ and ↓ buttons, or click × to remove it. You can also click any pin directly on the 2D map (or in the bottom route bar on the map) to move it earlier/later or delete it.",
  ],
  [
    "What if I pan or zoom the map and lose my route?",
    "Use the ⊡ Fit Route or 🌐 World View buttons in the top-right corner of the Studio map at any time to re-center the globe. Switch to '✋ Pan / Select only' mode in the top-left toolbar if you want to explore the map without adding pins on click.",
  ],
  [
    "Where are my videos and photos stored?",
    "Everything is stored locally in your browser's IndexedDB on this device. Nothing is uploaded to an external server. A copied share link encodes the route coordinates directly in the URL.",
  ],
  [
    "Is Meridian really 100% free?",
    "Yes. After signing in with Google, all 12 transport modes, 1080p 60fps exports, GPX/KML/GeoJSON imports, custom colors, and synthesized soundtracks are completely free.",
  ],
  [
    "What video format is downloaded?",
    "Exports record a high-bitrate WebM video directly from the HTML5 canvas with mixed audio. It plays in modern browsers and uploads directly to YouTube, Instagram, TikTok, and presentation tools.",
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
          <Link href="/contacts" className="feature-highlight-card">
            <span className="feature-icon">✉️</span>
            <h3>Leave a Support Note</h3>
            <p>Have a question about a specific route or browser export? Send us a note.</p>
          </Link>
        </div>

        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q} open>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>

        <p className="center" style={{ marginTop: 32 }}>
          <Link className="btn ghost lg" href="/features">
            Read all feature guides →
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
