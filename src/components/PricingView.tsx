"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { PageShell } from "./PageShell";

const INCLUDED = [
  "Unlimited videos and downloads",
  "Up to 100 places and 100 photos",
  "1080p and 60 FPS",
  "Airplane, road, rail, and sea routes",
  "GPX, KML, and GeoJSON import",
  "Custom colors, music, and an optional logo",
];

export function PricingView() {
  const { user } = useAuth();
  return (
    <PageShell>
      <div className="page">
        <h1>Meridian is free</h1>
        <p className="lead">Sign in with Google. Maps, styles, music, and downloads are included. There is no credit pack and no subscription.</p>
        <ul className="free-list">
          {INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="center">
          <Link className="btn primary" href={user ? "/videos" : "/login?next=/videos"}>
            {user ? "My videos" : "Sign in with Google"}
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
