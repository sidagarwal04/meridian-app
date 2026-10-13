"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchCities } from "@/lib/cities";
import { nearestCity } from "@/lib/geo";
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
  uid,
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
type PlaceHit = { name: string; country: string; code: string; lat: number; lon: number; label?: string };

export function Studio() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>("route");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [notice, setNotice] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [itinerary, setItinerary] = useState("");
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lock, setLock] = useState("");
  const globe = useRef<GlobeHandle>(null);
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
        setProject(found);
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

  const summary = useMemo(() => project?.stops.map((stop) => stop.name).join(" → ") ?? "", [project]);

  if (!project) {
    return (
      <div className="studio-loading">
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
    if (project.stops.length >= limits.maxStops) {
      setLock(`A route can hold ${limits.maxStops} places.`);
      return;
    }
    update((current) => ({
      ...current,
      stops: [...current.stops, makeStop(place)],
      legs: current.stops.length ? [...current.legs, { transport: "plane" }] : current.legs,
    }));
    setQuery("");
    setHits([]);
    setNotice("");
  };

  const addAt = async (lat: number, lon: number) => {
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
      return { ...current, stops, legs };
    });
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    update((current) => {
      const next = index + dir;
      if (next < 0 || next >= current.stops.length) return current;
      const stops = [...current.stops];
      [stops[index], stops[next]] = [stops[next], stops[index]];
      return { ...current, stops };
    });
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

  return (
    <div className="studio">
      <header className="studio-top">
        <Logo />
        <input
          className="title-input"
          aria-label="Video title"
          value={project.title}
          onChange={(event) => update({ title: event.target.value })}
        />
        <span className="credits">{user?.name ?? "Free"}</span>
        <button className="btn ghost" onClick={() => setPreview(true)}>
          Preview
        </button>
        <button className="btn primary" onClick={() => { setPreview(true); }}>
          Export
        </button>
        <Link href="/videos" className="btn ghost">
          Library
        </Link>
      </header>
      <div className="studio-main">
        <aside className="studio-side">
          <div className="tabs" role="tablist">
            {(["route", "photos", "options", "music"] as Tab[]).map((item) => (
              <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          {notice ? <p className="notice">{notice}</p> : null}
          {tab === "route" ? (
            <div className="side-body">
              <p className="hint">Starter route is Lisbon → Paris → Rome. Search, click the map, or replace it.</p>
              <label className="field">
                Add a place
                <input value={query} placeholder="City, address, or place" onChange={(event) => setQuery(event.target.value)} />
              </label>
              {hits.length ? (
                <ul className="hits">
                  {hits.map((hit) => (
                    <li key={`${hit.name}-${hit.lat}`}>
                      <button onClick={() => addStop(hit)}>
                        <strong>{hit.name}</strong>
                        <span>{hit.label || hit.country}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ol className="stop-list">
                {project.stops.map((stop, index) => (
                  <li key={stop.id}>
                    <div className="stop-row">
                      <span className="idx">{index + 1}</span>
                      <div>
                        <strong>{stop.name}</strong>
                        <small>{stop.country}</small>
                      </div>
                      <div className="row-actions">
                        <button aria-label="Move up" onClick={() => moveStop(index, -1)} disabled={index === 0}>↑</button>
                        <button aria-label="Move down" onClick={() => moveStop(index, 1)} disabled={index === project.stops.length - 1}>↓</button>
                        <button aria-label="Remove" onClick={() => removeStop(index)}>×</button>
                      </div>
                    </div>
                    {project.legs[index] ? (
                      <label className="field tight">
                        Transport to next stop
                        <select
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
                    ) : null}
                  </li>
                ))}
              </ol>
              <label className="field">
                Templates
                <select defaultValue="" onChange={(event) => event.target.value && applyTemplate(event.target.value)}>
                  <option value="">Choose a ready-made route</option>
                  {TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Describe the trip
                <textarea
                  rows={4}
                  placeholder={"Lisbon\nTrain to Madrid\nFlight to Rome\nBoat to Athens"}
                  value={itinerary}
                  onChange={(event) => setItinerary(event.target.value)}
                />
              </label>
              <button className="btn ghost wide" onClick={importItinerary}>
                Build route from text
              </button>
              <label className="field">
                Google Maps link
                <input value={mapsUrl} placeholder="https://www.google.com/maps/dir/..." onChange={(event) => setMapsUrl(event.target.value)} />
              </label>
              <button className="btn ghost wide" onClick={importMaps}>
                Import link
              </button>
              <label className="btn ghost wide file">
                Import GPX, KML, or GeoJSON
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
          {tab === "photos" ? (
            <div className="side-body">
              <p className="hint">
                {photoCount}/{limits.maxPhotos} photos. Each one appears while the camera holds on that stop.
              </p>
              {project.stops.map((stop, index) => (
                <div key={stop.id} className="photo-stop">
                  <strong>{stop.name}</strong>
                  <label className="field tight">
                    Pause (seconds)
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
                    Emoji {limits.pro ? "" : "· Pro"}
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
                  <div className="thumbs">
                    {stop.photos.map((src, photoIndex) => (
                      <figure key={src.slice(0, 32) + photoIndex}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" />
                        <button
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
                  <label className="btn ghost wide file">
                    Add photos
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
              <p className="hint">These settings are the gear menu: globe, labels, camera, and format.</p>
              <div className="theme-row">
                {(Object.keys(THEMES) as ThemeId[]).map((theme) => (
                  <button
                    key={theme}
                    className={project.style.theme === theme ? "theme on" : "theme"}
                    onClick={() => update((current) => ({ ...current, style: { ...applyTheme(current.style, theme) } }))}
                  >
                    {THEMES[theme].label}
                  </button>
                ))}
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={project.style.highlightCountries}
                  onChange={(event) => {
                    if (!limits.customColors) return setLock("Country highlighting control is part of Pro.");
                    update((current) => ({ ...current, style: { ...current.style, highlightCountries: event.target.checked } }));
                  }}
                />
                Highlight visited countries
              </label>
              <label className="field">
                Route color {limits.customColors ? "" : "· Pro"}
                <input
                  type="color"
                  value={project.style.lineColor}
                  onChange={(event) => {
                    if (!limits.customColors) return setLock("Custom colors are part of Pro.");
                    update((current) => ({ ...current, style: { ...current.style, lineColor: event.target.value } }));
                  }}
                />
              </label>
              <label className="field">
                Background {limits.customColors ? "" : "· Pro"}
                <input
                  type="color"
                  value={project.style.background}
                  onChange={(event) => {
                    if (!limits.customColors) return setLock("Custom colors are part of Pro.");
                    update((current) => ({ ...current, style: { ...current.style, background: event.target.value } }));
                  }}
                />
              </label>
              <label className="field">
                Speed {project.style.speed.toFixed(1)}×
                <input
                  type="range"
                  min={0.6}
                  max={2}
                  step={0.1}
                  value={project.style.speed}
                  onChange={(event) => update((current) => ({ ...current, style: { ...current.style, speed: Number(event.target.value) } }))}
                />
              </label>
              <label className="field">
                Distance
                <select
                  value={project.style.units}
                  onChange={(event) =>
                    update((current) => ({ ...current, style: { ...current.style, units: event.target.value as Project["style"]["units"] } }))
                  }
                >
                  <option value="km">Kilometers</option>
                  <option value="mi">Miles</option>
                  <option value="none">Hidden</option>
                </select>
              </label>
              <label className="field">
                Place labels
                <select
                  value={project.style.labels}
                  onChange={(event) =>
                    update((current) => ({ ...current, style: { ...current.style, labels: event.target.value as Project["style"]["labels"] } }))
                  }
                >
                  <option value="current">Current stop</option>
                  <option value="visited">Visited so far</option>
                  <option value="always">Always</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={project.style.optimizeLabels}
                  onChange={(event) => update((current) => ({ ...current, style: { ...current.style, optimizeLabels: event.target.checked } }))}
                />
                Hide overlapping labels
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={project.style.startZoom}
                  onChange={(event) => update((current) => ({ ...current, style: { ...current.style, startZoom: event.target.checked } }))}
                />
                Starting zoom-in
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={project.style.endZoom}
                  onChange={(event) => update((current) => ({ ...current, style: { ...current.style, endZoom: event.target.checked } }))}
                />
                Ending zoom-out
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={project.style.showFullRouteAtEnd}
                  onChange={(event) =>
                    update((current) => ({ ...current, style: { ...current.style, showFullRouteAtEnd: event.target.checked } }))
                  }
                />
                Show the full route at the end
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={project.style.showCountryFlags}
                  onChange={(event) =>
                    update((current) => ({ ...current, style: { ...current.style, showCountryFlags: event.target.checked } }))
                  }
                />
                Country names and flags
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={limits.pro ? project.style.showLogo : true}
                  disabled={!limits.logoOptional}
                  onChange={(event) => update((current) => ({ ...current, style: { ...current.style, showLogo: event.target.checked } }))}
                />
                Show Meridian logo {!limits.logoOptional ? "(required on Free)" : ""}
              </label>
              <label className="field">
                Aspect ratio
                <select
                  value={project.style.aspect}
                  onChange={(event) =>
                    update((current) => ({ ...current, style: { ...current.style, aspect: event.target.value as Project["style"]["aspect"] } }))
                  }
                >
                  <option value="16:9">16:9 YouTube</option>
                  <option value="9:16">9:16 Reels, Shorts, TikTok</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </label>
              <label className="field">
                Resolution
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
                  <option value="768">768p · 30 FPS</option>
                  <option value="1080">1920p · up to 60 FPS</option>
                </select>
              </label>
              <label className="field">
                Frame rate
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
          ) : null}
          {tab === "music" ? (
            <div className="side-body">
              <p className="hint">Tracks are synthesized in the browser and mixed into the export. They are original tones, not commercial songs.</p>
              {!limits.music ? <p className="notice">Music is a Pro feature. Free exports stay silent.</p> : null}
              {[
                ["none", "No music"],
                ["ambient", "Ambient"],
                ["synthwave", "Synthwave"],
                ["cinematic", "Cinematic"],
                ["folk", "Folk"],
              ].map(([id, label]) => (
                <label key={id} className="check">
                  <input
                    type="radio"
                    name="music"
                    checked={project.style.music === id}
                    onChange={() => {
                      if (id !== "none" && !limits.music) return setLock("Music is included with Pro.");
                      update((current) => ({ ...current, style: { ...current.style, music: id as Project["style"]["music"] } }));
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : null}
        </aside>
        <div className="studio-map">
          <MapEditor stops={project.stops} theme={project.style.theme} color={project.style.lineColor} onPick={addAt} />
          <p className="map-caption">Click the map to drop the next stop. {summary}</p>
        </div>
      </div>

      {preview ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Preview">
          <div className="modal-card">
            <header>
              <strong>{project.title}</strong>
              <button className="icon-btn bare" onClick={() => { globe.current?.pause(); setPreview(false); }}>
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
                Replay
              </button>
              <button className="btn ghost" onClick={share}>
                Copy share link
              </button>
              <button className="btn primary" onClick={renderVideo} disabled={exporting}>
                {exporting ? `Rendering ${Math.round(progress * 100)}%` : "Download video"}
              </button>
            </div>
            <p className="hint">Download records a free WebM of this preview.</p>
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
