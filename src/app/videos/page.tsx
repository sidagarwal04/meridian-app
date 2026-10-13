"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageShell } from "@/components/PageShell";
import { createAndSave, deleteProject, listProjects, saveProject } from "@/lib/storage";
import { uid, type Project } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export default function Page() {
  const { ready, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=/videos");
      return;
    }
    listProjects().then(setProjects);
  }, [ready, user, router]);

  const create = async () => {
    setBusy(true);
    const project = await createAndSave();
    router.push(`/studio/${project.id}`);
  };

  return (
    <PageShell>
      <div className="page">
        <h1>{t("myVideos")}</h1>
        <p className="lead">{user ? `Signed in as ${user.email}. Downloads are free.` : ""}</p>
        <p className="center">
          <button className="btn primary" onClick={create} disabled={busy || !user}>
            + {t("createVideo")}
          </button>
        </p>
        <div className="video-grid">
          {projects.map((project) => (
            <article key={project.id} className="video-card">
              <div className="video-copy">
                <h2>{project.title}</h2>
                <p>{project.stops.map((stop) => stop.name).join(" → ")}</p>
                <p className="meta">{new Date(project.updatedAt).toLocaleString()}</p>
              </div>
              <div className="video-actions">
                <Link className="btn ghost" href={`/studio/${project.id}`}>
                  Edit
                </Link>
                <Link className="btn ghost" href={`/watch/${project.id}`}>
                  Play
                </Link>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    const copy: Project = {
                      ...structuredClone(project),
                      id: uid("vid"),
                      title: `${project.title} copy`,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    };
                    await saveProject(copy);
                    setProjects(await listProjects());
                  }}
                >
                  Duplicate
                </button>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    await deleteProject(project.id);
                    setProjects(await listProjects());
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
