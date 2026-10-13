import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Privacy Policy" };

const HIGHLIGHTS = [
  {
    icon: "🔒",
    title: "Cross-Device Routes, Local-Only Photos",
    desc: "Your routes and style settings sync across devices with your account, while personal stop photos stay strictly in your local browser's IndexedDB — never uploaded to our servers.",
  },
  {
    icon: "🔑",
    title: "Google Sign-In Only",
    desc: "Authentication uses Google OAuth to verify your identity and stores a lightweight session cookie on this site.",
  },
  {
    icon: "🔗",
    title: "Self-Contained Share Links",
    desc: "Shared route URLs encode city coordinates directly in the link. Attached personal photos are never embedded in shared links.",
  },
];

const SECTIONS = [
  {
    num: "01",
    title: "Google Sign-In & Session Cookie",
    body: "Sign-in is handled through Google OAuth. When you authenticate, Google returns your name, email address, and profile picture to this application. Meridian stores that session inside an encrypted cookie on this site so you stay signed in across visits.",
  },
  {
    num: "02",
    title: "Cross-Device Route Sync & Local Photo Privacy",
    body: "Your route itineraries, stops, and style settings are synced to your Google account (via Netlify Blobs) so you can access your library across laptop and mobile devices. Attached stop photos are stripped before syncing and remain strictly inside your local browser's IndexedDB on the device where they were added. Videos are rendered directly on your device via HTML5 Canvas and Web Audio.",
  },
  {
    num: "03",
    title: "Geocoding, Map Tiles & Road Routing",
    body: "Searching for cities, loading map tiles, and tracing road, bicycle, or walking paths send the place names or coordinates you enter to public geocoding, tile, and OSRM routing services so they can return map geometry to your browser.",
  },
  {
    num: "04",
    title: "Share Links & Public URLs",
    body: "Generating a share link encodes the route stops and style settings directly into the URL string itself. Personal photos attached to stops are never included in share links, keeping your images private to your local browser.",
  },
  {
    num: "05",
    title: "Clearing Data & Signing Out",
    body: "You are in full control of your local data. Deleting a project in My Videos or clearing browser site data for this origin permanently removes the videos stored on this device. Signing out immediately ends your Google session on this site.",
  },
];

export default function Page() {
  return (
    <PageShell>
      <div className="page">
        <div className="page-hero-head">
          <span className="hero-badge">
            <span className="badge-dot" /> Local-First Data &amp; Privacy
          </span>
          <h1>Privacy Policy</h1>
          <p className="lead">
            How Meridian handles sign-in, local browser storage, public map routing requests, and shared links.
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
          <span>Questions about usage rights or the studio?</span>
          <div className="hero-actions">
            <Link className="btn ghost" href="/terms">
              Terms of Service →
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
