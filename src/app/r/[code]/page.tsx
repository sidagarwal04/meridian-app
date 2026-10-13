"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { GlobeStage } from "@/components/GlobeStage";
import { PageShell } from "@/components/PageShell";
import { decodeRoute } from "@/lib/share";

export default function Page() {
  const params = useParams<{ code: string }>();
  const project = useMemo(() => decodeRoute(decodeURIComponent(params.code)), [params.code]);
  return (
    <PageShell>
      <div className="page">
        {project ? (
          <>
            <h1>{project.title}</h1>
            <div className={`export-stage-viewport aspect-${project.style.aspect.replace(":", "-")}`}>
              <GlobeStage project={project} play="auto" enableAudio pro />
            </div>
            <p className="center">
              <Link className="pill" href="/login?next=/videos">
                Create your own
              </Link>
            </p>
          </>
        ) : (
          <p className="center">This route link is invalid.</p>
        )}
      </div>
    </PageShell>
  );
}
