"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchCities } from "@/lib/cities";
import { flagEmoji, haversineKm, nearestCity } from "@/lib/geo";
import { parseGeoJson, parseGpx, parseItinerary, parseKml, placesFromGoogleUrl, simplifyTrack } from "@/lib/parse";
import { encodeRoute } from "@/lib/share";
import { getProject, saveProject } from "@/lib/storage";
import { TEMPLATES } from "@/lib/templates";
import {
  THEMES,
  TRANSPORTS,
  applyTheme,
  legAllowed,
  limitsFor,
  makeStop,
  starterStops,
  uid,
  type Leg,
  type Project,
  type Stop,
  type ThemeId,
  type Transport,
} from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { GlobeStage, type GlobeHandle } from "./GlobeStage";
import { Logo } from "./Logo";
import { MapEditor } from "./MapEditor";

type Tab = "route" | "photos" | "options" | "music";
type StageMode = "map" | "globe";
type PlaceHit = { name: string; country: string; code: string; lat: number; lon: number; label?: string };

function normalizeLegs(stops: Stop[], legs: Leg[]): Leg[] {
  const needed = Math.max(0, stops.length - 1);
  return Array.from({ length: needed }, (_, i) => ({
    transport: legs[i]?.transport ?? "plane",
  }));
}

function sanitizeProject(project: Project): Project {
  const validStops = (project.stops ?? []).filter(
    (s) =>
      s &&
      typeof s.lat === "number" &&
      typeof s.lon === "number" &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lon) &&
      Math.abs(s.lat) <= 85.5 &&
      Math.abs(s.lon) <= 180
  );
  const stops = validStops.length > 0 ? validStops : starterStops();
  const legs = normalizeLegs(stops, project.legs ?? []);
  return {
    ...project,
    stops,
    legs,
  };
}

