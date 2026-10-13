import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <PageShell>
      <article className="article legal">
        <h1>Privacy Policy</h1>
        <p>Sign-in uses Google. Google receives the sign-in and returns your name, email, and profile photo to this app. Meridian stores that session in a cookie on this site.</p>
        <p>Projects and photos live in this browser: IndexedDB for videos. They are not uploaded to a Meridian server.</p>
        <p>Place search and road routing call public geocoding and routing services with the place names or coordinates you enter. Those providers see that request.</p>
        <p>A share link encodes the route in the URL itself. Leave photos out of links you post publicly; photos never go into that link.</p>
        <p>Clearing site data for this origin deletes the videos stored here. Signing out ends the Google session on this site.</p>
      </article>
    </PageShell>
  );
}
