import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Support" };

const FAQ = [
  ["How do I create a video?", "Sign in with Google, open My videos, and choose Create video. Replace the starter route, set transport between stops, then Preview and Download."],
  ["Where are my videos stored?", "On this device, in the browser. A copied share link carries the route without photos. Signing in with the same Google account on another browser starts a fresh library."],
  ["Is anything paid?", "No. After Google sign-in, every transport, 1080p, 60 FPS, file import, and music is included. Downloads are free."],
  ["What file do I get?", "A WebM recording of the globe animation. It plays in current browsers and uploads to the major social apps."],
];

export default function Page() {
  return (
    <PageShell>
      <div className="page">
        <h1>Support</h1>
        <p className="lead">Short answers for the studio. Longer walkthroughs live on the features page.</p>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q} open>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
        <p className="center">
          <Link href="/features">Read the guides</Link>
        </p>
      </div>
    </PageShell>
  );
}
