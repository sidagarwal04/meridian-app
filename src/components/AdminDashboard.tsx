"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell } from "./PageShell";
import type { AdminDashboardStats } from "@/lib/telemetry";
import { THEMES, transportMeta, type ThemeId, type Transport } from "@/lib/types";

function formatTimestamp(ts?: number): string {
  if (!ts) return "—";
  // Guard against synthetic future dates in dev seed files
  const safeTs = ts > Date.now() + 86_400_000 * 365 ? Date.now() : ts;
  return new Date(safeTs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function AdminDashboard({
  initialStats,
  adminEmail,
}: {
  initialStats: AdminDashboardStats;
  adminEmail: string;
}) {
  const [stats, setStats] = useState<AdminDashboardStats>(initialStats);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as AdminDashboardStats;
        setStats(next);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const { overview } = stats;

  return (
    <PageShell>
      <div className="page" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 20px 72px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="hero-badge">
                <span className="badge-dot" /> 🔒 Private Admin Telemetry
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  background: "rgba(15, 23, 42, 0.7)",
                  border: "1px solid var(--line)",
                  padding: "4px 10px",
                  borderRadius: 999,
                }}
              >
                Restricted to {adminEmail} · Non-indexable &amp; non-shareable
              </span>
            </div>
            <h1 style={{ textAlign: "left", margin: "12px 0 6px", fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)" }}>
              Meridian Usage &amp; Telemetry
            </h1>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
              Live metrics from Netlify Blobs (`meridian-projects` &amp; `meridian-telemetry`) · Last updated{" "}
              {formatTimestamp(stats.generatedAt)}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" className="btn ghost sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "↻ Refresh Stats"}
            </button>
            <Link href="/videos" className="btn primary sm">
              Open Studio Library →
            </Link>
          </div>
        </div>

        {/* 4 Core KPI Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 22px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                1. Site Visitors
              </span>
              <span style={{ fontSize: 20 }}>👀</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {overview.uniqueVisitors.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              unique visitors · <strong style={{ color: "var(--text)" }}>{overview.totalPageViews.toLocaleString()}</strong> total pageviews
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 22px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                2. Signed-Up Users
              </span>
              <span style={{ fontSize: 20 }}>👤</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--blue)" }}>
              {overview.totalSignUps.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              Google OAuth accounts ({stats.users.filter((u) => u.activeTripsCount > 0).length} with saved trips)
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 22px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                3. Trips Created
              </span>
              <span style={{ fontSize: 20 }}>🌍</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#10b981" }}>
              {overview.lifetimeTripsCreated.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              <strong style={{ color: "var(--text)" }}>{overview.activeCloudTrips.toLocaleString()}</strong> active in cloud ·{" "}
              <strong style={{ color: "var(--text)" }}>{overview.totalStopsPlotted.toLocaleString()}</strong> stops plotted
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 22px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                4. Video Exports
              </span>
              <span style={{ fontSize: 20 }}>🎬</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#a855f7" }}>
              {overview.totalExports.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              {Object.keys(stats.exports.byFormat).length > 0
                ? Object.entries(stats.exports.byFormat)
                    .map(([fmt, count]) => `${fmt.toUpperCase()}: ${count}`)
                    .join(" · ")
                : "Tracks MP4, MOV, WebM & GIF downloads"}
            </div>
          </div>
        </div>

        {/* 14-Day Activity Table */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Last 14 Days Activity (UTC)</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Daily breakdown across all 4 metrics</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "8px 10px" }}>Date</th>
                  <th style={{ padding: "8px 10px" }}>Unique Visitors</th>
                  <th style={{ padding: "8px 10px" }}>Pageviews</th>
                  <th style={{ padding: "8px 10px" }}>New Sign-Ups</th>
                  <th style={{ padding: "8px 10px" }}>Trips Created</th>
                  <th style={{ padding: "8px 10px" }}>Video Exports</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.dailySeries].reverse().map((day) => {
                  const hasActivity =
                    day.uniqueVisitors > 0 ||
                    day.pageViews > 0 ||
                    day.signUps > 0 ||
                    day.tripsCreated > 0 ||
                    day.exports > 0;
                  return (
                    <tr
                      key={day.date}
                      style={{
                        borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
                        opacity: hasActivity ? 1 : 0.55,
                      }}
                    >
                      <td style={{ padding: "9px 10px", fontWeight: 600 }}>{formatShortDate(day.date)}</td>
                      <td style={{ padding: "9px 10px" }}>{day.uniqueVisitors}</td>
                      <td style={{ padding: "9px 10px" }}>{day.pageViews}</td>
                      <td style={{ padding: "9px 10px", color: day.signUps > 0 ? "var(--blue)" : undefined }}>
                        {day.signUps}
                      </td>
                      <td style={{ padding: "9px 10px", color: day.tripsCreated > 0 ? "#10b981" : undefined }}>
                        {day.tripsCreated}
                      </td>
                      <td style={{ padding: "9px 10px", color: day.exports > 0 ? "#a855f7" : undefined }}>
                        {day.exports}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Two-Column Breakdown: Signed-up Users & Recent Trips */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* Signed-Up Users */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>
              Signed-Up Users ({stats.users.length})
            </h2>
            {stats.users.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No signed-up users recorded yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                      <th style={{ padding: "8px 8px" }}>User</th>
                      <th style={{ padding: "8px 8px" }}>Trips</th>
                      <th style={{ padding: "8px 8px" }}>Stops</th>
                      <th style={{ padding: "8px 8px" }}>Sign-ins</th>
                      <th style={{ padding: "8px 8px" }}>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.users.map((u) => (
                      <tr key={u.email} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                        <td style={{ padding: "9px 8px" }}>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</div>
                        </td>
                        <td style={{ padding: "9px 8px", fontWeight: 600 }}>{u.activeTripsCount}</td>
                        <td style={{ padding: "9px 8px" }}>{u.totalStopsCount}</td>
                        <td style={{ padding: "9px 8px" }}>{u.signInCount}</td>
                        <td style={{ padding: "9px 8px", fontSize: 12, color: "var(--muted)" }}>
                          {formatTimestamp(u.lastSeenAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent Trips Created */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>
              Cloud Trips ({stats.trips.recent.length})
            </h2>
            {stats.trips.recent.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No cloud trips saved yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {stats.trips.recent.map((trip) => (
                  <div
                    key={`${trip.ownerEmail}-${trip.id}`}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "var(--bg-elev)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                      <strong>{trip.title}</strong>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {trip.stopsCount} stops · {THEMES[trip.theme as ThemeId]?.label ?? trip.theme} · {trip.aspect}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      {trip.stopNames.slice(0, 6).join(" → ")}
                      {trip.stopNames.length > 6 ? ` (+${trip.stopNames.length - 6} more)` : ""}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 6,
                      }}
                    >
                      <span>Owner: {trip.ownerEmail}</span>
                      <span>Updated {formatTimestamp(trip.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Exports, Styles & Traffic Breakdown */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {/* Recent Video Exports */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>
              Recent Video Exports ({overview.totalExports})
            </h2>
            {stats.exports.recent.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                No exports recorded yet. Every time a user downloads an MP4, MOV, WebM, or GIF in Studio, it will appear here.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stats.exports.recent.map((exp) => (
                  <div
                    key={exp.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "var(--bg-elev)",
                      border: "1px solid var(--line)",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                      <span>{exp.title || "Untitled trip"}</span>
                      <span style={{ color: "#a855f7" }}>
                        {exp.format.toUpperCase()} · {exp.aspect} · {exp.resolution}p@{exp.fps}fps
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 4,
                      }}
                    >
                      <span>
                        {exp.userEmail || "Anonymous"} · {exp.stopsCount} stops
                      </span>
                      <span>{formatTimestamp(exp.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Route Themes, Aspect Ratios & Transports */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Trip Preferences</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }}>
              <div>
                <div style={{ color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>Map Themes</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(stats.trips.byTheme).map(([theme, count]) => (
                    <span
                      key={theme}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "var(--bg-elev)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      {THEMES[theme as ThemeId]?.label ?? theme}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>Aspect Ratios</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(stats.trips.byAspect).map(([aspect, count]) => (
                    <span
                      key={aspect}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "var(--bg-elev)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      {aspect}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>Transport Modes Used</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(stats.trips.byTransport).map(([tr, count]) => {
                    const meta = transportMeta(tr as Transport);
                    return (
                      <span
                        key={tr}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "var(--bg-elev)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        {meta.icon} {meta.label}: <strong>{count}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Top Visited Pages & Referrers */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Top Pages &amp; Referrers</h2>
            {stats.pageViewsByPath.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                Pageview breakdown will populate as visitors browse the site.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                {stats.pageViewsByPath.map((row) => (
                  <div
                    key={row.path}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "var(--bg-elev)",
                    }}
                  >
                    <code>{row.path}</code>
                    <strong>{row.count.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            )}

            {stats.topReferrers.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: "var(--muted)", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  External Referrers
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  {stats.topReferrers.map((ref) => (
                    <div
                      key={ref.host}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: "var(--bg-elev)",
                      }}
                    >
                      <span>{ref.host}</span>
                      <strong>{ref.count.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
