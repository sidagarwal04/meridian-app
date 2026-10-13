import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <PageShell>
      <article className="article legal">
        <h1>Terms of Service</h1>
        <p>Meridian is a local travel-map studio. Videos you render are yours to post, present, or keep.</p>
        <p>Meridian is free. Sign in with Google, then use every transport, style, and export. There is no subscription and no video credit.</p>
        <p>Do not upload photos you do not have rights to use. Map tiles are provided by their own publishers and stay under those publishers’ terms.</p>
        <p>The service is provided as-is. Routes that cross oceans may fall back to a direct arc when a road router cannot connect the stops.</p>
      </article>
    </PageShell>
  );
}
