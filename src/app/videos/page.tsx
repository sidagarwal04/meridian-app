"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { GlobeStage } from "@/components/GlobeStage";
import { PageShell } from "@/components/PageShell";
import { countVisitedPlaces, flagEmoji, haversineKm } from "@/lib/geo";
import {
  createAndSave,
  deleteProject,
  getCachedProjectsSync,
  getInMemoryProjectsSync,
  listProjects,
  saveProject,
  subscribeProjects,
} from "@/lib/storage";
import { TEMPLATES } from "@/lib/templates";
import { THEMES, uid, type Project } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export default function Page() {
  const { ready, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(() => getInMemoryProjectsSync() ?? []);
  const [loading, setLoading] = useState<boolean>(() => getInMemoryProjectsSync() === null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cached = getCachedProjectsSync();
    if (cached) {
      setProjects(cached);
      setLoading(false);
    }
    const unsub = subscribeProjects((next) => {
      setProjects(next);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=/videos");
      return;
    }
    listProjects((updated) => {
      setProjects(updated);
      setLoading(false);
    }).then((initial) => {
      setProjects(initial);
      setLoading(false);
    });
  }, [ready, user, router]);

  const create = async () => {
    setBusy(true);
    const project = await createAndSave();
    router.push(`/studio/${project.id}`);
  };

  const createFromTemplate = async (templateId: string) => {
    const tpl = TEMPLATES.find((item) => item.id === templateId);
    if (!tpl) return;
    setBusy(true);
    const copy: Project = {
      ...structuredClone(tpl.project),
      id: uid("vid"),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveProject(copy);
    router.push(`/studio/${copy.id}`);
  };

  const distanceOf = (project: Project) => {
    let km = 0;
    for (let i = 1; i < project.stops.length; i++) {
      km += haversineKm(project.stops[i - 1], project.stops[i]);
    }
    return Math.round(km);
  };

  return (
    <PageShell>
      <div className="page">
        <div className="library-header">
          <div>
            <span className="hero-badge">
              <span className="badge-dot" /> Route Studio Library
            </span>
            <h1 style={{ textAlign: "left", margin: "10px 0 6px" }}>{t("myVideos")}</h1>
            <p className="library-sub">
              {user
                ? `Signed in as ${user.email} · Routes & settings sync across your devices. Personal stop photos stay local to the device where they were added.`
                : ""}
            </p>
          </div>
          <button className="btn primary lg" onClick={create} disabled={busy || !user}>
            ✦ + {t("createVideo")}
          </button>
        </div>

        {projects.length > 0 ? (
          <div className="video-grid">
            {projects.map((project) => (
              <article key={project.id} className="video-card">
                <Link href={`/studio/${project.id}`} className="card-globe-preview">
                  <GlobeStage project={project} play="freeze-end" pro size={{ w: 640, h: 360 }} />
                  <span className="card-theme-badge">{THEMES[project.style.theme]?.label ?? "Earth"}</span>
                </Link>
                <div className="video-copy">
                  <div className="card-meta-row">
                    <span>
                      {countVisitedPlaces(project.stops)} {countVisitedPlaces(project.stops) === 1 ? "place" : "places"}
                    </span>
                    <span>·</span>
                    <span>{distanceOf(project).toLocaleString()} km</span>
                    <span>·</span>
                    <span>{project.style.aspect}</span>
                  </div>
                  <h2>{project.title}</h2>
                  <p className="route-stops-preview">
                    {project.stops
                      .map((stop) => `${stop.code ? `${flagEmoji(stop.code)} ` : ""}${stop.name}`)
                      .join(" → ")}
                  </p>
                  <p className="meta">Updated {new Date(project.updatedAt).toLocaleString()}</p>
                </div>
                <div className="video-actions">
                  <Link className="btn primary sm" href={`/studio/${project.id}`}>
                    ✎ Edit in Studio
                  </Link>
                  <Link className="btn ghost sm" href={`/watch/${project.id}`}>
                    ▶ Watch
                  </Link>
                  <button
                    className="btn ghost sm"
                    onClick={async () => {
                      const copy: Project = {
                        ...structuredClone(project),
                        id: uid("vid"),
                        title: `${project.title} copy`,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      };
                      await saveProject(copy);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="btn ghost sm danger-hover"
                    onClick={async () => {
                      await deleteProject(project.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : loading ? (
          <div className="empty-library-card">
            <span className="feature-icon" style={{ margin: "0 auto" }}>🧭</span>
            <h2>Loading your Meridians…</h2>
          </div>
        ) : (
          <div className="empty-library-card">
            <span className="feature-icon" style={{ margin: "0 auto" }}>🌍</span>
            <h2>No Meridians yet</h2>
            <p>Start with a blank globe or pick one of the curated templates below to launch the Studio.</p>
            <button className="btn primary lg" onClick={create} disabled={busy || !user}>
              ✦ Create your first Meridian
            </button>
          </div>
        )}

        {/* Quick-Start From Template Strip */}
        <div className="template-quickstart-section">
          <div className="section-heading-row">
            <div>
              <span className="section-kicker">Quick Start</span>
              <h3>Start from a curated itinerary</h3>
            </div>
          </div>
          <div className="template-pill-grid">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="template-quick-card"
                disabled={busy}
                onClick={() => createFromTemplate(tpl.id)}
              >
                <div>
                  <strong>{tpl.title}</strong>
                  <span>
                    {countVisitedPlaces(tpl.project.stops)}{" "}
                    {countVisitedPlaces(tpl.project.stops) === 1 ? "place" : "places"} ·{" "}
                    {tpl.project.stops
                      .slice(0, 3)
                      .map((s) => s.name)
                      .join(" → ")}
                  </span>
                </div>
                <span className="hit-add-pill">Use →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
