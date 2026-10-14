"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { GlobeStage } from "@/components/GlobeStage";
import { PageShell } from "@/components/PageShell";
import { getCachedProjectSync, getProject } from "@/lib/storage";
import type { Project } from "@/lib/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const [project, setProject] = useState<Project | null | undefined>(
    () => getCachedProjectSync(params.id) ?? undefined
  );

  useEffect(() => {
    if (!ready) return;
    let active = true;
    getProject(params.id, (updated) => {
      if (active) setProject(updated);
    }).then((found) => {
      if (active) setProject(found);
    });
    return () => {
      active = false;
    };
  }, [ready, params.id]);

  return (
    <PageShell>
      <div className="page">
        {project === undefined ? <p className="center">Loading…</p> : null}
        {project === null ? (
          <p className="center">
            Project not found in your library or local browser storage. <Link href="/videos">Back to your library</Link>
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
