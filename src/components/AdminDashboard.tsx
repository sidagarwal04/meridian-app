"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageShell } from "./PageShell";
import type { AdminDashboardStats } from "@/lib/telemetry";
import { THEMES, transportMeta, type ThemeId, type Transport } from "@/lib/types";

type DateRangeKey = "7d" | "14d" | "30d" | "90d" | "all";
type ChartMetricKey = "uniqueVisitors" | "pageViews" | "signUps" | "tripsCreated" | "exports";

const METRIC_META: Record<
  ChartMetricKey,
  { label: string; color: string; bgGlow: string; unit: string }
> = {
  uniqueVisitors: {
    label: "Unique Visitors",
    color: "#38bdf8",
    bgGlow: "rgba(56, 189, 248, 0.22)",
    unit: "visitors",
  },
  pageViews: {
    label: "Pageviews",
    color: "#60a5fa",
    bgGlow: "rgba(96, 165, 250, 0.22)",
    unit: "views",
  },
  signUps: {
    label: "New Sign-Ups",
    color: "#818cf8",
    bgGlow: "rgba(129, 140, 248, 0.22)",
    unit: "users",
  },
  tripsCreated: {
    label: "Trips Created",
    color: "#10b981",
    bgGlow: "rgba(16, 185, 129, 0.22)",
    unit: "trips",
  },
  exports: {
    label: "Video Exports",
    color: "#a855f7",
    bgGlow: "rgba(168, 85, 247, 0.22)",
    unit: "exports",
  },
};

function safeTimestamp(ts?: number): number {
  if (!ts) return 0;
  return ts > Date.now() + 86_400_000 * 365 ? Date.now() : ts;
}

