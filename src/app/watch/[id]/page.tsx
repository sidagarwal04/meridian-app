"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GlobeStage } from "@/components/GlobeStage";
import { PageShell } from "@/components/PageShell";
import { getProject } from "@/lib/storage";
import type { Project } from "@/lib/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);

  useEffect(() => {
    getProject(params.id).then((found) => setProject(found));
  }, [params.id]);

  return (
    <PageShell>
      <div className="page">
        {project === undefined ? <p className="center">Loading…</p> : null}
        {project === null ? (
          <p className="center">
            This video is stored in the browser that created it. <Link href="/videos">Back to your library</Link>
          </p>
        ) : null}
        {project ? (
          <>
            <h1>{project.title}</h1>
            <div className={`export-stage-viewport aspect-${project.style.aspect.replace(":", "-")}`}>
              <GlobeStage project={project} play="auto" enableAudio pro />
            </div>
            <p className="center">
              <Link className="btn ghost" href={`/studio/${project.id}`}>
                Edit
              </Link>
            </p>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