export function Studio() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>("route");
  const [stageMode, setStageMode] = useState<StageMode>("map");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [notice, setNotice] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [itinerary, setItinerary] = useState("");
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lock, setLock] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [showImports, setShowImports] = useState(false);
  const globe = useRef<GlobeHandle>(null);
  const inlineGlobe = useRef<GlobeHandle>(null);
  const limits = limitsFor(null);
  const booted = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=/studio/${params.id}`);
      return;
    }
    getProject(params.id).then((found) => {
      if (!found) router.replace("/videos");
      else {
        setProject(sanitizeProject(found));
        booted.current = true;
      }
    });
  }, [ready, user, params.id, router]);

  useEffect(() => {
    if (!booted.current || !project) return;
    const timer = window.setTimeout(() => saveProject(project), 400);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const local = searchCities(q).map((city) => ({ ...city }));
    setHits(local);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const remote = (await res.json()) as PlaceHit[];
        const merged = [...local];
        remote.forEach((item) => {
          if (!merged.some((hit) => hit.name === item.name && Math.abs(hit.lat - item.lat) < 0.2)) merged.push(item);
        });
        setHits(merged.slice(0, 6));
      } catch {
        /* local results remain */
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  const photoCount = project?.stops.reduce((sum, stop) => sum + stop.photos.length, 0) ?? 0;

  const totalDistanceKm = useMemo(() => {
    if (!project || project.stops.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < project.stops.length; i++) {
      sum += haversineKm(project.stops[i - 1], project.stops[i]);
    }
    return Math.round(sum);
  }, [project]);

  const pinnedStopsCount = useMemo(
    () => project?.stops.filter((s) => s.name === "Pinned place").length ?? 0,
    [project]
  );

  if (!project) {
    return (
      <div className="studio-loading">
        <div className="loading-spinner" />
        <p>Opening studio…</p>
      </div>
    );
  }

  const update = (patch: Partial<Project> | ((current: Project) => Project)) => {
    setProject((current) => {
      if (!current) return current;
      return typeof patch === "function" ? patch(current) : { ...current, ...patch };
    });
  };

  const addStop = (place: PlaceHit) => {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return;
    const safeLat = Math.max(-85, Math.min(85, place.lat));
    const safeLon = Math.max(-180, Math.min(180, place.lon));
    if (project.stops.length >= limits.maxStops) {
      setLock(`A route can hold ${limits.maxStops} places.`);
      return;
    }
    update((current) => {
      const stops = [...current.stops, makeStop({ ...place, lat: safeLat, lon: safeLon })];
      return {
        ...current,
        stops,
        legs: normalizeLegs(stops, [...current.legs, { transport: "plane" }]),
      };
    });
    setQuery("");
    setHits([]);
    setNotice("");
  };

  const addAt = async (lat: number, lon: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85.5 || Math.abs(lon) > 180) {
      return;
    }
    const near = nearestCity(lat, lon, 45);
    let place: PlaceHit = near
      ? { ...near }
      : { name: "Pinned place", country: "", code: "", lat, lon };
    if (!near) {
      try {
        const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
        if (res.ok) {
          const data = (await res.json()) as PlaceHit;
          if (data.name) place = { ...place, ...data, lat, lon };
        }
      } catch {
        /* pinned coordinates still work */
      }
    }
    addStop({ ...place, lat, lon });
  };

  const removeStop = (index: number) => {
    update((current) => {
      const stops = current.stops.filter((_, stopIndex) => stopIndex !== index);
      const legs = [...current.legs];
      if (index < legs.length) legs.splice(index, 1);
      else if (legs.length) legs.splice(index - 1, 1);
      return { ...current, stops, legs: normalizeLegs(stops, legs) };
    });
  };

  const moveStopTo = (fromIndex: number, toIndex: number) => {
    update((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.stops.length ||
        toIndex >= current.stops.length
      ) {
        return current;
      }
      const stops = [...current.stops];
      const [moved] = stops.splice(fromIndex, 1);
      stops.splice(toIndex, 0, moved);
      return {
        ...current,
        stops,
        legs: normalizeLegs(stops, current.legs),
      };
    });
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    moveStopTo(index, index + dir);
  };

  const reverseStops = () => {
    update((current) => {
      if (current.stops.length < 2) return current;
      const stops = [...current.stops].reverse();
      const legs = [...current.legs].reverse();
      return { ...current, stops, legs: normalizeLegs(stops, legs) };
    });
    setNotice("Reversed route order.");
  };

  const clearAllStops = () => {
    update((current) => ({
      ...current,
      stops: [],
      legs: [],
    }));
    setNotice("Cleared all places. Search or click the map to add stops.");
  };

  const removePinnedStops = () => {
    update((current) => {
      const stops = current.stops.filter((s) => s.name !== "Pinned place");
      return {
        ...current,
        stops,
        legs: normalizeLegs(stops, current.legs),
      };
    });
    setNotice("Removed accidental pinned places.");
  };

  const resetStarterRoute = () => {
    const stops = starterStops();
    update((current) => ({
      ...current,
      stops,
      legs: normalizeLegs(stops, []),
    }));
    setNotice("Restored starter route (Lisbon → Paris → Rome).");
  };

  const updateStopCoord = async (index: number, coord: { lat: number; lon: number }) => {
    const near = nearestCity(coord.lat, coord.lon, 45);
    update((current) => ({
      ...current,
      stops: current.stops.map((s, i) =>
        i === index
          ? {
              ...s,
              lat: coord.lat,
              lon: coord.lon,
              ...(near ? { name: near.name, country: near.country, code: near.code } : {}),
            }
          : s
      ),
    }));
  };

  const setTransport = (index: number, transport: Transport) => {
    if (!legAllowed(transport, limits.pro)) {
      setLock("Land and sea icons are part of Pro. Airplane, line, and dots stay on the free plan.");
      return;
    }
    update((current) => ({
      ...current,
      legs: current.legs.map((leg, legIndex) => (legIndex === index ? { transport } : leg)),
    }));
  };

  const applyTemplate = (id: string) => {
    const template = TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    if (!limits.pro && template.project.stops.length > limits.maxStops) {
      setLock("That template has more places than the free plan allows.");
      return;
    }
    const transports = template.project.legs.map((leg) => (legAllowed(leg.transport, limits.pro) ? leg.transport : "plane"));
    update((current) => ({
      ...current,
      title: template.project.title,
      stops: template.project.stops.map((stop) => ({ ...stop, id: uid("stop"), photos: [] })),
      legs: transports.map((transport) => ({ transport })),
      style: limits.pro ? { ...current.style, ...themeColors(template.project.style.theme) } : current.style,
    }));
    setNotice(`Loaded “${template.title}”.`);
  };

  const importText = async (text: string, kind: "gpx" | "kml" | "geo" | "auto") => {
    if (!limits.gpx) {
      setLock("That file could not be imported.");
      return;
    }
    let points: { lat: number; lon: number; name: string }[] = [];
    try {
      if (kind === "gpx" || text.includes("<gpx")) points = parseGpx(text);
      else if (kind === "kml" || text.includes("<kml")) points = parseKml(text);
      else points = parseGeoJson(text);
    } catch {
      setNotice("That file could not be read.");
      return;
    }
    const thinned = simplifyTrack(points, limits.maxStops);
    if (thinned.length < 2) {
      setNotice("Need at least two points in that file.");
      return;
    }
    const stops: Stop[] = thinned.map((point, index) => {
      const near = nearestCity(point.lat, point.lon, 80);
      return makeStop({
        name: point.name || near?.name || `Point ${index + 1}`,
        country: near?.country ?? "",
        code: near?.code ?? "",
        lat: point.lat,
        lon: point.lon,
      });
    });
    update({
      stops,
      legs: stops.slice(1).map(() => ({ transport: "plane" as Transport })),
    });
    setNotice(`Imported ${stops.length} places.`);
  };

  const importMaps = async () => {
    const names = placesFromGoogleUrl(mapsUrl);
    if (!names?.length) {
      setNotice("Paste a Google Maps directions link.");
      return;
    }
    await geocodeNames(names.map((name) => ({ name })));
  };

  const importItinerary = async () => {
    const parsed = parseItinerary(itinerary);
    if (parsed.length < 2) {
      setNotice("Add at least two places, one per line.");
      return;
    }
    await geocodeNames(parsed);
  };

  const geocodeNames = async (items: { name: string; via?: Transport }[]) => {
    const stops: Stop[] = [];
    const missed: string[] = [];
    for (const item of items) {
      const local = searchCities(item.name)[0];
      if (local && local.name.toLowerCase().startsWith(item.name.toLowerCase().slice(0, 4))) {
        stops.push(makeStop(local));
        continue;
      }
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(item.name)}`);
        const data = res.ok ? ((await res.json()) as PlaceHit[]) : [];
        if (data[0]) stops.push(makeStop(data[0]));
        else if (local) stops.push(makeStop(local));
        else missed.push(item.name);
      } catch {
        if (local) stops.push(makeStop(local));
        else missed.push(item.name);
      }
      if (stops.length >= limits.maxStops) break;
    }
    if (stops.length < 2) {
      setNotice(missed.length ? `Couldn't find ${missed.join(", ")}.` : "Need at least two places.");
      return;
    }
    const legs = stops.slice(1).map((_, index) => {
      const via = items[index + 1]?.via ?? "plane";
      return { transport: legAllowed(via, limits.pro) ? via : ("plane" as Transport) };
    });
    update({ stops, legs });
    setNotice(missed.length ? `Skipped ${missed.join(", ")}.` : `Added ${stops.length} places.`);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    const kind = lower.endsWith(".gpx") ? "gpx" : lower.endsWith(".kml") ? "kml" : "geo";
    await importText(text, kind);
  };

  const addPhotos = async (index: number, files: FileList) => {
    const room = limits.maxPhotos - photoCount;
    if (room <= 0) {
      setLock(`Photo limit reached (${limits.maxPhotos}).`);
      return;
    }
    const chosen = [...files].slice(0, room);
    const encoded = await Promise.all(chosen.map(compress));
    update((current) => ({
      ...current,
      stops: current.stops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, photos: [...stop.photos, ...encoded].slice(0, 4) } : stop
      ),
    }));
  };

  const share = async () => {
    const url = `${window.location.origin}/r/${encodeRoute(project)}`;
    await navigator.clipboard.writeText(url);
    setNotice("Share link copied. Photos stay on this device; the link carries the route.");
  };

  const renderVideo = async () => {
    if (project.stops.length < 2) {
      setNotice("Add at least two places.");
      return;
    }
    setExporting(true);
    setProgress(0);
    try {
      const blob = await globe.current?.record();
      if (!blob) throw new Error("empty");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slugify(project.title)}.webm`;
      anchor.click();
      setNotice("Video downloaded.");
    } catch {
      setNotice("This browser couldn't record the canvas. Try Chrome or Safari, then export again.");
    } finally {
      setExporting(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: "route", label: "Route", icon: "📍", badge: project.stops.length },
    { id: "photos", label: "Photos", icon: "🖼", badge: photoCount || undefined },
    { id: "options", label: "Style", icon: "🎨" },
    { id: "music", label: "Audio", icon: "🎵" },
  ];

  return (
    <div className="studio">
      <header className="studio-top">
        <div className="studio-top-left">
          <Logo />
          <span className="studio-divider" />
          <div className="title-input-wrap">
            <input
              className="title-input"
              aria-label="Video title"
              placeholder="Untitled trip…"
              value={project.title}
              onChange={(event) => update({ title: event.target.value })}
            />
          </div>
        </div>

        <div className="studio-stage-toggle" role="group" aria-label="Workspace view">
          <button
            type="button"
            className={stageMode === "map" ? "active" : ""}
            onClick={() => setStageMode("map")}
          >
            🗺 2D Map Editor
          </button>
          <button
            type="button"
            className={stageMode === "globe" ? "active" : ""}
            onClick={() => setStageMode("globe")}
          >
            🌍 3D Globe Live
          </button>
        </div>

        <div className="studio-top-right">
          <span className="credits-badge">
            {project.stops.length} stops · {totalDistanceKm.toLocaleString()} km
          </span>
          <button className="btn ghost sm" onClick={share} title="Copy shareable route link">
            Share
          </button>
          <button className="btn ghost sm" onClick={() => setPreview(true)}>
            ▶ Preview
          </button>
          <button className="btn primary sm" onClick={() => setPreview(true)}>
            Export Video
          </button>
          <Link href="/videos" className="btn ghost sm">
            Library
          </Link>
        </div>
      </header>

      <div className="studio-main">
        <aside className="studio-side">
          <div className="tabs" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "on" : ""}
                onClick={() => setTab(item.id)}
              >
                <span className="tab-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge !== undefined ? <span className="tab-badge">{item.badge}</span> : null}
              </button>
            ))}
          </div>

          {notice ? (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button type="button" className="notice-dismiss" aria-label="Dismiss notice" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          ) : null}

          {tab === "route" ? (
            <div className="side-body">
              {/* Place Search Box */}
              <div className="search-card">
                <label className="field">
                  <span className="field-label">Add a destination</span>
                  <div className="search-input-wrap">
                    <span className="search-icon" aria-hidden="true">🔍</span>
                    <input
                      value={query}
                      placeholder="Search city, landmark, or place…"
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    {query ? (
                      <button
                        type="button"
                        className="search-clear"
                        aria-label="Clear search"
                        onClick={() => {
                          setQuery("");
                          setHits([]);
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </label>
                {hits.length ? (
                  <ul className="hits">
                    {hits.map((hit) => (
                      <li key={`${hit.name}-${hit.lat}-${hit.lon}`}>
                        <button type="button" onClick={() => addStop(hit)}>
                          <div className="hit-main">
                            <strong>
                              {hit.code ? `${flagEmoji(hit.code)} ` : ""}
                              {hit.name}
                            </strong>
                            <span>{hit.label || hit.country}</span>
                          </div>
                          <span className="hit-add-pill">＋ Add</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {/* Route Stops Header + Bulk Actions */}
              <div className="stops-section-header">
                <div className="stops-title-group">
                  <h3>Your Route</h3>
                  <span className="stops-counter">
                    {project.stops.length} / {limits.maxStops}
                  </span>
                </div>
                <div className="stops-bulk-actions">
                  {project.stops.length > 1 ? (
                    <button
                      type="button"
                      className="mini-action-btn"
                      onClick={reverseStops}
                      title="Reverse the order of all stops"
                    >
                      ⇄ Reverse
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="mini-action-btn"
                    onClick={resetStarterRoute}
                    title="Reset to Lisbon → Paris → Rome"
                  >
                    ↺ Reset
                  </button>
                  {project.stops.length > 0 ? (
                    <button
                      type="button"
                      className="mini-action-btn danger"
                      onClick={clearAllStops}
                      title="Remove all places from route"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Helpful banner if accidental map pins exist */}
              {pinnedStopsCount > 0 ? (
                <div className="pinned-cleanup-banner">
                  <span>
                    {pinnedStopsCount} map-clicked {pinnedStopsCount === 1 ? "pin" : "pins"} in route
                  </span>
                  <button type="button" onClick={removePinnedStops}>
                    Remove {pinnedStopsCount === 1 ? "it" : "all"} ×
                  </button>
                </div>
              ) : null}

              <p className="hint">
                Drag stops by <strong>⋮⋮</strong> or use <strong>↑ ↓</strong> to reorder, and click <strong>×</strong> to remove.
              </p>

              {/* Interactive Draggable Stop List */}
              {project.stops.length > 0 ? (
                <ol className="stop-list">
                  {project.stops.map((stop, index) => (
                    <li
                      key={stop.id}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (dropIndex !== index) setDropIndex(index);
                      }}
                      onDragLeave={() => setDropIndex((curr) => (curr === index ? null : curr))}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragIndex !== null && dragIndex !== index) {
                          moveStopTo(dragIndex, index);
                        }
                        setDragIndex(null);
                        setDropIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDropIndex(null);
                      }}
                      className={`stop-item ${dragIndex === index ? "dragging" : ""} ${
                        dropIndex === index ? "drop-over" : ""
                      }`}
                    >
                      <div className="stop-row">
                        <span className="drag-handle" title="Drag to reorder stop" aria-hidden="true">
                          ⋮⋮
                        </span>
                        <span
                          className={`idx ${
                            index === 0 ? "start" : index === project.stops.length - 1 ? "end" : ""
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="stop-info">
                          <strong>
                            {stop.code ? `${flagEmoji(stop.code)} ` : ""}
                            {stop.name}
                          </strong>
                          <small>
                            {stop.country || `${stop.lat.toFixed(2)}°, ${stop.lon.toFixed(2)}°`}
                          </small>
                        </div>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="action-btn"
                            aria-label="Move up"
                            title="Move stop up"
                            onClick={() => moveStop(index, -1)}
                            disabled={index === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            aria-label="Move down"
                            title="Move stop down"
                            onClick={() => moveStop(index, 1)}
                            disabled={index === project.stops.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="action-btn remove-btn"
                            aria-label="Remove"
                            title={`Remove ${stop.name}`}
                            onClick={() => removeStop(index)}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {project.legs[index] ? (
                        <div className="leg-connector">
                          <span className="leg-line" aria-hidden="true" />
                          <label className="leg-select-wrap">
                            <span className="sr-only">Transport to next stop</span>
                            <select
                              aria-label="Transport to next stop"
                              value={project.legs[index].transport}
                              onChange={(event) => setTransport(index, event.target.value as Transport)}
                            >
                              {TRANSPORTS.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.icon} {item.label}
                                  {item.tier === "pro" && !limits.pro ? " · Pro" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          {project.stops[index + 1] ? (
                            <span className="leg-distance">
                              {Math.round(haversineKm(stop, project.stops[index + 1])).toLocaleString()} km
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty-stops-card">
                  <p>Your route is empty.</p>
                  <span>Search for a city above, click on the map, or load a ready-made template below.</span>
                  <button type="button" className="btn ghost sm" onClick={resetStarterRoute}>
                    Load starter route
                  </button>
                </div>
              )}

              {/* Templates & Import Section */}
              <div className="side-divider" />

              <label className="field">
                <span className="field-label">Ready-made route templates</span>
                <select defaultValue="" onChange={(event) => event.target.value && applyTemplate(event.target.value)}>
                  <option value="">Choose a curated route…</option>
                  {TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title} ({template.project.stops.length} stops)
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="import-accordion-btn"
                aria-expanded={showImports}
                onClick={() => setShowImports((v) => !v)}
              >
                <span>📥 Import from text, Google Maps, or GPX/KML</span>
                <span>{showImports ? "▾" : "▸"}</span>
              </button>

              {showImports ? (
                <div className="import-panel">
                  <label className="field">
                    <span className="field-label">Describe the trip (one stop per line)</span>
                    <textarea
                      rows={4}
                      placeholder={"Lisbon\nTrain to Madrid\nFlight to Rome\nBoat to Athens"}
                      value={itinerary}
                      onChange={(event) => setItinerary(event.target.value)}
                    />
                  </label>
                  <button className="btn ghost wide sm" onClick={importItinerary}>
                    Build route from text
                  </button>
                  <label className="field">
                    <span className="field-label">Google Maps directions link</span>
                    <input
                      value={mapsUrl}
                      placeholder="https://www.google.com/maps/dir/..."
                      onChange={(event) => setMapsUrl(event.target.value)}
                    />
                  </label>
                  <button className="btn ghost wide sm" onClick={importMaps}>
                    Import Google Maps link
                  </button>
                  <label className="btn ghost wide sm file">
                    📂 Upload GPX, KML, or GeoJSON
                    <input
                      type="file"
                      accept=".gpx,.kml,.geojson,.json"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onFile(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "photos" ? (
            <div className="side-body">
              <p className="hint">
                {photoCount}/{limits.maxPhotos} photos added. Photos appear as floating polaroids when the camera pauses on a stop.
              </p>
              {project.stops.map((stop, index) => (
                <div key={stop.id} className="photo-stop">
                  <div className="photo-stop-header">
                    <div className="photo-stop-title">
                      <span className="idx">{index + 1}</span>
                      <strong>
                        {stop.code ? `${flagEmoji(stop.code)} ` : ""}
                        {stop.name}
                      </strong>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="action-btn"
                        aria-label="Move up"
                        title="Move stop up"
                        onClick={() => moveStop(index, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        aria-label="Move down"
                        title="Move stop down"
                        onClick={() => moveStop(index, 1)}
                        disabled={index === project.stops.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="action-btn remove-btn"
                        aria-label="Remove"
                        title={`Remove ${stop.name}`}
                        onClick={() => removeStop(index)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="photo-stop-controls">
                    <label className="field tight">
                      <span className="field-label">Pause (sec)</span>
                      <input
                        type="number"
                        min={0.4}
                        max={6}
                        step={0.1}
                        value={stop.dwellSec}
                        onChange={(event) =>
                          update((current) => ({
                            ...current,
                            stops: current.stops.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, dwellSec: Number(event.target.value) } : item
                            ),
                          }))
                        }
                      />
                    </label>
                    <label className="field tight">
                      <span className="field-label">Emoji {limits.pro ? "" : "· Pro"}</span>
                      <input
                        value={stop.emoji}
                        maxLength={2}
                        placeholder="🍜"
                        onChange={(event) => {
                          if (!limits.pro) {
                            setLock("Emoji labels are a Pro feature.");
                            return;
                          }
                          update((current) => ({
                            ...current,
                            stops: current.stops.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, emoji: event.target.value } : item
                            ),
                          }));
                        }}
                      />
                    </label>
                  </div>
                  {stop.photos.length > 0 ? (
                    <div className="thumbs">
                      {stop.photos.map((src, photoIndex) => (
                        <figure key={src.slice(0, 32) + photoIndex}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" />
                          <button
                            type="button"
                            aria-label="Remove photo"
                            onClick={() =>
                              update((current) => ({
                                ...current,
                                stops: current.stops.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, photos: item.photos.filter((_, candidate) => candidate !== photoIndex) }
                                    : item
                                ),
                              }))
                            }
                          >
                            ×
                          </button>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  <label className="btn ghost wide sm file">
                    ＋ Add photos for {stop.name}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        if (event.target.files) addPhotos(index, event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "options" ? (
            <div className="side-body">
              <div className="option-group">
                <span className="field-label">Map Theme</span>
                <div className="theme-row">
                  {(Object.keys(THEMES) as ThemeId[]).map((theme) => (
                    <button
                      type="button"
                      key={theme}
                      className={project.style.theme === theme ? "theme on" : "theme"}
                      onClick={() => update((current) => ({ ...current, style: { ...applyTheme(current.style, theme) } }))}
                    >
                      <span
                        className="theme-swatch"
                        style={{
                          background: `linear-gradient(135deg, ${THEMES[theme].ocean} 45%, ${THEMES[theme].land} 55%)`,
                          borderColor: THEMES[theme].line,
                        }}
                      />
                      {THEMES[theme].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="color-pickers-row">
                <label className="field">
                  <span className="field-label">Route color {limits.customColors ? "" : "· Pro"}</span>
                  <div className="color-input-wrap">
                    <input
                      type="color"
                      value={project.style.lineColor}
                      onChange={(event) => {
                        if (!limits.customColors) return setLock("Custom colors are part of Pro.");
                        update((current) => ({ ...current, style: { ...current.style, lineColor: event.target.value } }));
                      }}
                    />
                    <code>{project.style.lineColor}</code>
                  </div>
                </label>
                <label className="field">
                  <span className="field-label">Space backdrop {limits.customColors ? "" : "· Pro"}</span>
                  <div className="color-input-wrap">
                    <input
                      type="color"
                      value={project.style.background}
                      onChange={(event) => {
                        if (!limits.customColors) return setLock("Custom colors are part of Pro.");
                        update((current) => ({ ...current, style: { ...current.style, background: event.target.value } }));
                      }}
                    />
                    <code>{project.style.background}</code>
                  </div>
                </label>
              </div>

              <label className="field">
                <div className="range-header">
                  <span className="field-label">Animation speed</span>
                  <strong>{project.style.speed.toFixed(1)}×</strong>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={2}
                  step={0.1}
                  value={project.style.speed}
                  onChange={(event) => update((current) => ({ ...current, style: { ...current.style, speed: Number(event.target.value) } }))}
                />
              </label>

              <div className="two-col-fields">
                <label className="field">
                  <span className="field-label">Distance counter</span>
                  <select
                    value={project.style.units}
                    onChange={(event) =>
                      update((current) => ({ ...current, style: { ...current.style, units: event.target.value as Project["style"]["units"] } }))
                    }
                  >
                    <option value="km">Kilometers (km)</option>
                    <option value="mi">Miles (mi)</option>
                    <option value="none">Hidden</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Place labels</span>
                  <select
                    value={project.style.labels}
                    onChange={(event) =>
                      update((current) => ({ ...current, style: { ...current.style, labels: event.target.value as Project["style"]["labels"] } }))
                    }
                  >
                    <option value="current">Current stop</option>
                    <option value="visited">Visited so far</option>
                    <option value="always">Always visible</option>
                  </select>
                </label>
              </div>

              <div className="checks-card">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={project.style.highlightCountries}
                    onChange={(event) => {
                      if (!limits.customColors) return setLock("Country highlighting control is part of Pro.");
                      update((current) => ({ ...current, style: { ...current.style, highlightCountries: event.target.checked } }));
                    }}
                  />
                  <span>Highlight visited countries</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={project.style.optimizeLabels}
                    onChange={(event) => update((current) => ({ ...current, style: { ...current.style, optimizeLabels: event.target.checked } }))}
                  />
                  <span>Hide overlapping labels</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={project.style.startZoom}
                    onChange={(event) => update((current) => ({ ...current, style: { ...current.style, startZoom: event.target.checked } }))}
                  />
                  <span>Starting camera zoom-in</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={project.style.endZoom}
                    onChange={(event) => update((current) => ({ ...current, style: { ...current.style, endZoom: event.target.checked } }))}
                  />
                  <span>Ending camera zoom-out</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={project.style.showFullRouteAtEnd}
                    onChange={(event) =>
                      update((current) => ({ ...current, style: { ...current.style, showFullRouteAtEnd: event.target.checked } }))
                    }
                  />
                  <span>Show full route at end</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={project.style.showCountryFlags}
                    onChange={(event) =>
                      update((current) => ({ ...current, style: { ...current.style, showCountryFlags: event.target.checked } }))
                    }
                  />
                  <span>Country names and flags</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={limits.pro ? project.style.showLogo : true}
                    disabled={!limits.logoOptional}
                    onChange={(event) => update((current) => ({ ...current, style: { ...current.style, showLogo: event.target.checked } }))}
                  />
                  <span>Show Meridian watermark {!limits.logoOptional ? "(Free)" : ""}</span>
                </label>
              </div>

              <div className="side-divider" />

              <label className="field">
                <span className="field-label">Video aspect ratio</span>
                <select
                  value={project.style.aspect}
                  onChange={(event) =>
                    update((current) => ({ ...current, style: { ...current.style, aspect: event.target.value as Project["style"]["aspect"] } }))
                  }
                >
                  <option value="16:9">16:9 Landscape (YouTube, Slides)</option>
                  <option value="9:16">9:16 Vertical (Reels, Shorts, TikTok)</option>
                  <option value="1:1">1:1 Square (Instagram, Feed)</option>
                </select>
              </label>

              <div className="two-col-fields">
                <label className="field">
                  <span className="field-label">Resolution</span>
                  <select
                    value={limits.pro ? project.style.resolution : "768"}
                    onChange={(event) => {
                      if (event.target.value === "1080" && !limits.pro) return setLock("1080p is part of Pro.");
                      update((current) => ({
                        ...current,
                        style: { ...current.style, resolution: event.target.value as Project["style"]["resolution"] },
                      }));
                    }}
                  >
                    <option value="768">768p HD</option>
                    <option value="1080">1080p Full HD</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Frame rate</span>
                  <select
                    value={limits.pro ? String(project.style.fps) : "30"}
                    onChange={(event) => {
                      if (event.target.value === "60" && !limits.pro) return setLock("60 FPS is part of Pro.");
                      update((current) => ({ ...current, style: { ...current.style, fps: Number(event.target.value) as 30 | 60 } }));
                    }}
                  >
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {tab === "music" ? (
            <div className="side-body">
              <p className="hint">
                Synthesized ambient soundtracks are generated right in your browser and mixed into the video export.
              </p>
              {!limits.music ? <p className="notice">Music is a Pro feature. Free exports stay silent.</p> : null}
              <div className="music-list">
                {[
                  ["none", "🔇 No audio", "Silent video export"],
                  ["ambient", "🌌 Ambient Drift", "Warm atmospheric pads"],
                  ["synthwave", "🌆 Synthwave Pulse", "Retro driving arpeggio"],
                  ["cinematic", "🎻 Cinematic Horizon", "Deep orchestral swells"],
                  ["folk", "🪕 Acoustic Trail", "Light plucked melody"],
                ].map(([id, label, desc]) => (
                  <label key={id} className={`music-card ${project.style.music === id ? "on" : ""}`}>
                    <input
                      type="radio"
                      name="music"
                      checked={project.style.music === id}
                      onChange={() => {
                        if (id !== "none" && !limits.music) return setLock("Music is included with Pro.");
                        update((current) => ({ ...current, style: { ...current.style, music: id as Project["style"]["music"] } }));
                      }}
                    />
                    <div>
                      <strong>{label}</strong>
                      <small>{desc}</small>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="studio-map">
          {stageMode === "map" ? (
            <MapEditor
              stops={project.stops}
              legs={project.legs}
              theme={project.style.theme}
              color={project.style.lineColor}
              onPick={addAt}
              onRemove={removeStop}
              onMove={moveStopTo}
              onUpdateStop={updateStopCoord}
              onClearAll={clearAllStops}
            />
          ) : (
            <div className="studio-globe-stage">
              <GlobeStage ref={inlineGlobe} project={project} pro={limits.pro} play="loop" />
              <div className="globe-stage-controls">
                <button type="button" className="map-ctrl-btn text" onClick={() => inlineGlobe.current?.play()}>
                  ↻ Replay animation
                </button>
                <button type="button" className="map-ctrl-btn text" onClick={() => setStageMode("map")}>
                  ✎ Back to 2D Map Editor
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {preview ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Preview">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <strong>{project.title}</strong>
                <span className="modal-sub">
                  {project.stops.length} stops · {project.style.aspect} · {project.style.resolution}p @ {project.style.fps}fps
                </span>
              </div>
              <button
                className="icon-btn bare"
                aria-label="Close preview"
                onClick={() => {
                  globe.current?.pause();
                  setPreview(false);
                }}
              >
                ×
              </button>
            </header>
            <GlobeStage
              ref={globe}
              project={project}
              pro={limits.pro}
              play="auto"
              onTime={(time, total) => setProgress(total ? time / total : 0)}
            />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => globe.current?.play()} disabled={exporting}>
                ↻ Replay
              </button>
              <button className="btn ghost" onClick={share}>
                🔗 Copy share link
              </button>
              <button className="btn primary" onClick={renderVideo} disabled={exporting}>
                {exporting ? `Rendering ${Math.round(progress * 100)}%…` : "⬇ Download WebM video"}
              </button>
            </div>
            <p className="hint">Records a high-definition WebM video of this 3D globe animation directly in your browser.</p>
          </div>
        </div>
      ) : null}

      {lock ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Limit reached">
          <div className="modal-card narrow">
            <h2>Limit reached</h2>
            <p>{lock}</p>
            <button className="btn primary wide" onClick={() => setLock("")}>
              Keep editing
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function themeColors(theme: ThemeId) {
  const palette = THEMES[theme];
  return { theme, background: palette.bg, lineColor: palette.line, labelColor: palette.labelColor };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "meridian";
}

async function compress(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}