function formatTimestamp(ts?: number): string {
  if (!ts) return "—";
  return new Date(safeTimestamp(ts)).toLocaleString(undefined, {
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

function HorizontalBarList({
  items,
  color = "#38bdf8",
  emptyText = "No data yet.",
}: {
  items: { label: string; count: number; badge?: string }[];
  color?: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{emptyText}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((sum, i) => sum + i.count, 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {items.map((item) => {
        const pct = Math.round((item.count / total) * 100);
        const widthPct = Math.max(4, Math.round((item.count / max) * 100));
        return (
          <div key={item.label} style={{ fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
              <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.badge ? <span style={{ marginRight: 6 }}>{item.badge}</span> : null}
                {item.label}
              </span>
              <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                <strong style={{ color: "var(--text)" }}>{item.count.toLocaleString()}</strong> ({pct}%)
              </span>
            </div>
            <div
              style={{
                height: 7,
                borderRadius: 999,
                background: "rgba(148, 163, 184, 0.12)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${widthPct}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: color,
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
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

  // Global & section filters
  const [dateRange, setDateRange] = useState<DateRangeKey>("14d");
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>("pageViews");
  const [chartMode, setChartMode] = useState<"bars" | "area">("bars");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("all");
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>("all");
  const [selectedAspectFilter, setSelectedAspectFilter] = useState<string>("all");
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<string>("all");
  const [onlyActiveDays, setOnlyActiveDays] = useState(false);

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

  const daysWindow = useMemo(() => {
    if (dateRange === "7d") return 7;
    if (dateRange === "14d") return 14;
    if (dateRange === "30d") return 30;
    return 90;
  }, [dateRange]);

  const filteredDailySeries = useMemo(() => {
    const series = stats.dailySeries.slice(-daysWindow);
    return series;
  }, [stats.dailySeries, daysWindow]);

  const rangeTotals = useMemo(() => {
    return filteredDailySeries.reduce(
      (acc, day) => {
        acc.uniqueVisitors += day.uniqueVisitors;
        acc.pageViews += day.pageViews;
        acc.signUps += day.signUps;
        acc.tripsCreated += day.tripsCreated;
        acc.exports += day.exports;
        return acc;
      },
      { uniqueVisitors: 0, pageViews: 0, signUps: 0, tripsCreated: 0, exports: 0 }
    );
  }, [filteredDailySeries]);

  const rangeCutoffMs = useMemo(() => {
    if (dateRange === "all") return 0;
    return Date.now() - daysWindow * 86_400_000;
  }, [dateRange, daysWindow]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    return stats.users.filter((u) => {
      if (selectedUserEmail !== "all" && u.email !== selectedUserEmail) return false;
      if (dateRange !== "all" && safeTimestamp(u.lastSeenAt) < rangeCutoffMs) return false;
      if (!normalizedQuery) return true;
      return (
        u.email.toLowerCase().includes(normalizedQuery) ||
        u.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [stats.users, selectedUserEmail, dateRange, rangeCutoffMs, normalizedQuery]);

  const filteredTrips = useMemo(() => {
    return stats.trips.recent.filter((trip) => {
      if (selectedUserEmail !== "all" && trip.ownerEmail !== selectedUserEmail) return false;
      if (selectedThemeFilter !== "all" && trip.theme !== selectedThemeFilter) return false;
      if (selectedAspectFilter !== "all" && trip.aspect !== selectedAspectFilter) return false;
      if (dateRange !== "all" && safeTimestamp(trip.updatedAt) < rangeCutoffMs) return false;
      if (!normalizedQuery) return true;
      return (
        trip.title.toLowerCase().includes(normalizedQuery) ||
        trip.ownerEmail.toLowerCase().includes(normalizedQuery) ||
        trip.stopNames.some((s) => s.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [
    stats.trips.recent,
    selectedUserEmail,
    selectedThemeFilter,
    selectedAspectFilter,
    dateRange,
    rangeCutoffMs,
    normalizedQuery,
  ]);

  const filteredExports = useMemo(() => {
    return stats.exports.recent.filter((exp) => {
      if (selectedUserEmail !== "all" && (exp.userEmail || "") !== selectedUserEmail) return false;
      if (selectedFormatFilter !== "all" && exp.format.toLowerCase() !== selectedFormatFilter) return false;
      if (selectedAspectFilter !== "all" && exp.aspect !== selectedAspectFilter) return false;
      if (dateRange !== "all" && safeTimestamp(exp.timestamp) < rangeCutoffMs) return false;
      if (!normalizedQuery) return true;
      return (
        (exp.title || "").toLowerCase().includes(normalizedQuery) ||
        (exp.userEmail || "").toLowerCase().includes(normalizedQuery) ||
        exp.format.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [
    stats.exports.recent,
    selectedUserEmail,
    selectedFormatFilter,
    selectedAspectFilter,
    dateRange,
    rangeCutoffMs,
    normalizedQuery,
  ]);

  const { overview } = stats;
  const activeMetricMeta = METRIC_META[chartMetric];
  const maxChartVal = Math.max(1, ...filteredDailySeries.map((d) => d[chartMetric]));

  const hasActiveFilters =
    dateRange !== "all" ||
    Boolean(normalizedQuery) ||
    selectedUserEmail !== "all" ||
    selectedThemeFilter !== "all" ||
    selectedAspectFilter !== "all" ||
    selectedFormatFilter !== "all";

  const resetFilters = () => {
    setDateRange("all");
    setSearchQuery("");
    setSelectedUserEmail("all");
    setSelectedThemeFilter("all");
    setSelectedAspectFilter("all");
    setSelectedFormatFilter("all");
  };

  // Funnel conversion calculations
  const funnelSteps = [
    {
      label: "Unique Visitors",
      value: overview.uniqueVisitors,
      color: "#38bdf8",
      sub: `${overview.totalPageViews.toLocaleString()} pageviews`,
    },
    {
      label: "Signed-Up Users",
      value: overview.totalSignUps,
      color: "#818cf8",
      sub:
        overview.uniqueVisitors > 0
          ? `${Math.min(100, Math.round((overview.totalSignUps / overview.uniqueVisitors) * 100))}% of visitors`
          : "Google OAuth",
    },
    {
      label: "Trips Created",
      value: overview.lifetimeTripsCreated,
      color: "#10b981",
      sub:
        overview.totalSignUps > 0
          ? `${(overview.lifetimeTripsCreated / overview.totalSignUps).toFixed(1)} avg per user`
          : `${overview.activeCloudTrips} active`,
    },
    {
      label: "Video Exports",
      value: overview.totalExports,
      color: "#a855f7",
      sub:
        overview.lifetimeTripsCreated > 0
          ? `${Math.min(100, Math.round((overview.totalExports / overview.lifetimeTripsCreated) * 100))}% of trips exported`
          : "MP4, MOV, WebM, GIF",
    },
  ];
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.value));

  const themeBarItems = Object.entries(stats.trips.byTheme)
    .map(([theme, count]) => ({
      label: THEMES[theme as ThemeId]?.label ?? theme,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const aspectBarItems = Object.entries(stats.trips.byAspect)
    .map(([aspect, count]) => ({
      label: aspect === "16:9" ? "16:9 Landscape" : aspect === "9:16" ? "9:16 Vertical" : "1:1 Square",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const transportBarItems = Object.entries(stats.trips.byTransport)
    .map(([tr, count]) => {
      const meta = transportMeta(tr as Transport);
      return {
        label: meta.label,
        badge: meta.icon,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const exportFormatBarItems = Object.entries(stats.exports.byFormat)
    .map(([fmt, count]) => ({
      label: fmt.toUpperCase(),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const tableDailyRows = useMemo(() => {
    const rows = [...filteredDailySeries].reverse();
    if (!onlyActiveDays) return rows;
    return rows.filter(
      (d) =>
        d.uniqueVisitors > 0 ||
        d.pageViews > 0 ||
        d.signUps > 0 ||
        d.tripsCreated > 0 ||
        d.exports > 0
    );
  }, [filteredDailySeries, onlyActiveDays]);

  return (
    <PageShell>
      <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px 72px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 22,
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
              Last updated {formatTimestamp(stats.generatedAt)} · Lifetime totals retained indefinitely (daily series retained for 365 days)
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

        {/* Interactive Filter Bar */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: "14px 18px",
            marginBottom: 22,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Time Range Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginRight: 4 }}>
              Time Window:
            </span>
            {(
              [
                { id: "7d", label: "Last 7D" },
                { id: "14d", label: "Last 14D" },
                { id: "30d", label: "Last 30D" },
                { id: "90d", label: "Last 90D" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((item) => {
              const active = dateRange === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateRange(item.id)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    border: active ? "1px solid var(--blue)" : "1px solid var(--line)",
                    background: active ? "rgba(56, 189, 248, 0.16)" : "var(--bg-elev)",
                    color: active ? "var(--text)" : "var(--muted)",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Search & Dropdown Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: "1 1 auto", justifyContent: "flex-end" }}>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, trip title, or city…"
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "6px 12px",
                fontSize: 13,
                minWidth: 210,
              }}
            />

            <select
              value={selectedUserEmail}
              onChange={(e) => setSelectedUserEmail(e.target.value)}
              aria-label="Filter by user"
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "6px 10px",
                fontSize: 13,
              }}
            >
              <option value="all">All Users ({stats.users.length})</option>
              {stats.users.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.email} ({u.activeTripsCount} trips)
                </option>
              ))}
            </select>

            <select
              value={selectedThemeFilter}
              onChange={(e) => setSelectedThemeFilter(e.target.value)}
              aria-label="Filter by map theme"
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "6px 10px",
                fontSize: 13,
              }}
            >
              <option value="all">All Themes</option>
              {(Object.keys(THEMES) as ThemeId[]).map((th) => (
                <option key={th} value={th}>
                  {THEMES[th].label}
                </option>
              ))}
            </select>

            <select
              value={selectedAspectFilter}
              onChange={(e) => setSelectedAspectFilter(e.target.value)}
              aria-label="Filter by aspect ratio"
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "6px 10px",
                fontSize: 13,
              }}
            >
              <option value="all">All Layouts</option>
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Vertical</option>
              <option value="1:1">1:1 Square</option>
            </select>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  background: "transparent",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--muted)",
                }}
              >
                × Clear Filters
              </button>
            ) : null}
          </div>
        </div>

        {/* 4 Core KPI Cards (Click any card to focus the chart below) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Card 1: Visitors */}
          <div
            onClick={() => setChartMetric("uniqueVisitors")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setChartMetric("uniqueVisitors")}
            style={{
              background: "var(--bg-card)",
              border:
                chartMetric === "uniqueVisitors" || chartMetric === "pageViews"
                  ? "1px solid #38bdf8"
                  : "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 22px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                1. Site Visitors
              </span>
              <span style={{ fontSize: 20 }}>👀</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {(dateRange === "all" ? overview.uniqueVisitors : rangeTotals.uniqueVisitors).toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              {dateRange === "all" ? (
                <>
                  lifetime unique · <strong style={{ color: "var(--text)" }}>{overview.totalPageViews.toLocaleString()}</strong> pageviews
                </>
              ) : (
                <>
                  in {dateRange.toUpperCase()} ({overview.uniqueVisitors.toLocaleString()} lifetime) ·{" "}
                  <strong style={{ color: "var(--text)" }}>{rangeTotals.pageViews.toLocaleString()}</strong> views
                </>
              )}
            </div>
          </div>

          {/* Card 2: Sign-Ups */}
          <div
            onClick={() => setChartMetric("signUps")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setChartMetric("signUps")}
            style={{
              background: "var(--bg-card)",
              border: chartMetric === "signUps" ? "1px solid #818cf8" : "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 22px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                2. Signed-Up Users
              </span>
              <span style={{ fontSize: 20 }}>👤</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--blue)" }}>
              {(dateRange === "all" ? overview.totalSignUps : rangeTotals.signUps).toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              {dateRange === "all"
                ? `Google OAuth (${stats.users.filter((u) => u.activeTripsCount > 0).length} with saved trips)`
                : `new in ${dateRange.toUpperCase()} (${overview.totalSignUps.toLocaleString()} total accounts)`}
            </div>
          </div>

          {/* Card 3: Trips Created */}
          <div
            onClick={() => setChartMetric("tripsCreated")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setChartMetric("tripsCreated")}
            style={{
              background: "var(--bg-card)",
              border: chartMetric === "tripsCreated" ? "1px solid #10b981" : "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 22px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                3. Trips Created
              </span>
              <span style={{ fontSize: 20 }}>🌍</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#10b981" }}>
              {(dateRange === "all" ? overview.lifetimeTripsCreated : rangeTotals.tripsCreated).toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              <strong style={{ color: "var(--text)" }}>{overview.activeCloudTrips.toLocaleString()}</strong> active in cloud ·{" "}
              <strong style={{ color: "var(--text)" }}>{overview.totalStopsPlotted.toLocaleString()}</strong> stops plotted
            </div>
          </div>

          {/* Card 4: Video Exports */}
          <div
            onClick={() => setChartMetric("exports")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setChartMetric("exports")}
            style={{
              background: "var(--bg-card)",
              border: chartMetric === "exports" ? "1px solid #a855f7" : "1px solid var(--line)",
              borderRadius: 16,
              padding: "20px 22px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                4. Video Exports
              </span>
              <span style={{ fontSize: 20 }}>🎬</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#a855f7" }}>
              {(dateRange === "all" ? overview.totalExports : rangeTotals.exports).toLocaleString()}
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

        {/* Charts Row: Daily Trend Chart + Conversion Funnel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* Daily Trend Chart */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 17 }}>
                    Daily {activeMetricMeta.label} ({daysWindow} Days)
                  </h2>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    Total in window:{" "}
                    <strong style={{ color: activeMetricMeta.color }}>
                      {rangeTotals[chartMetric].toLocaleString()} {activeMetricMeta.unit}
                    </strong>
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setChartMode("bars")}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      borderRadius: 8,
                      border: chartMode === "bars" ? "1px solid var(--blue)" : "1px solid var(--line)",
                      background: chartMode === "bars" ? "rgba(56, 189, 248, 0.15)" : "var(--bg-elev)",
                    }}
                  >
                    📊 Bars
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode("area")}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      borderRadius: 8,
                      border: chartMode === "area" ? "1px solid var(--blue)" : "1px solid var(--line)",
                      background: chartMode === "area" ? "rgba(56, 189, 248, 0.15)" : "var(--bg-elev)",
                    }}
                  >
                    📈 Area
                  </button>
                </div>
              </div>

              {/* Metric Selector Tabs */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                {(Object.keys(METRIC_META) as ChartMetricKey[]).map((key) => {
                  const meta = METRIC_META[key];
                  const isSelected = chartMetric === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setChartMetric(key)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        border: isSelected ? `1px solid ${meta.color}` : "1px solid var(--line)",
                        background: isSelected ? meta.bgGlow : "var(--bg-elev)",
                        color: isSelected ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chart Viewport */}
            {chartMode === "bars" ? (
              <div
                style={{
                  height: 190,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: filteredDailySeries.length > 30 ? 2 : 5,
                  padding: "16px 6px 4px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                {filteredDailySeries.map((day) => {
                  const val = day[chartMetric];
                  const heightPct = val > 0 ? Math.max(8, Math.round((val / maxChartVal) * 100)) : 2;
                  return (
                    <div
                      key={day.date}
                      title={`${formatShortDate(day.date)}: ${val} ${activeMetricMeta.unit}`}
                      style={{
                        flex: 1,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        minWidth: 3,
                      }}
                    >
                      {val > 0 && filteredDailySeries.length <= 14 ? (
                        <span style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>{val}</span>
                      ) : null}
                      <div
                        style={{
                          width: "100%",
                          height: `${heightPct}%`,
                          borderRadius: "4px 4px 0 0",
                          background: val > 0 ? activeMetricMeta.color : "rgba(148, 163, 184, 0.14)",
                          transition: "height 0.25s ease",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ height: 190, padding: "8px 0 4px", borderBottom: "1px solid var(--line)" }}>
                <svg
                  viewBox="0 0 600 170"
                  preserveAspectRatio="none"
                  style={{ width: "100%", height: "100%", overflow: "visible" }}
                >
                  <defs>
                    <linearGradient id="adminChartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={activeMetricMeta.color} stopOpacity="0.45" />
                      <stop offset="100%" stopColor={activeMetricMeta.color} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const n = Math.max(1, filteredDailySeries.length);
                    const pts = filteredDailySeries.map((day, idx) => {
                      const x = n === 1 ? 300 : (idx / (n - 1)) * 580 + 10;
                      const y = 155 - (day[chartMetric] / maxChartVal) * 135;
                      return { x, y, day };
                    });
                    const linePath = pts
                      .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                      .join(" ");
                    const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},162 L${pts[0].x.toFixed(
                      1
                    )},162 Z`;
                    return (
                      <>
                        <path d={areaPath} fill="url(#adminChartAreaGrad)" />
                        <path
                          d={linePath}
                          fill="none"
                          stroke={activeMetricMeta.color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {pts.map((p) =>
                          p.day[chartMetric] > 0 ? (
                            <circle
                              key={p.day.date}
                              cx={p.x}
                              cy={p.y}
                              r={filteredDailySeries.length > 30 ? 2.5 : 4}
                              fill={activeMetricMeta.color}
                            >
                              <title>{`${formatShortDate(p.day.date)}: ${p.day[chartMetric]} ${activeMetricMeta.unit}`}</title>
                            </circle>
                          ) : null
                        )}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 8,
              }}
            >
              <span>{filteredDailySeries[0] ? formatShortDate(filteredDailySeries[0].date) : ""}</span>
              <span>
                {filteredDailySeries[Math.floor(filteredDailySeries.length / 2)]
                  ? formatShortDate(filteredDailySeries[Math.floor(filteredDailySeries.length / 2)].date)
                  : ""}
              </span>
              <span>
                {filteredDailySeries[filteredDailySeries.length - 1]
                  ? formatShortDate(filteredDailySeries[filteredDailySeries.length - 1].date)
                  : ""}
              </span>
            </div>
          </section>

          {/* Conversion Funnel & Distribution Charts */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Conversion Funnel (Lifetime)</h2>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--muted)" }}>
              Visitor → Sign-Up → Trip Created → Video Export progression
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {funnelSteps.map((step, index) => {
                const widthPct = step.value > 0 ? Math.max(8, Math.round((step.value / funnelMax) * 100)) : 3;
                return (
                  <div key={step.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>
                        {index + 1}. {step.label}
                      </span>
                      <span>
                        <strong style={{ fontSize: 15 }}>{step.value.toLocaleString()}</strong>{" "}
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>({step.sub})</span>
                      </span>
                    </div>
                    <div
                      style={{
                        height: 12,
                        borderRadius: 999,
                        background: "rgba(148, 163, 184, 0.12)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${widthPct}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: step.color,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Visual Distribution Charts: Themes, Layouts, Transports, Top Pages */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
            gap: 18,
            marginBottom: 24,
          }}
        >
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Map Theme Popularity</h3>
            <HorizontalBarList items={themeBarItems} color="#38bdf8" />
          </section>

          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Aspect Ratio &amp; Export Formats</h3>
            <HorizontalBarList items={aspectBarItems} color="#10b981" />
            {exportFormatBarItems.length > 0 ? (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>
                  Downloaded File Formats
                </div>
                <HorizontalBarList items={exportFormatBarItems} color="#a855f7" />
              </div>
            ) : null}
          </section>

          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Transport Modes Plotted</h3>
            <HorizontalBarList items={transportBarItems.slice(0, 6)} color="#f59e0b" />
          </section>

          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Top Visited Routes</h3>
            <HorizontalBarList
              items={stats.pageViewsByPath.slice(0, 6).map((p) => ({ label: p.path, count: p.count }))}
              color="#6366f1"
              emptyText="Pageview breakdown will populate as visitors browse."
            />
          </section>
        </div>

        {/* Two-Column Filtered Lists: Signed-up Users & Cloud Trips */}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>
                Signed-Up Users ({filteredUsers.length}
                {filteredUsers.length !== stats.users.length ? ` of ${stats.users.length}` : ""})
              </h2>
              {selectedUserEmail !== "all" ? (
                <button
                  type="button"
                  onClick={() => setSelectedUserEmail("all")}
                  style={{
                    fontSize: 12,
                    background: "transparent",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "3px 8px",
                    color: "var(--muted)",
                  }}
                >
                  Show all users
                </button>
              ) : (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Click a user to filter their trips</span>
              )}
            </div>
            {filteredUsers.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                No users match the current filter.
              </p>
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
                    {filteredUsers.map((u) => {
                      const isSelected = selectedUserEmail === u.email;
                      return (
                        <tr
                          key={u.email}
                          onClick={() => setSelectedUserEmail(isSelected ? "all" : u.email)}
                          style={{
                            borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
                            cursor: "pointer",
                            background: isSelected ? "rgba(56, 189, 248, 0.12)" : "transparent",
                          }}
                        >
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Filtered Trips */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>
              Cloud Trips ({filteredTrips.length}
              {filteredTrips.length !== stats.trips.recent.length ? ` of ${stats.trips.recent.length}` : ""})
            </h2>
            {filteredTrips.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                No cloud trips match the current filter.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
                {filteredTrips.map((trip) => (
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

        {/* Video Exports Log + Daily Table */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>
                Video Exports Log ({filteredExports.length})
              </h2>
              <select
                value={selectedFormatFilter}
                onChange={(e) => setSelectedFormatFilter(e.target.value)}
                aria-label="Filter exports by format"
                style={{
                  background: "var(--bg-elev)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "4px 8px",
                  fontSize: 12,
                }}
              >
                <option value="all">All Formats</option>
                <option value="mp4">MP4</option>
                <option value="mov">MOV</option>
                <option value="webm">WebM</option>
                <option value="gif">GIF</option>
              </select>
            </div>
            {filteredExports.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                {overview.totalExports === 0
                  ? "No exports recorded yet. Every time a user downloads an MP4, MOV, WebM, or GIF in Studio, it will appear here."
                  : "No exports match the current filter."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {filteredExports.map((exp) => (
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

          {/* Daily Activity Breakdown Table */}
          <section
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Daily Breakdown ({daysWindow}D)</h2>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={onlyActiveDays}
                  onChange={(e) => setOnlyActiveDays(e.target.checked)}
                />
                Hide zero-activity days
              </label>
            </div>
            <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "8px 8px" }}>Date</th>
                    <th style={{ padding: "8px 8px" }}>Visitors</th>
                    <th style={{ padding: "8px 8px" }}>Views</th>
                    <th style={{ padding: "8px 8px" }}>Sign-Ups</th>
                    <th style={{ padding: "8px 8px" }}>Trips</th>
                    <th style={{ padding: "8px 8px" }}>Exports</th>
                  </tr>
                </thead>
                <tbody>
                  {tableDailyRows.map((day) => {
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
                          opacity: hasActivity ? 1 : 0.5,
                        }}
                      >
                        <td style={{ padding: "8px 8px", fontWeight: 600 }}>{formatShortDate(day.date)}</td>
                        <td style={{ padding: "8px 8px" }}>{day.uniqueVisitors}</td>
                        <td style={{ padding: "8px 8px" }}>{day.pageViews}</td>
                        <td style={{ padding: "8px 8px", color: day.signUps > 0 ? "var(--blue)" : undefined }}>
                          {day.signUps}
                        </td>
                        <td style={{ padding: "8px 8px", color: day.tripsCreated > 0 ? "#10b981" : undefined }}>
                          {day.tripsCreated}
                        </td>
                        <td style={{ padding: "8px 8px", color: day.exports > 0 ? "#a855f7" : undefined }}>
                          {day.exports}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
